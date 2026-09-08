import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInternalRoomEndCommand } from "./room-lifecycle";
test("nonterminal policy payload is rejected by preserved legacy terminal validator", async () => {
	const payload = {
		operation: "room_policy_v2",
		roomGeneration: 1,
		usage: [{ day: "2026-09-08", seconds: 120 }],
		settleOnly: false,
	};
	assert.equal(await parseInternalRoomEndCommand("room", payload), null);
	assert.equal(
		await parseInternalRoomEndCommand("room", { ...payload, settleOnly: true }),
		null,
	);
});
