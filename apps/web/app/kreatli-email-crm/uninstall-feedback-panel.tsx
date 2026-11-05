"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseFeedbackPage, feedbackReasonLabels, type FeedbackItem } from "@/lib/kreatli-crm/uninstall-feedback-shared";

export function UninstallFeedbackPanel() {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const request = useRef<AbortController | null>(null);
  const lastRequest = useRef<{ cursor: string | null; append: boolean }>({ cursor: null, append: false });

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    lastRequest.current = { cursor, append };
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/kreatli-crm/uninstall-feedback${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) { setItems(null); setNextCursor(null); setSignedOut(true); return; }
      if (!response.ok) throw new Error();
      const page = parseFeedbackPage(await response.json());
      if (controller.signal.aborted) return;
      setItems(previous => append
        ? [...new Map([...(previous ?? []), ...page.items].map(item => [item.id, item])).values()]
        : page.items);
      setNextCursor(page.nextCursor);
      setSignedOut(false);
    } catch {
      if (!controller.signal.aborted) setError("Couldn’t load responses. Please try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, []);
  useEffect(() => { void load(null, false); return () => request.current?.abort(); }, [load]);

  return <section aria-labelledby="uninstall-feedback-heading" className="rounded-xl border border-brand-border bg-background p-5">
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 id="uninstall-feedback-heading" className="text-lg font-semibold">Uninstall feedback</h2>
      {!signedOut && <Button variant="outline" disabled={busy} onClick={() => void load(null, false)}>Refresh</Button>}
    </div>
    {signedOut ? <p role="alert">Your session expired. <a className="text-brand-orange underline" href="/kreatli-email-crm/login">Sign in again</a>.</p> : <>
      {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-destructive">
        <p>{error}</p><Button variant="outline" disabled={busy} onClick={() => void load(lastRequest.current.cursor, lastRequest.current.append)}>Retry</Button>
      </div>}
      {busy && <p role="status" className="mb-4 text-sm text-foreground/60">Loading responses…</p>}
      {items?.length === 0 ? <p className="text-sm text-foreground/60">No responses yet.</p> : items && <div className="overflow-x-auto">
        <table className="block w-full text-left text-sm sm:table">
          <caption className="sr-only">Reasons for uninstalling, newest first</caption>
          <thead className="hidden border-b border-brand-border text-foreground/60 sm:table-header-group"><tr><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Reason</th><th className="px-3 py-3 font-medium">Comment</th></tr></thead>
          <tbody className="block sm:table-row-group">{items.map(item => <tr key={item.id} className="block border-b border-brand-border py-4 last:border-0 sm:table-row sm:py-0">
            <td className="block pb-2 align-top text-foreground/60 sm:table-cell sm:px-3 sm:py-4 sm:text-foreground"><time dateTime={item.createdAt} className="whitespace-nowrap">{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></td>
            <td className="block pb-2 align-top font-medium sm:table-cell sm:min-w-40 sm:px-3 sm:py-4 sm:font-normal">{feedbackReasonLabels[item.reason]}</td>
            <td className="block whitespace-pre-wrap align-top [overflow-wrap:anywhere] sm:table-cell sm:min-w-48 sm:max-w-md sm:px-3 sm:py-4">{item.note || <span className="text-foreground/40">—</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {nextCursor && <div className="mt-5 flex justify-center"><Button variant="outline" disabled={busy} onClick={() => void load(nextCursor, true)}>Load more</Button></div>}
    </>}
  </section>;
}
