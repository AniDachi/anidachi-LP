import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "wxt/utils/storage";
import {
  getDefaultInterfacePreferences,
  INTERFACE_PREFERENCES_STORAGE_KEY,
  type InterfacePreferencesPatch,
  type InterfacePreferencesV1,
  parseInterfacePreferences,
  updateInterfacePreferences,
} from "./interface-preferences";

export interface InterfacePreferencesStorage {
  read(): Promise<unknown>;
  write(preferences: InterfacePreferencesV1): Promise<void>;
}

export interface InterfacePreferencesController {
  error: string | null;
  preferences: InterfacePreferencesV1;
  ready: boolean;
  saving: boolean;
  update(patch: InterfacePreferencesPatch): void;
}

const defaultInterfacePreferencesStorage: InterfacePreferencesStorage = {
  read: () => storage.getItem<unknown>(INTERFACE_PREFERENCES_STORAGE_KEY),
  write: (preferences) =>
    storage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, preferences),
};

export function useInterfacePreferences(
  preferenceStorage: InterfacePreferencesStorage = defaultInterfacePreferencesStorage,
): InterfacePreferencesController {
  const [preferences, setPreferences] = useState(getDefaultInterfacePreferences);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const preferencesRef = useRef(preferences);
  const appliedRef = useRef(preferences);
  const revisionRef = useRef(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    void preferenceStorage
      .read()
      .then((value) => {
        if (cancelled || !mountedRef.current) {
          return;
        }

        const parsed = parseInterfacePreferences(value);
        preferencesRef.current = parsed;
        appliedRef.current = parsed;
        setPreferences(parsed);
        setReady(true);
        setError(null);
      })
      .catch(() => {
        if (cancelled || !mountedRef.current) {
          return;
        }

        const defaults = getDefaultInterfacePreferences();
        preferencesRef.current = defaults;
        appliedRef.current = defaults;
        setPreferences(defaults);
        setReady(true);
        setError("Couldn't load interface settings.");
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [preferenceStorage]);

  const update = useCallback(
    (patch: InterfacePreferencesPatch) => {
      const normalized = updateInterfacePreferences(preferencesRef.current, patch);
      const revision = ++revisionRef.current;
      preferencesRef.current = normalized;
      setPreferences(normalized);
      setSaving(true);
      setError(null);

      writeQueueRef.current = writeQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            await preferenceStorage.write(normalized);
            appliedRef.current = normalized;
            if (mountedRef.current && revision === revisionRef.current) {
              setSaving(false);
              setError(null);
            }
          } catch {
            if (mountedRef.current && revision === revisionRef.current) {
              preferencesRef.current = appliedRef.current;
              setPreferences(appliedRef.current);
              setSaving(false);
              setError("Couldn't save interface settings.");
            }
          }
        });
    },
    [preferenceStorage],
  );

  return {
    error,
    preferences,
    ready,
    saving,
    update,
  };
}
