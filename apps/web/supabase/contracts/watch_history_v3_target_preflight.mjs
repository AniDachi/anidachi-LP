import { requireDisposableTarget } from "./watch_history_v3_disposable_target.mjs";

const target = requireDisposableTarget();
console.log(
	JSON.stringify({
		disposableTarget: "VERIFIED",
		container: target.container,
		hostPort: target.hostPort,
		project: target.project,
		workdir: target.workdir,
	}),
);
