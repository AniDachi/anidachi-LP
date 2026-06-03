const ANIDACHI_LAUNCH_INTENT_KEY = "anidachi:launch-intent";
const LAUNCH_INTENT_MAX_AGE_MS = 45_000;

export interface AnidachiLaunchIntent {
  autoCreateRoom: boolean;
  createdAt: number;
  source: "crunchyroll-launcher";
}

export function requestAnidachiLaunchIntent(intent: Omit<AnidachiLaunchIntent, "createdAt">): void {
  try {
    sessionStorage.setItem(
      ANIDACHI_LAUNCH_INTENT_KEY,
      JSON.stringify({
        ...intent,
        createdAt: Date.now(),
      }),
    );
  } catch {
    // Best-effort handoff from catalog pages to the watch overlay.
  }
}

export function consumeAnidachiLaunchIntent(): AnidachiLaunchIntent | null {
  try {
    const raw = sessionStorage.getItem(ANIDACHI_LAUNCH_INTENT_KEY);
    sessionStorage.removeItem(ANIDACHI_LAUNCH_INTENT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AnidachiLaunchIntent>;
    if (
      parsed.source !== "crunchyroll-launcher" ||
      typeof parsed.createdAt !== "number" ||
      Date.now() - parsed.createdAt > LAUNCH_INTENT_MAX_AGE_MS
    ) {
      return null;
    }

    return {
      autoCreateRoom: parsed.autoCreateRoom !== false,
      createdAt: parsed.createdAt,
      source: parsed.source,
    };
  } catch {
    return null;
  }
}
