import { PrimeMarketplaceSchema, ROOM_LOBBY_HOME, RoomLobbyProviderSchema } from "@anidachi/protocol";

/** Navigation hint only. The invite page and POST still enforce sign-in and membership.
 * A persisted playback source always takes precedence in both callers. */
export function roomLobbyDestination(
	roomId: string,
	lobby: unknown,
	marketplace?: unknown,
): string | null {
	const parsed = RoomLobbyProviderSchema.safeParse(lobby);
	if (!parsed.success || !/^[\w-]{1,128}$/.test(roomId)) return null;
	const market = parsed.data === "primevideo" ? PrimeMarketplaceSchema.safeParse(marketplace).data : undefined;
	const url = new URL(market && market !== "primevideo.com"
		? `https://www.${market}/gp/video/storefront`
		: ROOM_LOBBY_HOME[parsed.data]);
	url.hash = new URLSearchParams({
		anidachiRoom: roomId,
		anidachiLobby: parsed.data,
	}).toString();
	return url.href;
}
