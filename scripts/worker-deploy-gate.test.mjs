import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertWorkerDeploymentAuthorized } from "./worker-deploy-gate.mjs";

const sha = "a".repeat(40);
const main = { refName: "main", eventName: "workflow_dispatch", sha };

test("a main push never deploys production even if an acknowledgement is present", () => {
  assert.throws(() => assertWorkerDeploymentAuthorized({
    ...main, eventName: "push", confirmedProductionSha: sha,
  }), /manual/);
});

test("manual production needs the complete exact commit whose prerequisites were checked", () => {
  for (const confirmedProductionSha of [undefined, "", sha.slice(0, 8), "b".repeat(40), `${sha}\n`]) {
    assert.throws(() => assertWorkerDeploymentAuthorized({ ...main, confirmedProductionSha }), /commit/);
  }
  assert.doesNotThrow(() => assertWorkerDeploymentAuthorized({ ...main, confirmedProductionSha: sha }));
});

test("staging push and manual deployment retain their normal behavior", () => {
  for (const eventName of ["push", "workflow_dispatch"]) {
    assert.doesNotThrow(() => assertWorkerDeploymentAuthorized({ refName: "staging", eventName, sha }));
  }
});

test("feature branches and unexpected triggers cannot deploy either environment", () => {
  assert.throws(() => assertWorkerDeploymentAuthorized({ ...main, refName: "codex/feature", confirmedProductionSha: sha }), /branch/);
  assert.throws(() => assertWorkerDeploymentAuthorized({ refName: "staging", eventName: "pull_request", sha }), /trigger/);
});

test("the workflow CLI fails closed and accepts only the acknowledged production commit", () => {
  for (const acknowledgement of ["", "b".repeat(40), sha]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./worker-deploy-gate.mjs", import.meta.url))], {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_REF_NAME: "main",
        GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_SHA: sha,
        CONFIRMED_PRODUCTION_SHA: acknowledgement,
      },
    });
    assert.equal(result.status, acknowledgement === sha ? 0 : 1);
    if (acknowledgement !== sha) assert.match(result.stderr, /exact full main commit/);
  }
});
