import { z } from "zod";
import { disneyCatalogPortrait } from "@anidachi/protocol";
import { getStoredAuthTokens, type ExtensionAuthTokens } from "./auth-tokens";
import { WEB_HTTP_BASE } from "./constants";
import { isHistoryRecordingEnabled } from "./history-recording-choice";

const endpoint = WEB_HTTP_BASE + "/api/watch-history/v3/disney-portraits";
const selectedKey = "anidachi.disneySelectedPortrait";
const selectedCard = z.object({ sessionId: z.string(), id: z.uuid(), url: z.string().max(2048), expires: z.number() });
type Card = { id: string; url: string };
type Library = { owner: string; generation: number; epoch: number; keys: string[] };
type Catalog = { sessionId: string; images: Map<string, string>; saved: Map<string, string>; sending: Set<string>; library?: Promise<Library | null>; until: number };
let catalog: Catalog | undefined;

function sessionCatalog(session: ExtensionAuthTokens) {
  if (!session.authSessionId) return;
  if (catalog?.sessionId !== session.authSessionId) {
    catalog = { sessionId: session.authSessionId, images: new Map(), saved: new Map(), sending: new Set(), until: 0 };
  }
  return catalog;
}

async function libraryFor(session: ExtensionAuthTokens, state: Catalog) {
  if (!state.library || Date.now() >= state.until) {
    state.until = Date.now() + 5 * 60_000;
    const request = (token: string) => fetch(endpoint, { headers: { Authorization: "Bearer " + token },
      credentials: "omit", redirect: "error", signal: AbortSignal.timeout(5000) });
    state.library = request(session.accessToken).then(async res => {
      if (res.status === 401) {
        const { getCurrentExtensionSession } = await import("./auth-client");
        const fresh = await getCurrentExtensionSession();
        if (fresh?.authSessionId === state.sessionId) res = await request(fresh.accessToken);
      }
      if (!res.ok) return null;
      const data = await res.json();
      return data?.owner === session.user.id && Number.isSafeInteger(data.generation) && Number.isSafeInteger(data.epoch) &&
        Array.isArray(data.keys) && data.keys.every((s: unknown) => typeof s === "string") ? data as Library : null;
    }).catch(() => null);
  }
  const result = await state.library;
  if (!result) state.until = Math.min(state.until, Date.now() + 10_000);
  return result;
}

// Only matching, already-recorded titles leave the device. Ordinary checkpoints never wait for artwork.
export async function syncDisneyPortraits(session: ExtensionAuthTokens, generation: number, keys: string[]) {
  if (!keys.some(key => key.startsWith("disneyplus:")) || !session.authSessionId) return;
  try {
    const state = sessionCatalog(session)!;
    if (!state.images.size) {
      // The selected card survives a document navigation and an MV3 worker suspension.
      const selected = selectedCard.safeParse((await chrome.storage.session.get(selectedKey))[selectedKey]).data;
      if (selected?.sessionId !== state.sessionId || selected.expires <= Date.now() || !disneyCatalogPortrait(selected.url) || state.saved.get(selected.id) === selected.url) return;
      state.images.set(selected.id, selected.url);
    }
    const matches = keys.flatMap(key => {
      const id = key.split(":")[2];
      const url = id && state.images.get(id);
      return key.startsWith("disneyplus:") && id && url && !state.sending.has(key) ? [{ key, id, url }] : [];
    });
    if (!matches.length) return;
    for (const { key } of matches) state.sending.add(key);
    try {
      if (!await isHistoryRecordingEnabled(session.user.id)) return;
      const access = await libraryFor(session, state);
      const current = await getStoredAuthTokens();
      if (access?.generation !== generation || !current || current.authSessionId !== session.authSessionId) return;
      for (let i = 0; i < matches.length; i += 40) {
        const batch = matches.slice(i, i + 40);
        const response = await fetch(endpoint, { method: "POST", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(5000),
          headers: { Authorization: "Bearer " + current.accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({ generation, epoch: access.epoch, cards: batch.map(({ key, url }) => ({ key, url })) }),
        });
        if (!response.ok) { state.until = 0; return; }
        const saved: unknown = await response.json();
        if (Array.isArray(saved)) for (const { key, id, url } of batch) {
          if (saved.includes(key) && state.images.get(id) === url) {
            state.images.delete(id);
            state.saved.set(id, url);
            if (state.saved.size > 200) state.saved.delete(state.saved.keys().next().value!);
          }
        }
      }
    } finally { for (const { key } of matches) state.sending.delete(key); }
  } catch { /* Publisher artwork is independent from progress. */ }
}

export async function observeDisneyPortraits(cards: unknown, sender: chrome.runtime.MessageSender, selected: boolean) {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || sender.tab?.id === undefined ||
      !sender.url?.startsWith("https://www.disneyplus.com/") || !Array.isArray(cards) || !cards.length || cards.length > 40) return;
  const session = await getStoredAuthTokens();
  if (!session?.authSessionId || !await isHistoryRecordingEnabled(session.user.id)) return;
  const state = sessionCatalog(session)!;
  for (const card of cards as Card[]) {
    const url = disneyCatalogPortrait(card?.url);
    if (!url || typeof card.id !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(card.id)) continue;
    if (state.saved.get(card.id) === url) continue;
    state.images.set(card.id, url);
    if (state.images.size > 200) state.images.delete(state.images.keys().next().value!);
    if (selected && cards.length === 1) {
      await chrome.storage.session.set({ [selectedKey]: { sessionId: state.sessionId, id: card.id, url, expires: Date.now() + 60 * 60_000 } });
    }
  }
  if (state.images.size) {
    const library = await libraryFor(session, state);
    if (library) await syncDisneyPortraits(session, library.generation, library.keys);
  }
}
