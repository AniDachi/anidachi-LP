export const HOLD_FIRE_SUPER_REACTION_EXPERIMENT = {
  id: "hold-fire-super-reaction",
  storageKey: "local:experiment:holdFireSuperReaction",
  defaultEnabled: import.meta.env.WXT_EXPERIMENT_HOLD_FIRE_SUPER_REACTION !== "false",
  emoji: "🔥",
  effect: "atomic-fire",
  transportMarker: "__anidachi_atomic_fire__",
  revealDelayMs: 500,
  chargeMs: 1000,
} as const;

export type MediaTransportExperiment = "p2p" | "livekit";

export const P2P_MEDIA_TRANSPORT_EXPERIMENT = {
  id: "p2p-media-transport",
  storageKey: "local:experiment:mediaTransport",
  defaultTransport: import.meta.env.WXT_MEDIA_TRANSPORT === "livekit" ? "livekit" : "p2p",
} as const satisfies {
  id: string;
  storageKey: string;
  defaultTransport: MediaTransportExperiment;
};

export function normalizeExperimentFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (["1", "true", "on", "enabled"].includes(value.toLowerCase())) {
      return true;
    }

    if (["0", "false", "off", "disabled"].includes(value.toLowerCase())) {
      return false;
    }
  }

  return fallback;
}

export function normalizeMediaTransportExperiment(
  value: unknown,
  fallback: MediaTransportExperiment,
): MediaTransportExperiment {
  if (value === "livekit" || value === "p2p") {
    return value;
  }

  return fallback;
}
