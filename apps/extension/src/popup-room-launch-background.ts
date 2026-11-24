import { CRUNCHYROLL_CATALOG_ORIGINS } from "./source-adapters/crunchyroll/url";
import { catalogPlayerProvider } from "./catalog-room-routes";
import { HBO_MAX_BROWSER_HOSTS, PRIME_CONTENT_MATCHES, ROOM_LOBBY_HOME, RoomLobbyProviderSchema, type RoomLobbyProvider } from "@anidachi/protocol";
import { getStoredAuthTokens } from "./auth-tokens";
import { PRIME_ROOM_INTERNAL } from "./prime-room-contract";
import {
	popupRoomProvider,
	lobbyRoomFromUrl,
	popupRoomInvite,
	ROOM_LAUNCH_MESSAGE,
} from "./popup-room-launch";

const pendingKey = "anidachi:rooms:popup-launch";
type Pending = { provider: RoomLobbyProvider; id: string; owner: string; tabId: number; expires: number };
type ProfileInvite = { room: string; owner: string; expires: number };

async function activeContext(owner: string) {
	const [active] = await chrome.tabs.query({
		active: true,
		lastFocusedWindow: true,
	});
	// Only a live transport proves the room is still open. A saved tab record
	// can survive a restart and is used for recovery, never for this status.
	const live = await chrome.runtime
		.sendMessage({
			type: PRIME_ROOM_INTERNAL,
			action: "popup-room",
			owner,
		})
		.catch(() => null);
	const room =
		live && Number.isInteger(live.tabId) && typeof live.roomId === "string"
			? {
					tabId: live.tabId as number,
					here: active?.id === live.tabId,
					provider: live.provider,
					invite: popupRoomInvite(live.roomId, RoomLobbyProviderSchema.safeParse(live.provider).data ?? null),
				}
			: null;
	return { active, room };
}

export function registerPopupRoomLaunch() {
	let queue: Promise<unknown> = Promise.resolve();
	const profileInviteKey = (tabId: number) => `anidachi:netflix-profile-invite:${tabId}`;
	chrome.tabs.onRemoved?.addListener(tabId => {
		void chrome.storage.session.remove(profileInviteKey(tabId)).catch(() => undefined);
	});
	chrome.runtime.onMessage.addListener((message, sender, reply) => {
		if (
			message?.type !== ROOM_LAUNCH_MESSAGE ||
			sender.id !== chrome.runtime.id
		)
			return;
		const popup =
			!sender.tab && sender.url === chrome.runtime.getURL("popup.html");
		const content =
			sender.tab?.id !== undefined &&
			sender.frameId === 0 &&
			sender.url && sender.tab.url && new URL(sender.url).origin === new URL(sender.tab.url).origin &&
			popupRoomProvider(sender.tab.url);
		const profileInvite = message.action === "remember-profile-invite" || message.action === "take-profile-invite";
		if (message.action === "claim" || profileInvite ? !content : !popup) return;
		const run = async () => {
			const auth = await getStoredAuthTokens();
			if (!auth) return { error: "Sign in to AniDachi to create a room." };
			const owner = auth.user.id;
			if (profileInvite) {
				const tabId = sender.tab?.id;
				if (tabId === undefined || content !== "netflix" || new URL(sender.url!).pathname !== "/browse") return null;
				const key = profileInviteKey(tabId);
				if (message.action === "remember-profile-invite") {
					const room = lobbyRoomFromUrl(sender.url!);
					if (room) await chrome.storage.session.set({ [key]: { room, owner, expires: Date.now() + 300_000 } });
					return null;
				}
				const saved = (await chrome.storage.session.get(key))[key] as ProfileInvite | undefined;
				await chrome.storage.session.remove(key);
				return saved?.owner === owner && saved.expires > Date.now() ? saved.room : null;
			}
			const pending = (await chrome.storage.session.get(pendingKey))[
				pendingKey
			] as Pending | undefined;
			if (message.action === "claim") {
				if (
					!pending ||
					pending.provider !== content ||
					pending.tabId !== sender.tab?.id ||
					pending.owner !== owner ||
					pending.expires < Date.now()
				)
					return null;
				const tab = await chrome.tabs.get(pending.tabId);
				if (popupRoomProvider(tab.url) !== pending.provider) return null;
				await chrome.storage.session.remove(pendingKey);
				return { id: pending.id, owner, provider: pending.provider, expires: pending.expires };
			}
			if (message.owner !== owner)
				return { error: "Your account changed. Open the Room tab again." };
			const { active, room } = await activeContext(owner);
			if (message.action === "state")
				return { here: popupRoomProvider(active?.url), room };
			if (message.action !== "open") return;
			const provider = RoomLobbyProviderSchema.safeParse(message.provider).data;
			if (!room && !provider) return { error: "Choose a platform." };
			let tabId = room?.tabId;
			if (
				tabId === undefined &&
				pending?.owner === owner && pending.provider === provider &&
				pending.expires > Date.now()
			) {
				const destination = await chrome.tabs.get(pending.tabId).catch(() => undefined);
				if (destination && popupRoomProvider(destination.url ?? destination.pendingUrl) === provider) tabId = destination.id;
			}
			if (tabId === undefined && provider) {
				const target = popupRoomProvider(active?.url) === provider
					? active
					: (
							await chrome.tabs.query({
								currentWindow: true,
								url: provider === "primevideo" ? PRIME_CONTENT_MATCHES
									: provider === "crunchyroll" ? CRUNCHYROLL_CATALOG_ORIGINS.map(origin => origin + "/*")
									: provider === "hbomax" ? HBO_MAX_BROWSER_HOSTS.map(host => `https://${host}/*`)
									: new URL(ROOM_LOBBY_HOME[provider]).origin + "/*",
							})
						)
							.filter(
								(tab) =>
									popupRoomProvider(tab.url) === provider && !catalogPlayerProvider(tab.url!),
							)
							.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
				tabId =
					target?.id ??
					(await chrome.tabs.create({ url: ROOM_LOBBY_HOME[provider], active: false })).id;
				if (tabId === undefined) throw new Error("Could not open the platform.");
				await chrome.storage.session.set({
					[pendingKey]: {
						tabId,
						provider, id: crypto.randomUUID(),
						owner,
						expires: Date.now() + (provider === "netflix" ? 300_000 : 60_000),
					},
				});
			}
			if (tabId === undefined) return { error: "Could not open the room." };
			const target = await chrome.tabs.update(tabId, { active: true });
			if (target && target.windowId !== active?.windowId)
				await chrome.windows.update(target.windowId, { focused: true });
			if (!room)
				void chrome.tabs
					.sendMessage(
						tabId,
						{ type: ROOM_LAUNCH_MESSAGE, action: "wake" },
						{ frameId: 0 },
					)
					.catch(() => undefined);
			return { ok: true };
		};
		const task = queue.then(run);
		queue = task.catch(() => undefined);
		void task.then(reply, () =>
			reply({ error: "Could not open the room. Try again." }),
		);
		return true;
	});
}
