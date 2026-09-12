import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import {
	PRE_TRANSITION_MIGRATION,
	requireDisposableTarget,
	requireTransitionAcknowledgement,
} from "./watch_history_v3_disposable_target.mjs";

const target = requireDisposableTarget();
const resetTarget = process.env.ANIDACHI_WATCH_HISTORY_RESET_TARGET;
assert.ok(
	resetTarget === "pre-transition" || resetTarget === "schema-3",
	"ANIDACHI_WATCH_HISTORY_RESET_TARGET must be pre-transition or schema-3",
);
if (resetTarget === "pre-transition") requireTransitionAcknowledgement();

const args = [
	"dlx",
	"supabase@2.111.0",
	"--workdir",
	target.workdir,
	"db",
	"reset",
	"--local",
	"--no-seed",
];
if (resetTarget === "pre-transition")
	args.push("--version", PRE_TRANSITION_MIGRATION);
const result = spawnSync("pnpm", args, {
	encoding: "utf8",
	maxBuffer: 12 * 1024 * 1024,
	stdio: "inherit",
	timeout: 120_000,
});
assert.equal(result.error, undefined, result.error?.message);
assert.equal(result.status, 0, `Disposable ${resetTarget} reset failed`);
