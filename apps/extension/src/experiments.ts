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
