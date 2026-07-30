export const INTERFACE_PREFERENCES_STORAGE_KEY =
  "local:interfacePreferencesV1" as const;
export const INTERFACE_PREFERENCES_VERSION = 1 as const;

export type MainControlVisibility = "auto-hide" | "always-visible";
export type ParticipantPillVisibility = "smart" | "always-visible";

export interface InterfacePreferencesV1 {
  version: typeof INTERFACE_PREFERENCES_VERSION;
  mainControlVisibility: MainControlVisibility;
  participantPillVisibility: ParticipantPillVisibility;
}

export type InterfacePreferencesPatch = Partial<
  Pick<
    InterfacePreferencesV1,
    "mainControlVisibility" | "participantPillVisibility"
  >
>;

export function getDefaultInterfacePreferences(): InterfacePreferencesV1 {
  return {
    version: INTERFACE_PREFERENCES_VERSION,
    mainControlVisibility: "auto-hide",
    participantPillVisibility: "smart",
  };
}

export function parseInterfacePreferences(value: unknown): InterfacePreferencesV1 {
  const defaults = getDefaultInterfacePreferences();
  if (!isRecord(value) || value.version !== INTERFACE_PREFERENCES_VERSION) {
    return defaults;
  }

  return {
    version: INTERFACE_PREFERENCES_VERSION,
    mainControlVisibility:
      value.mainControlVisibility === "auto-hide" ||
      value.mainControlVisibility === "always-visible"
        ? value.mainControlVisibility
        : defaults.mainControlVisibility,
    participantPillVisibility:
      value.participantPillVisibility === "smart" ||
      value.participantPillVisibility === "always-visible"
        ? value.participantPillVisibility
        : defaults.participantPillVisibility,
  };
}

export function updateInterfacePreferences(
  current: InterfacePreferencesV1,
  patch: InterfacePreferencesPatch,
): InterfacePreferencesV1 {
  return parseInterfacePreferences({
    ...current,
    ...patch,
    version: INTERFACE_PREFERENCES_VERSION,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
