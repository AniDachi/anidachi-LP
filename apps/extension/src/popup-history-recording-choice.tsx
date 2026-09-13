import { useEffect, useRef, useState } from "react";
import { WEB_HTTP_BASE } from "./constants";
import {
  readHistoryRecordingChoice, setHistoryRecordingChoice, subscribeHistoryRecordingChoice,
  type HistoryRecordingChoice,
} from "./history-recording-choice";

export function PopupHistoryRecordingChoice({ ownerUserId, mode = "notice", paid = true }: {
  ownerUserId: string | null;
  mode?: "notice" | "settings";
  paid?: boolean;
}) {
  const [loaded, setLoaded] = useState<{ owner: string; choice: HistoryRecordingChoice | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const epoch = ++generation.current;
    let revision = 0;
    setError(null); setBusy(false); setReview(false);
    if (!ownerUserId) { setLoaded(null); return; }
    const refresh = async () => {
      const request = ++revision;
      try {
        const choice = await readHistoryRecordingChoice(ownerUserId);
        if (epoch === generation.current && request === revision) {
          setLoaded({ owner: ownerUserId, choice }); setError(null);
        }
      } catch {
        if (epoch === generation.current && request === revision) {
          setLoaded({ owner: ownerUserId, choice: null });
          setError("Could not read this browser's history setting. Recording stays off.");
        }
      }
    };
    const unsubscribe = subscribeHistoryRecordingChoice(ownerUserId, () => { void refresh(); });
    void refresh();
    return () => { ++generation.current; unsubscribe(); };
  }, [ownerUserId]);

  if (!ownerUserId || loaded?.owner !== ownerUserId) return null;
  const choice = loaded.choice;
  if (mode === "notice" && (choice?.enabled || !paid)) return null;
  const update = async (enabled: boolean) => {
    if (busy) return;
    const epoch = generation.current;
    setBusy(true); setError(null);
    try {
      await setHistoryRecordingChoice(ownerUserId, enabled);
      const next = await readHistoryRecordingChoice(ownerUserId);
      if (epoch !== generation.current) return;
      setLoaded({ owner: ownerUserId, choice: next }); setReview(false);
    } catch (cause) {
      if (epoch === generation.current) setError(cause instanceof Error ? cause.message : "Could not save. Please try again.");
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  };
  const compact = mode === "notice" && choice?.enabled === false && !review;
  return (
    <section className="popup-history-consent" aria-label="Personal history recording">
      <style>{styles}</style>
      {compact ? <>
        <span>History recording is off in this browser.</span>
        <button type="button" onClick={() => setReview(true)}>Review</button>
      </> : <>
        <strong>{mode === "notice" ? "Save your watch progress?" : "Personal history · This browser"}</strong>
        <p>AniDachi saves video URLs, titles, episodes and playback position to your account on supported sites, both alone and in rooms.</p>
        <p>Recording needs Plus or Pro. YouTube also needs its separate switch in Settings. You can stop recording in Settings; saved history stays available.</p>
        <a href={`${WEB_HTTP_BASE}/privacy`} target="_blank" rel="noreferrer">Privacy policy</a>
        <div className="popup-history-consent-actions">
          {choice?.enabled ? (
            <button type="button" disabled={busy} onClick={() => void update(false)}>Stop recording in this browser</button>
          ) : <>
            <button type="button" className="popup-history-consent-primary" disabled={busy} onClick={() => void update(true)}>{busy ? "Saving..." : "Allow recording"}</button>
            {mode === "notice" && <button type="button" disabled={busy} onClick={() => void update(false)}>Not now</button>}
          </>}
        </div>
      </>}
      {error && <p role="alert" className="popup-local-settings-error">{error}</p>}
    </section>
  );
}

const styles = `
.popup-history-consent { margin: 8px 0 14px; padding: 12px 14px; border: 1px solid rgba(239,230,219,.13); border-radius: 14px; color: #aaa6a1; font-size: 12px; line-height: 1.5; }
.popup-history-consent strong { display: block; color: #efe6db; font-size: 13px; }
.popup-history-consent p { margin: 7px 0; }
.popup-history-consent a { color: #ddaa7b; text-underline-offset: 3px; }
.popup-history-consent button { padding: 7px 11px; border: 0; background: transparent; border-radius: 999px; color: #efe6db; font: inherit; cursor: pointer; }
.popup-history-consent button:hover { background: rgba(239,230,219,.08); }
.popup-history-consent button:focus-visible, .popup-history-consent a:focus-visible { outline: 2px solid #ff9d54; outline-offset: 3px; }
.popup-history-consent button:disabled { opacity: .5; cursor: wait; }
.popup-history-consent-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 11px; }
.popup-history-consent button.popup-history-consent-primary { background: #efe6db; color: #1a1713; font-weight: 600; }
`;
