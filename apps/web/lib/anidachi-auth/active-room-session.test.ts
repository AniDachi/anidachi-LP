import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ActiveRoomSessionDatabaseError,
	parseActiveRoomAssignmentRow,
  parseActiveRoomClaimRpcResult,
  parseActiveRoomCreateRpcResult,
  parseActiveRoomReleaseRpcResult,
  parseHostLobbyEndRpcResult,
} from "./active-room-session";

const activeRoom = {
  roomId: "room-one",
  role: "member",
  provider: "youtube",
  title: "A safe title",
};

test("active assignment lookup accepts only the exact server-owned identity", () => {
	assert.equal(parseActiveRoomAssignmentRow(null), null);
	assert.deepEqual(
		parseActiveRoomAssignmentRow({
			user_id: "11111111-1111-4111-8111-111111111111",
			room_id: "room-one",
			role: "member",
			participant_session_id: "server-session-one",
		}),
		{
			userId: "11111111-1111-4111-8111-111111111111",
			roomId: "room-one",
			role: "member",
			participantSessionId: "server-session-one",
		},
	);
	for (const value of [
		{
			user_id: "user",
			room_id: "room-one",
			role: "viewer",
			participant_session_id: "s",
		},
		{
			user_id: "user",
			room_id: "",
			role: "member",
			participant_session_id: "s",
		},
		{
			user_id: "user",
			room_id: "room-one",
			role: "member",
			participant_session_id: "",
		},
	]) {
		assert.throws(
			() => parseActiveRoomAssignmentRow(value),
			ActiveRoomSessionDatabaseError,
		);
	}
});

test("create parser accepts one claimed room record", () => {
  assert.deepEqual(
    parseActiveRoomCreateRpcResult([
      {
        outcome: "claimed",
        room_record: { room_id: "room-one", status: "lobby" },
        active_room: null,
      },
    ]),
    {
      outcome: "claimed",
      roomRecord: { room_id: "room-one", status: "lobby" },
    },
  );
});

test("create parser accepts idempotent reuse and a structured conflict", () => {
  assert.equal(
    parseActiveRoomCreateRpcResult([
      {
        outcome: "reused",
        room_record: { room_id: "room-one" },
        active_room: null,
      },
    ]).outcome,
    "reused",
  );

  assert.deepEqual(
    parseActiveRoomCreateRpcResult([
      {
        outcome: "conflict",
        room_record: null,
        active_room: activeRoom,
      },
    ]),
    { outcome: "conflict", activeRoom },
  );
});

test("claim and release parsers preserve only the documented outcomes", () => {
  assert.deepEqual(
    parseActiveRoomClaimRpcResult([
      { outcome: "claimed", active_room: null },
    ]),
    { outcome: "claimed" },
  );
  assert.deepEqual(
    parseActiveRoomClaimRpcResult([
      { outcome: "conflict", active_room: activeRoom },
    ]),
    { outcome: "conflict", activeRoom },
  );
  assert.deepEqual(
    parseActiveRoomReleaseRpcResult([{ outcome: "released" }]),
    { outcome: "released" },
  );
  assert.deepEqual(
    parseActiveRoomReleaseRpcResult([{ outcome: "stale" }]),
    { outcome: "stale" },
  );
  assert.deepEqual(
    parseHostLobbyEndRpcResult([{ outcome: "room_ended" }]),
    { outcome: "room_ended" },
  );
  assert.deepEqual(
    parseHostLobbyEndRpcResult([{ outcome: "stale" }]),
    { outcome: "stale" },
  );
});

test("malformed RPC rows fail closed instead of allowing room admission", () => {
  const malformedValues = [
    null,
    [],
    [{ outcome: "claimed", room_record: null, active_room: null }],
    [
      {
        outcome: "claimed",
        room_record: { room_id: "room-one" },
        active_room: null,
        extra: true,
      },
    ],
    [
      {
        outcome: "conflict",
        room_record: null,
        active_room: { ...activeRoom, provider: "netflix" },
      },
    ],
    [
      {
        outcome: "conflict",
        room_record: null,
        active_room: { ...activeRoom, roomId: "x".repeat(129) },
      },
    ],
  ];

  for (const value of malformedValues) {
    assert.throws(
      () => parseActiveRoomCreateRpcResult(value),
      ActiveRoomSessionDatabaseError,
    );
  }

  assert.throws(
    () => parseActiveRoomClaimRpcResult([{ outcome: "released", active_room: null }]),
    ActiveRoomSessionDatabaseError,
  );
  assert.throws(
    () => parseActiveRoomReleaseRpcResult([{ outcome: "claimed" }]),
    ActiveRoomSessionDatabaseError,
  );
  assert.throws(
    () => parseHostLobbyEndRpcResult([{ outcome: "released" }]),
    ActiveRoomSessionDatabaseError,
  );
});

test("database helpers use only the atomic server RPCs for assignment changes", () => {
  const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
  assert.match(source, /export async function createRoomWithActiveSession/);
  assert.match(source, /\.rpc\("create_room_with_active_session_v1"/);
  assert.match(source, /parseActiveRoomCreateRpcResult\(result\.data\)/);
  assert.match(source, /export async function claimActiveRoomSession/);
  assert.match(source, /\.rpc\("claim_active_room_session_v1"/);
  assert.match(source, /parseActiveRoomClaimRpcResult\(result\.data\)/);
  assert.match(source, /export async function releaseActiveRoomSession/);
  assert.match(source, /\.rpc\("release_active_room_session_v1"/);
  assert.match(source, /parseActiveRoomReleaseRpcResult\(result\.data\)/);
  assert.match(source, /export async function endHostLobbyForActiveSession/);
  assert.match(source, /\.rpc\("end_host_lobby_for_active_session_v1"/);
  assert.match(source, /parseHostLobbyEndRpcResult\(result\.data\)/);
  assert.doesNotMatch(
    source,
    /\.from\("active_room_sessions"\)[\s\S]{0,300}\.(insert|update|delete)\(/,
  );
});

test("room creation reports an active assignment without implicitly departing it", () => {
	const source = readFileSync(
		new URL("../../app/api/rooms/route.ts", import.meta.url),
		"utf8",
	);
	assert.match(source, /admission\.outcome === "conflict"/);
	assert.match(source, /activeRoomConflictResponse\(admission\.activeRoom\)/);
	assert.doesNotMatch(source, /handleActiveRoomRecoveryDeparture/);
	assert.doesNotMatch(source, /syncParticipant(?:Departure|Detach)ToWorker/);
	assert.doesNotMatch(source, /active-session\/depart/);
});
