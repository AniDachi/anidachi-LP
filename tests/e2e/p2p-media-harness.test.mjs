import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import {
	createHarnessRoomToken,
	getHarnessHostIdentity,
	getP95,
	summarizeSelectedCandidatePairs,
	TTFM_P95_BUDGET_MS,
} from "./p2p-media-harness-support.mjs";

const REPO = new URL("../..", import.meta.url);
const ROOM_ID = "harness-fixture-room";
const SECRET = "test-harness-secret-at-least-32-characters";

async function loadActualWorkerVerifier() {
	const output = await build({
		absWorkingDir: REPO.pathname,
		bundle: true,
		entryPoints: ["apps/api/src/auth.ts"],
		format: "esm",
		platform: "node",
		write: false,
	});
	const directory = await mkdtemp(join(tmpdir(), "anidachi-harness-verifier-"));
	const path = join(directory, "auth.mjs");
	await writeFile(path, output.outputFiles[0].contents);
	return {
		module: await import(pathToFileURL(path).href),
		cleanup: () => rm(directory, { force: true, recursive: true }),
	};
}

test("harness room-token fixtures cross the actual Worker verifier boundary", async () => {
	const { module, cleanup } = await loadActualWorkerVerifier();
	try {
		const nowSeconds = Math.floor(Date.now() / 1_000);
		const v2Host = getHarnessHostIdentity(4);
		assert.deepEqual(v2Host, { sub: "p0", participantSessionId: "s0" });
		const v2Token = createHarnessRoomToken({
			...v2Host,
			role: "host",
			roomId: ROOM_ID,
			secret: SECRET,
			mediaV2Size: 4,
			mediaCapabilityRevision: 1,
			nowSeconds,
		});
		assert.match(v2Token, /^[^.]+\.[^.]+\.[^.]+$/);
		const verified = await module.verifyRoomToken(v2Token, ROOM_ID, {
			ANIDACHI_JWT_SECRET: SECRET,
		});
		assert.equal(verified?.sub, "p0");
		assert.equal(verified?.participantSessionId, "s0");
		assert.equal(verified?.hostUserId, "p0");
	} finally {
		await cleanup();
	}
});

test("actual Worker rejects the former v2 ICE host fixture but accepts legacy", async () => {
	const { module, cleanup } = await loadActualWorkerVerifier();
	try {
		const nowSeconds = Math.floor(Date.now() / 1_000);
		const formerV2Token = createHarnessRoomToken({
			sub: "host",
			participantSessionId: "host-sess",
			role: "host",
			roomId: ROOM_ID,
			secret: SECRET,
			mediaV2Size: 4,
			mediaCapabilityRevision: 1,
			nowSeconds,
		});
		assert.equal(
			await module.verifyRoomToken(formerV2Token, ROOM_ID, {
				ANIDACHI_JWT_SECRET: SECRET,
			}),
			null,
		);

		const legacyHost = getHarnessHostIdentity(0);
		assert.deepEqual(legacyHost, {
			sub: "host",
			participantSessionId: "host-sess",
		});
		const legacyToken = createHarnessRoomToken({
			...legacyHost,
			role: "host",
			roomId: ROOM_ID,
			secret: SECRET,
			mediaV2Size: 0,
			nowSeconds,
		});
		assert.equal(
			(
				await module.verifyRoomToken(legacyToken, ROOM_ID, {
					ANIDACHI_JWT_SECRET: SECRET,
				})
			)?.participantSessionId,
			"host-sess",
		);
	} finally {
		await cleanup();
	}
});

test("p95 is deterministic and relay coverage cannot pass with missing pairs", () => {
	assert.equal(TTFM_P95_BUDGET_MS, 6_000);
	assert.equal(getP95([5_999, 100, 200]), 5_999);
	assert.equal(getP95([6_000]) < TTFM_P95_BUDGET_MS, false);
	assert.equal(getP95([]), null);

	const complete = summarizeSelectedCandidatePairs([
		{
			stats: {
				peers: [
					{ stats: { candidatePair: { localCandidateType: "relay" } } },
					{ stats: { candidatePair: { localCandidateType: "relay" } } },
				],
			},
		},
	]);
	assert.deepEqual(complete, {
		selectedCount: 2,
		relayCount: 2,
		selectedTypes: ["relay/?", "relay/?"],
	});
	assert.notEqual(complete.selectedCount, 0);

	const missing = summarizeSelectedCandidatePairs([
		{ stats: { peers: [{ stats: {} }] } },
	]);
	assert.deepEqual(missing, {
		selectedCount: 0,
		relayCount: 0,
		selectedTypes: [],
	});
});
