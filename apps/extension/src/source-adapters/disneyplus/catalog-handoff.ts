import { disneyPlusEntityId, disneyPlusPlaybackId } from "@anidachi/protocol";
import { z } from "zod";
import { getStoredAuthTokens } from "../../auth-tokens";
import { readSavedDisneyPlusMetadata } from "./history-metadata";
import type { DisneyPlusPlaybackMetadata } from "./metadata";
import { parseDisneyPlusCatalogTransfer, transferIncludesPlayback } from "./catalog-transfer";
import { DISNEY_REDIRECT_TTL_MS, DISNEY_ROOM_INVITE_TTL_MS, disneyLaunchFragment, disneyLaunchTitle } from "./launch-redirect";
export { isDisneyPlusProfileBoundary } from "./catalog-transfer";

const storedRecord = z.strictObject({ owner: z.string(), expires: z.number(), payload: z.string().max(256_000) });
const storageKey = (tab: number) => `disneyPlusCatalog:${tab}`;
const redirectKey = (tab: number) => `disneyPlusRedirect:${tab}`;
const redirectRecord = z.strictObject({ owner: z.string(), playback: z.string(), fragment: z.string(), expires: z.number() });
// A single title can span a feature-length film or several episodes in a tab.
const lifetime = 3 * 60 * 60 * 1000;
const tails = new Map<number, Promise<unknown>>();

function inTab<T>(tab: number, work: () => Promise<T>): Promise<T> {
	const next = (tails.get(tab) ?? Promise.resolve()).catch(() => undefined).then(work);
	tails.set(tab, next);
	const release = () => { if (tails.get(tab) === next) tails.delete(tab); };
	void next.then(release, release);
	return next;
}

export async function forgetDisneyPlusCatalogTab(tab: number): Promise<void> {
	await inTab(tab, async () => {
		await Promise.all([chrome.storage.session.remove(storageKey(tab)), chrome.storage.session.remove(redirectKey(tab))]);
	}).catch(() => undefined);
}

// Only Disney tabs can redeem a handoff. Clear it when Disney opens another title
// or the catalog, before a later visit to the original detail page could reuse it.
export async function discardUnrelatedDisneyLaunch(tab: number, href: string): Promise<void> {
	if (!href.startsWith("https://www.disneyplus.com/")) return;
	await inTab(tab, async () => {
		const key = redirectKey(tab);
		const record = redirectRecord.safeParse((await chrome.storage.session.get(key))[key]);
		if (record.success && (record.data.playback !== disneyLaunchTitle(href) || record.data.expires <= Date.now())) {
			await chrome.storage.session.remove(key);
		}
	}).catch(() => undefined);
}

async function ownerKey(): Promise<string | null> {
	const auth = await getStoredAuthTokens();
	// Neither tokens nor email addresses belong in a catalog handoff.
	return auth?.user.id && auth.authSessionId ? JSON.stringify([auth.user.id, auth.authSessionId]) : null;
}

export async function handleDisneyPlusCatalogHandoff(message: { type?: unknown; action?: unknown; payload?: unknown }, sender: chrome.runtime.MessageSender): Promise<string | { metadata: DisneyPlusPlaybackMetadata } | null> {
	const tab = sender.tab?.id;
	const origin = "https://www.disneyplus.com";
	if (message.type !== "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF" || sender.id !== chrome.runtime.id ||
		sender.frameId !== 0 || tab === undefined || !sender.url?.startsWith(origin + "/") ||
		(sender.origin !== undefined && sender.origin !== origin)) return null;
	return inTab(tab, async () => {
		const key = storageKey(tab);
		const owner = await ownerKey();
		if (!owner) return null;
		if (message.action === "capture-launch" || message.action === "claim-launch") {
			const playback = disneyLaunchTitle(sender.url ?? "");
			if (!playback || typeof message.payload !== "string" || disneyLaunchTitle(message.payload) !== playback) return null;
			const key = redirectKey(tab);
			const fragment = disneyLaunchFragment(message.payload);
			if (message.action === "capture-launch") {
				if (!fragment) return null;
				const ttl = fragment.startsWith("anidachiRoom=") ? DISNEY_ROOM_INVITE_TTL_MS : DISNEY_REDIRECT_TTL_MS;
				await chrome.storage.session.set({ [key]: { playback, fragment, owner, expires: Date.now() + ttl } });
				return fragment;
			}
			// On same-document Continue, sender.url still identifies the detail document.
			const currentHref = (await chrome.tabs.get(tab)).url ?? "";
			if (disneyPlusPlaybackId(message.payload) !== playback || disneyPlusPlaybackId(currentHref) !== playback) return null;
			const record = redirectRecord.safeParse((await chrome.storage.session.get(key))[key]);
			if (!record.success || record.data.playback !== playback) return null;
			await chrome.storage.session.remove(key);
			if (new URL(message.payload).hash && fragment !== record.data.fragment) return null;
			return record.data.owner === owner && record.data.expires > Date.now() &&
				await ownerKey() === owner ? record.data.fragment : null;
		}
		const href = (await chrome.tabs.get(tab)).url ?? "";
		const entity = disneyPlusEntityId(href), playback = disneyPlusPlaybackId(href);
		if (message.action === "save" && entity && typeof message.payload === "string") {
			const details = parseDisneyPlusCatalogTransfer(message.payload);
			if (details?.entityId === entity)
				await chrome.storage.session.set({ [key]: { owner, expires: Date.now() + lifetime, payload: message.payload } });
			return null;
		}
		if (message.action !== "read" || !playback) return null;
		const stored = storedRecord.safeParse((await chrome.storage.session.get(key))[key]);
		if (stored.success) {
			const record = stored.data;
			if (record.owner !== owner || record.expires <= Date.now()) {
				await chrome.storage.session.remove(key);
			} else {
				const transfer = parseDisneyPlusCatalogTransfer(record.payload);
				if (transfer && transferIncludesPlayback(transfer, playback) && await ownerKey() === owner) return record.payload;
			}
		}
		const auth = await getStoredAuthTokens();
		if (!auth?.authSessionId || JSON.stringify([auth.user.id, auth.authSessionId]) !== owner) return null;
		const metadata = await readSavedDisneyPlusMetadata(auth.user.id, playback);
		return metadata && await ownerKey() === owner ? { metadata } : null;
	}).catch(() => null);
}
