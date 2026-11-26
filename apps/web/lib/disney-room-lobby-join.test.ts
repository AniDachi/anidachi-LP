import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { after, test } from "node:test";
import { NextRequest } from "next/server";
import { roomSourceCreationColumns } from "./anidachi-auth/room-source";

const loader = Module as typeof Module & {
	_load: (id: string, parent: unknown, main: boolean) => unknown;
};
const original = loader._load;
let user: string | null = "guest",
	ended = false,
	joined = 0;
let lobbyProvider: import("@anidachi/protocol").RoomLobbyProvider | null = null;
let source = roomSourceCreationColumns({});
loader._load = (id, parent, main) => {
	if (id === "@/lib/anidachi-auth/session")
		return { getSession: async () => (user ? { userId: user } : null) };
	if (id === "@/lib/analytics-server-events")
		return { emitServerEvent: () => {} };
	if (id === "@/lib/anidachi-auth/db")
		return {
			getRoomById: async () => ({
				status: ended ? "ended" : "live",
				host_user_id: "host",
				lobby_provider: lobbyProvider,
				lobby_marketplace: lobbyProvider === "primevideo" ? "amazon.de" : null,
				...source,
			}),
			isRoomMember: async () => false,
			addRoomMember: async () => {
				joined++;
			},
			updateRoom: async () => {},
			roomCapabilitiesFromRoom: () => ({}),
		};
	return original(id, parent, main);
};
const { POST } = createRequire(import.meta.url)(
	"../app/api/rooms/[roomId]/join/route",
) as typeof import("../app/api/rooms/[roomId]/join/route");
after(() => {
	loader._load = original;
});
const join = (lobby?: string) =>
	POST(
		new NextRequest(
			"https://staging.anidachi.app/api/rooms/abc/join" +
				(lobby ? "?lobby=" + encodeURIComponent(lobby) : ""),
			{ method: "POST" },
		),
		{ params: Promise.resolve({ roomId: "abc" }) },
	);
test("Disney lobby invites respect membership admission and resolve the latest playback on every click", async () => {
	user = null;
	assert.equal((await join("disneyplus")).status, 401);
	assert.equal(joined, 0);
	user = "guest";
	ended = true;
	assert.equal(
		new URL((await join("disneyplus")).headers.get("location")!).origin,
		"https://staging.anidachi.app",
	);
	assert.equal(joined, 0);
	ended = false;
	const lobby = await join("disneyplus");
	assert.equal(lobby.status, 303);
	assert.equal(joined, 1);
	assert.equal(
		lobby.headers.get("location"),
		"https://www.disneyplus.com/home#anidachiRoom=abc&anidachiLobby=disneyplus",
	);
	assert.match(
		(await join("https://example.invalid")).headers.get("location")!,
		/\/room\/abc\?joined=1$/,
	);
	lobbyProvider = "disneyplus";
	assert.equal((await join()).headers.get("location"), lobby.headers.get("location"));
	lobbyProvider = "netflix";
	const netflixHome = "https://www.netflix.com/browse#anidachiRoom=abc&anidachiLobby=netflix";
	assert.equal((await join()).headers.get("location"), netflixHome);
	assert.equal((await join("disneyplus")).headers.get("location"), netflixHome);
	lobbyProvider = "primevideo";
	const primeHome = "https://www.amazon.de/gp/video/storefront#anidachiRoom=abc&anidachiLobby=primevideo";
	assert.equal((await join()).headers.get("location"), primeHome);
	assert.equal((await join("netflix")).headers.get("location"), primeHome);
	lobbyProvider = "hbomax";
	const hboHome = "https://www.hbomax.com/home#anidachiRoom=abc&anidachiLobby=hbomax";
	assert.equal((await join()).headers.get("location"), hboHome);
	assert.equal((await join("netflix")).headers.get("location"), hboHome);
	lobbyProvider = "crunchyroll";
	const crunchyHome = "https://www.crunchyroll.com/discover#anidachiRoom=abc&anidachiLobby=crunchyroll";
	assert.equal((await join()).headers.get("location"), crunchyHome);
	assert.equal((await join("crunchyroll")).headers.get("location"), crunchyHome);
	const episode = "https://www.crunchyroll.com/watch/GABC123";
	source = roomSourceCreationColumns({ sourceUrl: episode });
	assert.equal((await join("crunchyroll")).headers.get("location"), episode + "#anidachiRoom=abc");
	lobbyProvider = "youtube";
	source = roomSourceCreationColumns({});
	const youtubeHome = "https://www.youtube.com/#anidachiRoom=abc&anidachiLobby=youtube";
	assert.equal((await join()).headers.get("location"), youtubeHome);
	assert.equal((await join("youtube")).headers.get("location"), youtubeHome);
	const video = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
	source = roomSourceCreationColumns({ sourceUrl: video });
	assert.equal((await join("youtube")).headers.get("location"), video + "#anidachiRoom=abc");
	const player =
		"https://www.netflix.com/watch/80000123";
	source = roomSourceCreationColumns({ sourceUrl: player });
	assert.equal(
		(await join("disneyplus")).headers.get("location"),
		player + "#anidachiRoom=abc",
	);
	assert.equal((await join()).headers.get("location"), player + "#anidachiRoom=abc");
});
