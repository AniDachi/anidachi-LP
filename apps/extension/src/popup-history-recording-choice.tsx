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
    <section className="popup-history-recording-setting" aria-label="Watch history setting">
      <style>{styles}</style>
      <div className="popup-history-recording-row">
        <div>
          <strong>Save watch history</strong>
          <p>Save video titles, links and progress to your AniDachi account with Plus or Pro.</p>
        </div>
        <button type="button" role="switch" aria-label="Save watch history" aria-checked={loaded.enabled}
          disabled={busy} onClick={() => void update()} className="popup-history-recording-switch">
          <span />
        </button>
      </div>
      <p className="popup-history-recording-hint">Applies to this browser. Turning it off keeps your saved history.</p>
      {error && <p role="alert" className="popup-local-settings-error">{error}</p>}
    </section>
  );
}

const styles = `
.popup-history-recording-setting { padding: 8px 0 14px; color: var(--ad-text, #efe6db); }
.popup-history-recording-row { display: flex; align-items: center; gap: 16px; }
.popup-history-recording-row > div { flex: 1; min-width: 0; }
.popup-history-recording-row strong { font-size: 13px; font-weight: 600; }
.popup-history-recording-row p, .popup-history-recording-hint { margin: 5px 0 0; color: var(--ad-muted, #aaa6a1); font-size: 11px; line-height: 1.6; }
.popup-history-recording-hint { margin-top: 10px; }
.popup-history-recording-switch { flex: 0 0 44px; height: 28px; padding: 3px; border: 1px solid #65615d; border-radius: 16px; background: #373431; cursor: pointer; }
.popup-history-recording-switch span { display: block; width: 20px; height: 20px; border-radius: 50%; background: #efe6db; transition: transform 140ms ease; }
.popup-history-recording-switch[aria-checked="true"] { background: #f58d42; border-color: #f58d42; }
.popup-history-recording-switch[aria-checked="true"] span { transform: translateX(16px); background: #19140f; }
.popup-history-recording-switch:focus-visible { outline: 2px solid #ff9d54; outline-offset: 3px; }
.popup-history-recording-switch:disabled { opacity: .5; cursor: wait; }
@media (prefers-reduced-motion: reduce) { .popup-history-recording-switch span { transition: none; } }
`;
