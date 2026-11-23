/** Navigation hint only. The invite page and POST still enforce sign-in and membership.
 * A persisted playback source always takes precedence in both callers. */
export function disneyLobbyDestination(
	roomId: string,
	lobby: unknown,
): string | null {
	if (lobby !== "disneyplus" || !/^[\w-]{1,128}$/.test(roomId)) return null;
	const url = new URL("https://www.disneyplus.com/home");
	url.hash = new URLSearchParams({
		anidachiRoom: roomId,
		anidachiLobby: "disneyplus",
	}).toString();
	return url.href;
}
