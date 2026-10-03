import { pathToFileURL } from "node:url";

// This is an operator acknowledgement, not a remote schema/Web health check.
export function assertWorkerDeploymentAuthorized({ refName, eventName, sha, confirmedProductionSha }) {
  if (refName !== "staging" && refName !== "main") {
    throw new Error("Unsupported deployment branch");
  }
  if (refName === "main") {
    if (eventName !== "workflow_dispatch") {
      throw new Error("Production Worker deployment requires a manual workflow dispatch");
    }
    if (!/^[0-9a-f]{40}$/.test(confirmedProductionSha ?? "") || confirmedProductionSha !== sha) {
      throw new Error("Confirm the exact full main commit after verifying production schema and compatible Web");
    }
  } else if (eventName !== "push" && eventName !== "workflow_dispatch") {
    throw new Error("Unsupported staging deployment trigger");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assertWorkerDeploymentAuthorized({
      refName: process.env.GITHUB_REF_NAME,
      eventName: process.env.GITHUB_EVENT_NAME,
      sha: process.env.GITHUB_SHA,
      confirmedProductionSha: process.env.CONFIRMED_PRODUCTION_SHA,
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
