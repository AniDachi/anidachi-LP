import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Preserve raw directed facts and publish their matching report/manifest.
// Code extraction is AST-only; semantic input is supplied by the Codex skill.
let python;
try {
	const executable = execFileSync("which", ["graphify"], {
		encoding: "utf8",
	}).trim();
	python = readFileSync(executable, "utf8")
		.split("\n")[0]
		.replace(/^#!/, "")
		.trim();
	if (!python.startsWith("/") || /\s/.test(python))
		throw new Error("Unsupported Graphify interpreter");
} catch (error) {
	console.error(`Failed to start Graphify: ${error.message}`);
	process.exit(1);
}
const script = fileURLToPath(new URL("./graphify_update.py", import.meta.url));
const child = spawn(python, [script, ...process.argv.slice(2)], {
	env: {
		...process.env,
		GRAPHIFY_NO_TIPS: "1",
	},
	stdio: "inherit",
});

child.once("error", (error) => {
	console.error(`Failed to start Graphify: ${error.message}`);
	process.exitCode = 1;
});

child.once("exit", (code, signal) => {
	if (signal) {
		console.error(`Graphify stopped by signal ${signal}.`);
		try {
			process.kill(process.pid, signal);
		} catch (error) {
			console.error(`Failed to preserve Graphify signal: ${error.message}`);
			process.exitCode = 1;
		}
		return;
	}

	process.exitCode = code ?? 1;
});
