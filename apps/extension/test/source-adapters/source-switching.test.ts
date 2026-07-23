import type { WatchSourceDescriptor } from "@anidachi/protocol";
import { describe, expect, it, vi } from "vitest";
import { ensureSourceForProvider } from "../../src/source-adapters/core/source-navigation";
import { getDefinitionForProvider } from "../../src/source-adapters/registry";

describe("provider source switching", () => {
	it("uses exactly the room provider definition", async () => {
		const definition = getDefinitionForProvider("youtube");
		expect(definition?.provider).toBe("youtube");
		expect(typeof definition?.ensureSource).toBe("function");
	});

	it("rejects a source from another provider before navigation", async () => {
		const ensureSource = vi.fn();
		const result = await ensureSourceForProvider(
			source("youtube"),
			{
				roomId: "room-123",
				roomProvider: "crunchyroll",
				signal: new AbortController().signal,
			},
			() => ({
				detect: () => null,
				ensureSource,
				id: "crunchyroll",
				priority: 200,
				provider: "crunchyroll",
			}),
		);

		expect(result).toEqual({
			status: "unsupported",
			reason: "provider-mismatch",
		});
		expect(ensureSource).not.toHaveBeenCalled();
	});

	it("rejects cross-document navigation for the generic fallback", async () => {
		const definition = getDefinitionForProvider("generic");
		const result = await definition?.ensureSource(source("generic"), {
			roomId: "room-123",
			roomProvider: "generic",
			signal: new AbortController().signal,
		});

		expect(result).toEqual({
			status: "unsupported",
			reason: "unsupported-route",
		});
	});
});

function source(
	provider: WatchSourceDescriptor["provider"],
): WatchSourceDescriptor {
	return {
		canonicalUrl: "https://example.com/watch/video",
		provider,
		sourceUrl: "https://example.com/watch/video",
		title: "Test video",
		videoFingerprint: `${provider}|video`,
	};
}
