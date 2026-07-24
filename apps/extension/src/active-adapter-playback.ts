import { useEffect } from "react";
import type { PlaybackSyncController } from "./playback-sync-controller";
import type { VideoAdapter } from "./source-adapters/core/types";

interface ActiveAdapterPlaybackOptions {
	active: boolean;
	adapter: VideoAdapter;
	controller: Pick<PlaybackSyncController, "bindAdapter" | "suspend">;
}

export function useActiveAdapterPlayback({
	active,
	adapter,
	controller,
}: ActiveAdapterPlaybackOptions): void {
	useEffect(() => {
		if (active) {
			controller.bindAdapter(adapter);
		} else {
			controller.suspend();
		}
	}, [active, adapter, controller]);

	useEffect(() => () => controller.suspend(), [controller]);
}
