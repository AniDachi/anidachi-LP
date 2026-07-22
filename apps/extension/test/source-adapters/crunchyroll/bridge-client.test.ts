import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCrunchyrollMainCommand } from "../../../src/source-adapters/crunchyroll/bridge-client";
import { CRUNCHYROLL_CONTROL_RESULT_SOURCE } from "../../../src/source-adapters/crunchyroll/bridge-contract";

describe("Crunchyroll MAIN-world bridge client", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("resolves only the matching request id and ignores unrelated window messages", async () => {
		const postMessage = vi.spyOn(window, "postMessage");
		const result = runCrunchyrollMainCommand("play", {}, 450);
		const request = postMessage.mock.calls[0]?.[0] as { id: string };

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					action: "play",
					id: "other-request",
					ok: true,
					source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
				},
				source: window,
			}),
		);
		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					action: "play",
					id: request.id,
					ok: true,
					source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
				},
				source: window,
			}),
		);

		await expect(result).resolves.toMatchObject({ id: request.id, ok: true });
	});

	it("returns the existing timeout result and cleans up its listener", async () => {
		const removeEventListener = vi.spyOn(window, "removeEventListener");
		const result = runCrunchyrollMainCommand("seek", { time: 42 }, 1000);

		await vi.advanceTimersByTimeAsync(1000);

		await expect(result).resolves.toMatchObject({
			action: "seek",
			error: "MAIN_BRIDGE_TIMEOUT",
			ok: false,
			source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
			timedOut: true,
		});
		expect(removeEventListener).toHaveBeenCalledWith(
			"message",
			expect.any(Function),
		);
	});

	it("cleans up after a matching result without waiting for the timeout", async () => {
		const postMessage = vi.spyOn(window, "postMessage");
		const removeEventListener = vi.spyOn(window, "removeEventListener");
		const result = runCrunchyrollMainCommand("pause", {}, 450);
		const request = postMessage.mock.calls[0]?.[0] as { id: string };

		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					action: "pause",
					id: request.id,
					ok: true,
					source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
				},
				source: window,
			}),
		);

		await expect(result).resolves.toMatchObject({ id: request.id, ok: true });
		expect(removeEventListener).toHaveBeenCalledWith(
			"message",
			expect.any(Function),
		);
	});
});
