import { useEffect } from "react";
import type { PlayerEvent, VideoAdapter } from "./source-adapters/core/types";

interface ActiveAdapterPlaybackOptions {
  active: boolean;
  adapter: VideoAdapter;
  heartbeatEnabled: boolean;
  heartbeatIntervalMs?: number;
  onAdapterEvent(event: PlayerEvent): void;
  onHeartbeat(): void;
  onSuspend(): void;
}

export function useActiveAdapterPlayback({
  active,
  adapter,
  heartbeatEnabled,
  heartbeatIntervalMs = 1500,
  onAdapterEvent,
  onHeartbeat,
  onSuspend,
}: ActiveAdapterPlaybackOptions): void {
  useEffect(() => {
    if (!active) {
      onSuspend();
    }
  }, [active, onSuspend]);

  useEffect(() => {
    if (!active) {
      return;
    }
    return adapter.subscribe(onAdapterEvent);
  }, [active, adapter, onAdapterEvent]);

  useEffect(() => {
    if (!active || !heartbeatEnabled) {
      return;
    }

    const intervalId = window.setInterval(onHeartbeat, heartbeatIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [active, heartbeatEnabled, heartbeatIntervalMs, onHeartbeat]);
}
