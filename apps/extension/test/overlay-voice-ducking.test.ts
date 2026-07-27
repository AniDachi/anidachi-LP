import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { beginVoiceReactionDucking } from "../src/overlay-voice-ducking";

const sourceDirectory = resolve(process.cwd(), "src");
const liveVoiceRuntimeFiles = [
	"ghost-cam.ts",
	"overlay-app.tsx",
	"overlay-voice-session.ts",
	"p2p-media.ts",
] as const;

describe("overlay voice ducking", () => {
	it("ducks for Dictate and restores the player exactly once", () => {
		const restore = vi.fn();
		const adapter = {
			duckVolume: vi.fn(() => restore),
		};

		const stopDucking = beginVoiceReactionDucking(adapter);

		expect(adapter.duckVolume).toHaveBeenCalledTimes(1);
		expect(adapter.duckVolume).toHaveBeenCalledWith();

		stopDucking();
		stopDucking();

		expect(restore).toHaveBeenCalledTimes(1);
	});

	it("keeps direct player ducking out of the live P2P voice runtime", () => {
		for (const file of liveVoiceRuntimeFiles) {
			const source = readFileSync(resolve(sourceDirectory, file), "utf8");
			expect(source, file).not.toMatch(/adapter\.duckVolume\s*\(/);
		}
	});
});
