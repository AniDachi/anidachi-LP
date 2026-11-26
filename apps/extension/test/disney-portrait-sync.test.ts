import { afterEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ session: { user: { id: "viewer" }, authSessionId: "login", accessToken: "test" } }));
vi.mock("../src/auth-tokens", () => ({ getStoredAuthTokens: async () => auth.session }));
vi.mock("../src/history-recording-choice", () => ({ isHistoryRecordingEnabled: async () => true }));
vi.mock("../src/constants", () => ({ WEB_HTTP_BASE: "https://staging.anidachi.app" }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("updates existing titles without replay and saves a selected new title only after its first recorded watch", async () => {
  const first = "65e808bd-2703-452d-bf62-d941d9d799fd";
  const second = "3ce925e9-e441-44af-8888-a655c9e88109";
  const key = (id: string) => "disneyplus:series:" + id;
  const url = (id: string) => "https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/" + id + "/compose?format=webp&label=standard_art_vertical_067&width=800";
  const storage: Record<string, unknown> = {};
  const sender = { id: "self", frameId: 0, tab: { id: 1 }, url: "https://www.disneyplus.com/pt-br/browse/watchlist" } as chrome.runtime.MessageSender;
  vi.stubGlobal("chrome", { runtime: { id: "self" }, storage: { session: {
    get: async () => storage, set: async (data: object) => Object.assign(storage, data),
  } } });
  const writes: string[][] = [];
  vi.stubGlobal("fetch", async (_: unknown, options: RequestInit) => {
    if (options.method !== "POST") return Response.json({ owner: "viewer", generation: 1, epoch: 3, keys: [key(first)] });
    const keys = JSON.parse(String(options.body)).cards.map((card: { key: string }) => card.key);
    writes.push(keys);
    return Response.json(keys);
  });
  const { observeDisneyPortraits } = await import("../src/disney-portrait-sync");
  await observeDisneyPortraits([{ id: first, url: url(first) }, { id: second, url: url(second) }], sender, false);
  expect(writes).toEqual([[key(first)]]);
  await observeDisneyPortraits([{ id: second, url: url(second) }], sender, true);
  vi.resetModules(); // Browser can suspend the service worker before playback starts.
  const { syncDisneyPortraits } = await import("../src/disney-portrait-sync");
  const session = { ...auth.session, refreshToken: "", user: { id: "viewer", email: "", displayName: "", avatarUrl: null, plan: "plus" as const } };
  await syncDisneyPortraits(session, 1, [key(second)]);
  await syncDisneyPortraits(session, 1, [key(second)]);
  expect(writes).toEqual([[key(first)], [key(second)]]);
});
