import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
	db: new URL("./db.ts", import.meta.url),
	mainRoute: new URL("../../app/api/rooms/route.ts", import.meta.url),
	statusRoute: new URL(
		"../../app/api/rooms/[roomId]/route.ts",
		import.meta.url,
	),
	joinRoute: new URL(
		"../../app/api/rooms/[roomId]/join/route.ts",
		import.meta.url,
	),
	reloadPage: new URL("../../app/room/[roomId]/page.tsx", import.meta.url),
	internalRoute: new URL(
		"../../app/api/internal/rooms/[roomId]/source/route.ts",
		import.meta.url,
	),
};

test("production active-room create keeps canonical source columns in its atomic RPC", async () => {
	const source = await readFile(files.db, "utf8");
	const createRoomWithActiveSession = section(
		source,
		"export async function createRoomWithActiveSession",
		"export async function claimActiveRoomSession",
	);

	assert.ok(
		createRoomWithActiveSession.indexOf("roomSourceCreationColumns") <
			createRoomWithActiveSession.indexOf(
				'.rpc("create_room_with_active_session_v1"',
			),
	);
	assert.match(
		createRoomWithActiveSession,
		/p_source_provider: sourceColumns\.source_provider/,
	);
	assert.match(
		createRoomWithActiveSession,
		/p_source_generation: sourceColumns\.source_generation/,
	);
});

test("production persistence calls the exact RPC and shared argument/error/result boundaries", async () => {
	const source = await readFile(files.db, "utf8");
	const persist = section(
		source,
		"export async function persistRoomSource",
		"export function roomCapabilitiesFromRoom",
	);

	assert.match(persist, /\.rpc\(\s*["']persist_room_source_v1["']/);
	assert.match(persist, /roomSourcePersistenceRpcArguments\(callback\)/);
	assert.match(
		persist,
		/roomSourcePersistenceErrorFromDatabase\(result\.error\)/,
	);
	assert.match(
		persist,
		/parseRoomSourcePersistenceRpcResult\([\s\S]*callback\.sourceGeneration/,
	);
});

test("main room route uses the empty-aware parser before atomic active-room creation", async () => {
	const source = await readFile(files.mainRoute, "utf8");

	assert.match(source, /handleRoomCreateRequestBody\(\{/);
	assert.match(source, /readBody: \(\) => request\.text\(\)/);
	assert.match(source, /create: async \(input\) => \{/);
	assert.match(source, /createRoomWithActiveSession\(\{/);
	assert.match(source, /participantSessionId,/);
	assert.doesNotMatch(source, /createRoom\(\{/);
	assert.match(source, /if \(!creation\.ok\)[\s\S]*creation\.body/);
	assert.doesNotMatch(source, /await request\.json\(\)/);
});

test("status, join, and reload all use the shared fail-closed durable source", async () => {
	const [status, join, reload] = await Promise.all([
		readFile(files.statusRoute, "utf8"),
		readFile(files.joinRoute, "utf8"),
		readFile(files.reloadPage, "utf8"),
	]);

	assert.match(status, /deriveDurableRoomSource\(room\)/);
	assert.match(status, /sourceProvider: source\?\.source\.provider \?\? null/);
	assert.match(
		status,
		/sourceGeneration: source\?\.sourceGeneration \?\? null/,
	);
	for (const source of [join, reload]) {
		assert.match(source, /deriveDurableRoomSource\(room\)/);
		assert.match(source, /buildRoomSourceLaunchUrl\(source\.source, roomId\)/);
	}
});

test("internal Next route is a narrow adapter around authorization, JSON, and DB persistence", async () => {
	const source = await readFile(files.internalRoute, "utf8");

	assert.match(source, /handleInternalRoomSourcePost\(\{/);
	assert.match(
		source,
		/authorization: request\.headers\.get\(["']authorization["']\)/,
	);
	assert.match(source, /roomId,/);
	assert.match(source, /readJson: \(\) => request\.json\(\)/);
	assert.match(source, /persist: persistRoomSource/);
});

function section(source: string, start: string, end: string): string {
	const startIndex = source.indexOf(start);
	const endIndex = source.indexOf(end, startIndex + start.length);
	assert.notEqual(startIndex, -1, `missing section start: ${start}`);
	assert.notEqual(endIndex, -1, `missing section end: ${end}`);
	return source.slice(startIndex, endIndex);
}
