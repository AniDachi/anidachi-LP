"use client";
import { useEffect, useRef, useState } from "react";
import { UNINSTALL_REASONS, type UninstallReason } from "../../lib/anidachi-auth/uninstall-offer";

const KEY = "anidachi.uninstall.feedback.v1";
const labels = ["I don’t use it enough", "Something didn’t work", "Too expensive", "Missing a feature", "Other"];
type Draft = { reason: UninstallReason | ""; note: string; expanded: boolean };

export function UninstallSurvey() {
  const [draft, setDraft] = useState<Draft>({ reason: "", note: "", expanded: false });
  const [restored, setRestored] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "saved">("idle");
  const [error, setError] = useState("");
  const [height, setHeight] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const thanks = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const submission = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (raw && raw.length < 4096) {
        const value = JSON.parse(raw);
        if (value?.version === 1 && UNINSTALL_REASONS.includes(value.reason) &&
          typeof value.note === "string" && value.note.length <= 500 &&
          typeof value.expanded === "boolean") setDraft({ reason: value.reason, note: value.note, expanded: value.expanded });
      }
    } catch { /* Storage is optional; never submit a draft implicitly. */ }
    setRestored(true);
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!restored || state === "saved") return;
    try {
      if (!draft.reason && !draft.note) window.sessionStorage.removeItem(KEY);
      else window.sessionStorage.setItem(KEY, JSON.stringify({ version: 1, ...draft }));
    } catch { /* A blocked storage area must not block feedback or login. */ }
  }, [draft, restored, state]);
  useEffect(() => { if (state === "saved") thanks.current?.focus(); }, [state]);
  function update(next: Partial<Draft>) {
    submission.current = null;
    setDraft((old) => ({ ...old, ...next }));
    setError("");
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || !draft.reason || state === "saved") return;
    busy.current = true;
    setState("sending"); setError("");
    setHeight(form.current?.getBoundingClientRect().height ?? 0);
    submission.current ??= window.crypto.randomUUID();
    try {
      const response = await fetch("/api/uninstall/feedback", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.current, reason: draft.reason, ...(draft.note ? { note: draft.note } : {}) }),
      });
      const result = await response.json();
      if (!response.ok || result.saved !== true) throw new Error();
      if (!mounted.current) return;
      try { window.sessionStorage.removeItem(KEY); } catch { /* optional */ }
      setState("saved");
    } catch {
      if (mounted.current) { setState("idle"); setError("We couldn’t send your feedback. Please try again."); }
    } finally { busy.current = false; }
  }
  return <section className="uninstall-survey" aria-labelledby="uninstall-survey-title">
    {state === "saved" ? <div className="uninstall-thanks" role="status" ref={thanks} tabIndex={-1} style={{ minHeight: height }}>
      <span className="uninstall-success-icon" aria-hidden="true">✓</span><h2>Thanks for your feedback.</h2>
    </div> : <form ref={form} onSubmit={send}>
      <fieldset disabled={state === "sending"}>
        <legend id="uninstall-survey-title">Why did you uninstall?</legend>
        <div className="uninstall-reasons">{UNINSTALL_REASONS.map((reason, index) => <label className="uninstall-reason" key={reason}>
          <input type="radio" name="reason" value={reason} checked={draft.reason === reason} onChange={() => update({ reason, ...(reason === "other" ? { expanded: true } : {}) })} />
          <span>{labels[index]}</span>
        </label>)}</div>
        {draft.expanded ? <div className="uninstall-note">
          <label htmlFor="uninstall-note">Add a note</label>
          <textarea id="uninstall-note" maxLength={500} rows={3} value={draft.note} onChange={(e) => update({ note: e.target.value.slice(0, 500) })} placeholder="Tell us a little more…" />
          <div className="uninstall-note-footer"><span>Please don’t include personal information.</span><span>{draft.note.length} / 500</span></div>
        </div> : draft.reason ? <button type="button" className="uninstall-note-toggle" onClick={() => update({ expanded: true })}>Add a note</button> : null}
        <div className="uninstall-submit"><button className="uninstall-secondary" disabled={!draft.reason || state === "sending"} type="submit">{state === "sending" ? "Sending…" : "Send feedback"}</button></div>
      </fieldset>
      {error ? <p className="uninstall-error" role="alert">{error}</p> : null}
    </form>}
  </section>;
}
