import type { VideoAdapter } from "./source-adapters/core/types";

export function beginVoiceReactionDucking(
	adapter: Pick<VideoAdapter, "duckVolume">,
): () => void {
	const restorePlayerVolume = adapter.duckVolume();
	let restored = false;

	return () => {
		if (restored) {
			return;
		}
		restored = true;
		restorePlayerVolume();
	};
}
