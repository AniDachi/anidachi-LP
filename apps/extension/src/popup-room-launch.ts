import { disneyPlusRoutePath, hboMaxCatalogPath, MAX_ROOM_ID_CHARS, type RoomLobbyProvider } from "@anidachi/protocol";
import { catalogRoomProvider } from "./catalog-room-routes";
import { buildRoomShareableUrl } from "./room-url";

export const ROOMS_PILOT = import.meta.env.WXT_EXTENSION_CHANNEL === "staging";
export const ROOM_LAUNCH_MESSAGE = "ANIDACHI_POPUP_ROOM_LAUNCH";

export function isDisneyRoomSurface(href?: string): boolean {
	if (!href || catalogRoomProvider(href) !== "disneyplus") return false;
	const path = disneyPlusRoutePath(new URL(href).pathname).toLowerCase();
	return path !== "/" && path !== "/browse";
}

export function popupRoomProvider(href?: string): RoomLobbyProvider | null {
	if (!href) return null;
	const provider = catalogRoomProvider(href);
	if (provider === "netflix" || provider === "primevideo" || provider === "hbomax" || provider === "crunchyroll") return provider;
	return provider === "disneyplus" && isDisneyRoomSurface(href) ? provider : null;
}

export function netflixProfileGate(doc: Document): boolean {
	return Boolean(doc.querySelector('[data-uia="profile-gate-screen"], [data-uia="profile-selector"], .profiles-gate-container'));
}

export function hasCatalogNavigation(doc: Document, provider: RoomLobbyProvider): boolean {
	if (provider === "crunchyroll") {
		return Boolean(doc.querySelector('header [aria-controls="user-menu-authenticated"]'));
	}
	if (provider === "hbomax") {
		const nav = doc.querySelector('nav [data-testid="navigationMenu"]');
		return Boolean(nav?.querySelector('a[data-testid="my-stuff_button"]') && nav.querySelector('button[data-testid="profile_button"]'));
	}
	if (provider === "primevideo") {
		const catalog = doc.getElementById("dv-web-page-hydration-root");
		return !!catalog?.querySelector('a[href*="/storefront"], a[href*="/detail/"], a[href*="/gp/video/"]');
	}
	if (provider === "netflix") {
		if (netflixProfileGate(doc)) return false;
		return Boolean(doc.querySelector('.main-header a[href^="/browse"], [data-uia="navigation"] a[href^="/browse"], .lolomo[data-uia]'));
	}
	const nav = doc.querySelector('nav a[href$="/browse/watchlist"], [role="navigation"] a[href$="/browse/watchlist"]');
	return Boolean(nav && doc.querySelector('main, [role="main"]'));
}

export function netflixProfileReturn(referrer: string): boolean {
	try {
		const url = new URL(referrer);
		return url.origin === "https://www.netflix.com" && /^\/(?:browse|SwitchProfile|ProfilesGate)\/?$/i.test(url.pathname);
	} catch {
		return false;
	}
}

export function lobbyRoomFromUrl(href: string): string | null {
	const provider = popupRoomProvider(href);
	if (!provider) return null;
	const params = new URLSearchParams(new URL(href).hash.slice(1));
	const ids = params.getAll("anidachiRoom");
	return params.getAll("anidachiLobby").length === 1 && params.get("anidachiLobby") === provider &&
		ids.length === 1 &&
		ids[0] &&
		ids[0].length <= MAX_ROOM_ID_CHARS &&
		/^[\w-]+$/.test(ids[0])
		? ids[0]
		: null;
}

export function popupRoomInvite(roomId: string, provider: RoomLobbyProvider | null) {
	const url = new URL(buildRoomShareableUrl(roomId));
	if (provider) url.searchParams.set("lobby", provider);
	return url.href;
}

// HBO removes the fragment while rendering its catalog. Keep this invitation
// only for admission in the document that actually opened it.
export function captureHboLobbyInvite(href: string, navigation?: Pick<PerformanceNavigationTiming, "name" | "type">) {
	if (!hboMaxCatalogPath(href)) return null;
	const page = href.split("#")[0];
	const original = href.includes("#") ? href : navigation?.type === "navigate" ? navigation.name : null;
	if (!original || original.split("#")[0] !== page) return null;
	let room = lobbyRoomFromUrl(original);
	if (!room) return null;
	return {
		read(current: string) {
			if (current.split("#")[0] !== page || (current.includes("#") && lobbyRoomFromUrl(current) !== room)) room = null;
			return room;
		},
		consume() { room = null; },
	};
}

// Module-local delivery between the content lifecycle and its React overlay.
// The page cannot request creation through a DOM event, query string or fragment.
type CreateIntent = { provider: RoomLobbyProvider; owner: string; id: string; expires: number; path: string };
let intent: CreateIntent | null = null;
const listeners = new Set<() => void>();
export const getPopupCreate = () => intent;
export function subscribePopupCreate(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
export function setPopupCreate(next: CreateIntent | null) {
	intent = next;
	for (const listener of listeners) listener();
}
