import { PopupSettingRow } from "./popup-setting-row";
import { useEffect, useRef, useState } from "react";
import { readHistoryRecordingEnabled, setHistoryRecordingChoice, subscribeHistoryRecordingChoice } from "./history-recording-choice";

export function PopupHistoryRecordingChoice({ ownerUserId }: { ownerUserId: string | null }) {
  const [loaded, setLoaded] = useState<{ owner: string; enabled: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const epoch = ++generation.current;
    let revision = 0;
    setError(null); setBusy(false);
    if (!ownerUserId) { setLoaded(null); return; }
    const refresh = async () => {
      const request = ++revision;
      try {
        const enabled = await readHistoryRecordingEnabled(ownerUserId);
        if (epoch === generation.current && request === revision) {
          setLoaded({ owner: ownerUserId, enabled }); setError(null);
        }
      } catch {
        if (epoch === generation.current && request === revision) {
          setLoaded({ owner: ownerUserId, enabled: false });
          setError("Could not read this browser's history setting. Recording stays off.");
        }
      }
    };
    const unsubscribe = subscribeHistoryRecordingChoice(ownerUserId, () => { void refresh(); });
    void refresh();
    return () => { ++generation.current; unsubscribe(); };
  }, [ownerUserId]);

  if (!ownerUserId || loaded?.owner !== ownerUserId) return null;
  const update = async () => {
    if (busy) return;
    const epoch = generation.current;
    setBusy(true); setError(null);
    try {
      await setHistoryRecordingChoice(ownerUserId, !loaded.enabled);
      const enabled = await readHistoryRecordingEnabled(ownerUserId);
      if (epoch !== generation.current) return;
      setLoaded({ owner: ownerUserId, enabled });
    } catch (cause) {
      if (epoch === generation.current) setError(cause instanceof Error ? cause.message : "Could not save. Please try again.");
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  };
  return (
    <>
      <PopupSettingRow label="Save watch history" description="Save titles, links and progress to your account with Plus or Pro."
        checked={loaded.enabled} busy={busy} onChange={() => void update()} />
      {error && <p role="alert" className="popup-local-settings-error">{error}</p>}
    </>
  );
}
