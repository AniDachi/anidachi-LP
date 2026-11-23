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
const join = (lobby: string) =>
	POST(
		new NextRequest(
			"https://staging.anidachi.app/api/rooms/abc/join?lobby=" +
				encodeURIComponent(lobby),
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
	const player =
		"https://www.netflix.com/watch/80000123";
	source = roomSourceCreationColumns({ sourceUrl: player });
	assert.equal(
		(await join("disneyplus")).headers.get("location"),
		player + "#anidachiRoom=abc",
	);
});
