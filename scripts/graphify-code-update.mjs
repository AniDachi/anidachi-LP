import { spawn } from "node:child_process";

// Persist a normalized graph and matching report, not raw extraction JSON.
// The update command remains AST-only; clustering does not invoke an LLM.
const child = spawn("graphify", ["update", "."], {
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
