import { spawn } from "node:child_process";

const child = spawn("graphify", ["update", ".", "--no-cluster"], {
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
