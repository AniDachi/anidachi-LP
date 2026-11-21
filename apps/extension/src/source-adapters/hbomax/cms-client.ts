import { HboMaxProviderIdSchema, WATCH_CATALOG_MAX_EPISODES, hboMaxPlaybackId } from "@anidachi/protocol";
import { z } from "zod";
import { HboCmsEpisodeSchema, HboCmsPlaybackSchema, HboCmsShowSchema } from "./cms-catalog";

const packetSchema = z.strictObject({
	playbackId: HboMaxProviderIdSchema, metadata: HboCmsPlaybackSchema.nullable(), show: HboCmsShowSchema.nullable(),
	episodes: z.array(HboCmsEpisodeSchema).max(WATCH_CATALOG_MAX_EPISODES * 2), locale: z.string().trim().min(2).max(35).nullable(),
});
type Packet = z.infer<typeof packetSchema>;
type Client = {
	path: string; language: string; lifetime: AbortController; packet: Packet | null; serialized: string | null;
};
const clients = new WeakMap<Document, Client>();
const maxPacketChars = 3_000_000;

function parsePacket(detail: string) {
	try { return packetSchema.safeParse(JSON.parse(detail)).data; } catch { return undefined; }
}

function currentClient(doc: Document, playbackId: string) {
	const client = clients.get(doc);
	return client && !client.lifetime.signal.aborted && client.path === doc.location.pathname &&
		client.language === doc.documentElement.lang && hboMaxPlaybackId(doc.location.href) === playbackId ? client : null;
}

export function hboCmsVisitSignal(doc: Document, playbackId: string): AbortSignal | undefined {
	return currentClient(doc, playbackId)?.lifetime.signal;
}

export function getHboCmsPacket(doc: Document, playbackId: string): Packet | null {
	return currentClient(doc, playbackId)?.packet ?? null;
}

/** A saved watch or rendered card can identify the player before HBO finishes loading its route. */
export function waitForHboCmsShow(doc: Document, seriesId: string, playbackId: string, signal: AbortSignal): Promise<Packet | null> {
	const current = () => {
		const packet = getHboCmsPacket(doc, playbackId);
		return packet?.show?.seriesId === seriesId ? packet : null;
	};
	const initial = current();
	if (initial || signal.aborted) return Promise.resolve(initial);
	return new Promise(resolve => {
		const finish = () => {
			clearTimeout(timer);
			doc.removeEventListener("anidachi:hbo-cms", received);
			signal.removeEventListener("abort", finish);
			resolve(signal.aborted ? null : current());
		};
		const received = () => { if (current()) finish(); };
		const timer = setTimeout(finish, 1_500);
		signal.addEventListener("abort", finish, { once: true });
		doc.addEventListener("anidachi:hbo-cms", received);
	});
}

export function startHboCmsClient(doc: Document) {
	const client: Client = { path: "", language: "", lifetime: new AbortController(), packet: null, serialized: null };
	clients.set(doc, client);
	const reset = () => {
		client.lifetime.abort();
		client.lifetime = new AbortController();
		client.packet = null;
		client.serialized = null;
		client.path = doc.location.pathname;
		client.language = doc.documentElement.lang;
	};
	const accept = (event: Event) => {
		const playbackId = hboMaxPlaybackId(doc.location.href);
		if (!playbackId || event.target !== doc) return;
		if (client.path !== doc.location.pathname || client.language !== doc.documentElement.lang) reset();
		const detail: unknown = (event as CustomEvent<unknown>).detail;
		if (typeof detail !== "string" || detail.length > maxPacketChars || detail === client.serialized) return;
		const packet = parsePacket(detail);
		if (!packet || packet.playbackId !== playbackId) return;
		const metadata = packet.metadata;
		if (metadata && (metadata.identity.providerEpisodeIdentifier !== playbackId ||
			(packet.show && packet.show.seriesId !== metadata.identity.providerSeriesId))) return;
		// The player's own episode can be outside the default season rail on a direct watch link.
		if (metadata && packet.show?.seasons.some(season => season.number === metadata.seasonNumber) &&
			!packet.episodes.some(episode => episode.id === playbackId)) {
			packet.episodes.push({ id: playbackId, number: metadata.episodeNumber, seasonNumber: metadata.seasonNumber, title: metadata.episodeTitle });
		}
		client.packet = packet;
		client.serialized = detail;
	};
	const sync = () => {
		if (client.path === doc.location.pathname && client.language === doc.documentElement.lang) return;
		reset();
		const playbackId = hboMaxPlaybackId(doc.location.href);
		if (playbackId) doc.dispatchEvent(new CustomEvent("anidachi:hbo-cms-read", { detail: JSON.stringify({ playbackId }) }));
	};
	doc.addEventListener("anidachi:hbo-cms", accept);
	doc.defaultView?.addEventListener("pagehide", reset);
	return { sync, reset, stop() {
		doc.removeEventListener("anidachi:hbo-cms", accept);
		doc.defaultView?.removeEventListener("pagehide", reset);
		client.lifetime.abort();
		clients.delete(doc);
	} };
}
