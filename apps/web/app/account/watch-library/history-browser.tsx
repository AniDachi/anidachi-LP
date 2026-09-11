"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, Ellipsis, Film, LockKeyhole, Pencil, Play, RotateCcw, Search, Trash2, Undo2, X } from "lucide-react";
import {
  WatchHistoryEditorResponseSchema, WatchHistoryEditAckSchema,
  type WatchHistoryItem, type WatchHistoryDeleteScope, type WatchHistoryEditorResponse,
  type WatchHistoryEditorEpisode, type WatchHistoryEditRequest,
} from "@anidachi/protocol";
import { api, ApiError } from "@/lib/client-api";
import { WATCH_HISTORY_OWNER_HEADER } from "@/lib/watch-history-owner";
import { useAccountScrollRestoration, useAccountViewState } from "@/components/account/account-workspace-state";

type Props = {
  items: WatchHistoryItem[]; owner: string; generation: number; canEdit: boolean;
  busy: boolean; nextCursor: string | null; loadingMore: boolean; capacity: ReactNode;
  onLoadMore(): void; onEdited(): Promise<void>; onDraftChange(active: boolean): void;
  captureAccessFailure(): (error: unknown) => boolean;
  onResume(provider: WatchHistoryItem["provider"], url: string, time: number): void;
  onDelete(target: WatchHistoryDeleteScope): void;
};
const itemId = (item: WatchHistoryItem) => `${item.provider}:${item.titleKey}`;
export function HistoryBrowser(props: Props) {
  useAccountScrollRestoration(`${props.owner}:library:scroll`);
  const [query, setQuery] = useAccountViewState(`${props.owner}:library:query`, "");
  const [provider, setProvider] = useAccountViewState(`${props.owner}:library:provider`, "all");
  const [status, setStatus] = useAccountViewState(`${props.owner}:library:status`, "all");
  const [selected, setSelected] = useAccountViewState<string | null>(`${props.owner}:library:selected`, null);
  const [guard, setGuard] = useState<null | (() => void)>(null);
  const [guardSaving, setGuardSaving] = useState(false);
  const inspector = useRef<InspectorHandle | null>(null);
  const autoPageAttempt = useRef<string | null>(null);
  const { nextCursor, loadingMore, busy, onLoadMore } = props;
  const selectedItem = props.items.find(item => itemId(item) === selected);
  const filtered = props.items.filter(item => (provider === "all" || item.provider === provider)
    && item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    && (status === "all" || (status === "watched" ? isTitleWatched(item) : !isTitleWatched(item))));
  // The list API is bounded. Complete its existing pagination before declaring
  // a filtered search empty; the server-owned quota is never inferred here.
  useEffect(() => {
    const attempt = JSON.stringify([query, provider, status, nextCursor]);
    if ((query || provider !== "all" || status !== "all" || (selected && !selectedItem)) && nextCursor && !loadingMore && !busy && autoPageAttempt.current !== attempt) {
      autoPageAttempt.current = attempt;
      onLoadMore();
    }
  }, [query, provider, status, selected, selectedItem, nextCursor, loadingMore, busy, onLoadMore]);
  const navigate = (action: () => void) => {
    if (inspector.current?.dirty()) setGuard(() => action);
    else action();
  };
  return <div className={`wh-browser ${selectedItem ? "wh-has-detail" : ""}`}>
    <section className="wh-library" aria-label="Saved titles">
      <HistoryPlatformSwitch value={provider} onChange={setProvider} />
      <div className="wh-toolbar">
        <label className="wh-search"><Search size={17} aria-hidden /><span className="sr-only">Search your library</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your library" type="search" /></label>
        <select aria-label="Filter by progress" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">All progress</option><option value="watching">Not finished</option><option value="watched">Watched</option>
        </select>
      </div>
      {props.capacity}
      <div className="wh-covers">
        {filtered.map(item => <button key={itemId(item)} className={`wh-card ${selected === itemId(item) ? "wh-card-selected" : ""} ${item.provider === "youtube" ? "wh-video" : ""}`}
          type="button" aria-label={`Manage ${item.title}`} aria-pressed={selected === itemId(item)} onClick={() => navigate(() => setSelected(itemId(item)))}>
          <span className="wh-cover"><HistoryArtwork key={item.artworkUrl} item={item} />{isTitleWatched(item) && <span className="wh-cover-check"><Check size={14} /><span className="sr-only">Watched</span></span>}</span>
          <span className="wh-card-title" dir="auto">{item.title}</span>
          <span className="wh-card-progress">{titleProgress(item)}</span>
          <span className={`wh-provider wh-provider-${item.provider}`}>{item.provider === "youtube" ? "YouTube" : "Crunchyroll"}</span>
        </button>)}
      </div>
      {!filtered.length && <p className="wh-empty" role="status">{props.nextCursor && (query || provider !== "all" || status !== "all") ? (props.loadingMore ? "Searching your library…" : "No matches in loaded titles. Load more to continue searching.") : !props.items.length ? (props.canEdit ? "Watch something with the AniDachi extension. Your titles will appear here." : "No saved history yet. Plus or Pro records your viewing progress.") : "No titles match these filters."}</p>}
      {props.nextCursor && <button className="wh-button wh-load-more" disabled={props.loadingMore || props.busy} onClick={props.onLoadMore} type="button">{props.loadingMore ? "Loading…" : "Load more titles"}</button>}
    </section>
    {selectedItem && <TitleInspector key={`${props.owner}:${props.generation}:${selected}`} item={selectedItem} {...props}
      handle={inspector} onClose={() => navigate(() => setSelected(null))} onNavigate={action => navigate(action)} />}
    {guard && <ConfirmDialog title="Save your changes?" onClose={() => { if (!guardSaving) setGuard(null); }}>
      <p>Your progress edits have not been saved.</p>
      <div className="wh-dialog-actions">
        <button className="wh-button" disabled={guardSaving} onClick={() => setGuard(null)}>Stay here</button>
        <button className="wh-button" disabled={guardSaving} onClick={() => { inspector.current?.discard(); const action = guard; setGuard(null); action(); }}>Discard</button>
        <button className="wh-primary" disabled={guardSaving} onClick={async () => { setGuardSaving(true); try { if (await inspector.current?.save()) { const action = guard; setGuard(null); action(); } } finally { setGuardSaving(false); } }}>{guardSaving ? "Saving…" : "Save & continue"}</button>
      </div>
    </ConfirmDialog>}
  </div>;
}

const historyPlatforms = [
  { value: "all", label: "All", name: "All platforms" },
  { value: "crunchyroll", label: "Crunchyroll", name: "Crunchyroll" },
  { value: "youtube", label: "YouTube", name: "YouTube" },
] as const;

function HistoryPlatformSwitch({ value, onChange }: { value: string; onChange(value: string): void }) {
  return <div className="wh-platforms" role="radiogroup" aria-label="Filter by platform" data-platform={value}>
    {historyPlatforms.map(platform => <button key={platform.value} type="button" role="radio"
      aria-label={platform.name} aria-checked={value === platform.value} tabIndex={value === platform.value ? 0 : -1}
      onClick={() => onChange(platform.value)} onKeyDown={event => {
        const index = historyPlatforms.indexOf(platform);
        const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % historyPlatforms.length
          : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + historyPlatforms.length - 1) % historyPlatforms.length
          : event.key === "Home" ? 0 : event.key === "End" ? historyPlatforms.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        onChange(historyPlatforms[next].value);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')[next]?.focus();
      }}>
      {platform.value === "crunchyroll" && <svg viewBox="0 0 24 24" className="wh-platform-logo wh-platform-crunchyroll" aria-hidden="true">
        <path d="M2.909 13.436C2.914 7.61 7.642 2.893 13.468 2.898c5.576.005 10.137 4.339 10.51 9.819q.021-.351.022-.706C24.007 5.385 18.64.006 12.012 0S.007 5.36 0 11.988 5.36 23.994 11.988 24q.412 0 .815-.027c-5.526-.338-9.9-4.928-9.894-10.538Zm16.284.155a4.1 4.1 0 0 1-4.095-4.103 4.1 4.1 0 0 1 2.712-3.855 8.95 8.95 0 0 0-4.187-1.037 9.007 9.007 0 1 0 8.997 9.016q-.001-.847-.15-1.651a4.1 4.1 0 0 1-3.278 1.63Z" fill="currentColor" />
      </svg>}
      {platform.value === "youtube" && <svg viewBox="0 0 24 24" className="wh-platform-logo wh-platform-youtube" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.121 2.136c1.872.505 9.377.505 9.377.505s7.505 0 9.376-.505a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z" fill="currentColor" />
        <path d="m9.545 15.568 6.273-3.568-6.273-3.568v7.136Z" fill="#fff" />
      </svg>}
      <span>{platform.label}</span>
    </button>)}
  </div>;
}

type InspectorHandle = { dirty(): boolean; discard(): void; save(): Promise<boolean> };
function TitleInspector({ item, owner, generation, canEdit, busy, onEdited, onDraftChange, onResume, onDelete, onClose, onNavigate, handle, captureAccessFailure }: Props & {
  item: WatchHistoryItem; handle: React.RefObject<InspectorHandle | null>; onClose(): void; onNavigate(action: () => void): void;
}) {
  const [data, setData] = useState<WatchHistoryEditorResponse | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [episodeKey, setEpisodeKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [undo, setUndo] = useState<{ draft: Record<string, boolean>; message: string } | null>(null);
  const selectionAnchor = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [pendingSignOut, setPendingSignOut] = useState<null | (() => Promise<void>)>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const sending = useRef(false);
  const retryRequest = useRef<WatchHistoryEditRequest | null>(null);
  const dirty = Object.keys(draft).length > 0;
  const leaveGuard = useRef(false);
  leaveGuard.current = dirty || saving;
  const canonicalSignature = `${item.lastWatchedAt}:${item.latestActivity.currentTime}:${item.completedEpisodeCount}`;
  const previousCanonical = useRef(canonicalSignature);
  const single = item.provider === "youtube" || item.itemKind === "movie";
  const load = useCallback(async () => {
    const id = ++requestId.current;
    const handleAccessError = captureAccessFailure();
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ provider: item.provider, titleKey: item.titleKey, accountGeneration: String(generation) });
      const next = WatchHistoryEditorResponseSchema.parse(await api<unknown>(`/api/watch-history/v3/editor?${query}`, { headers: { [WATCH_HISTORY_OWNER_HEADER]: owner } }));
      if (next.meta.ownerUserId !== owner || next.meta.accountGeneration !== generation || next.titleKey !== item.titleKey || next.provider !== item.provider)
        throw new Error("The signed-in account or history changed. Reload this page.");
      if (!mounted.current || id !== requestId.current) return;
      setData(next);
      setUndo(null);
      const initial = next.episodes.find(ep => ep.episodeKey === item.latestActivity.episodeKey) ?? next.episodes[0];
      setSeason(value => next.episodes.some(ep => ep.seasonKey === value) ? value : initial.seasonKey);
      setEpisodeKey(value => next.episodes.some(ep => ep.episodeKey === value) ? value : initial.episodeKey);
      return next;
    } catch (cause) { if (mounted.current && id === requestId.current && !handleAccessError(cause)) setError(cause instanceof Error ? cause.message : "Could not load progress. Please retry."); }
    finally { if (mounted.current && id === requestId.current) setLoading(false); }
  }, [owner, generation, item.provider, item.titleKey, item.latestActivity.episodeKey, captureAccessFailure]);
  useEffect(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; onDraftChange(false); handle.current = null; };
  }, [load, onDraftChange, handle]);
  useEffect(() => { onDraftChange(dirty || saving); }, [dirty, saving, onDraftChange]);
  useEffect(() => {
    if (editing && !wasEditing.current) cancelButton.current?.focus({ preventScroll: true });
    if (!editing && wasEditing.current && !loading && !saving) {
      editButton.current?.focus({ preventScroll: true });
      wasEditing.current = false;
    }
    if (editing) wasEditing.current = true;
  }, [editing, loading, saving]);
  useEffect(() => {
    if (previousCanonical.current !== canonicalSignature && !dirty && !saving) {
      previousCanonical.current = canonicalSignature;
      void load();
    }
  }, [canonicalSignature, dirty, saving, load]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1099px)");
    const update = () => setMobile(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.close();
    if (mobile) element.showModal(); else element.show();
    return () => element.close();
  }, [mobile]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (leaveGuard.current) { event.preventDefault(); event.returnValue = ""; } };
    const linkClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!leaveGuard.current || !link || link.target === "_blank" || event.ctrlKey || event.metaKey || link.href === window.location.href) return;
      event.preventDefault(); event.stopPropagation(); setPendingLink(link.href);
    };
    const signOut = (event: Event) => {
      const proceed = (event as CustomEvent<() => Promise<void>>).detail;
      if (!leaveGuard.current || typeof proceed !== "function") return;
      event.preventDefault(); setPendingSignOut(() => proceed);
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("anidachi:before-sign-out", signOut);
    window.addEventListener("anidachi:before-account-navigation", signOut);
    document.addEventListener("click", linkClick, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("anidachi:before-sign-out", signOut); window.removeEventListener("anidachi:before-account-navigation", signOut); document.removeEventListener("click", linkClick, true); };
  }, [dirty, saving]);

  const clearSelection = () => { setSelection(new Set()); selectionAnchor.current = null; };
  const discard = () => { leaveGuard.current = false; setDraft({}); clearSelection(); setUndo(null); retryRequest.current = null; setEditing(false); setSaved(false); onDraftChange(false); };
  const save = async (): Promise<boolean> => {
    if (sending.current || !data || !canEdit || conflict) return false;
    if (!dirty) { setEditing(false); return true; }
    sending.current = true; setSaving(true); setError(null);
    const changes = data.episodes.filter(ep => ep.episodeKey in draft).map(ep => ({ episodeKey: ep.episodeKey, watched: draft[ep.episodeKey] }));
    // An uncertain network result retries the same id and payload, never a new write.
    const body = retryRequest.current ?? { provider: data.provider, titleKey: data.titleKey, accountGeneration: generation,
      revision: data.revision, clientMutationId: crypto.randomUUID(), changes };
    retryRequest.current = body;
    try {
      const ack = WatchHistoryEditAckSchema.parse(await api<unknown>("/api/watch-history/v3/editor", {
        method: "POST", headers: { [WATCH_HISTORY_OWNER_HEADER]: owner }, body: JSON.stringify(body),
      }));
      if (ack.meta.ownerUserId !== owner || ack.meta.accountGeneration !== generation || ack.clientMutationId !== body.clientMutationId)
        throw new Error("Could not confirm the saved progress. Retry to check the result.");
      if (!mounted.current) return false;
      leaveGuard.current = false; setDraft({}); clearSelection(); setUndo(null); setEditing(false); retryRequest.current = null; setSaved(true); onDraftChange(false);
      await load(); await onEdited();
      return true;
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Could not save progress. Your changes are still here.");
        if (cause instanceof ApiError && ["HISTORY_EDIT_CONFLICT", "HISTORY_EPISODE_UNAVAILABLE", "GENERATION_MISMATCH", "HISTORY_TITLE_NOT_FOUND"].includes(cause.code ?? "")) setConflict(true);
      }
      return false;
    } finally { sending.current = false; if (mounted.current) setSaving(false); }
  };
  handle.current = { dirty: () => dirty || saving, discard, save };
  const seasons = useMemo(() => {
    const groups = new Map<string | null, { key: string | null; title: string; order: number }>();
    for (const ep of data?.episodes ?? []) if (!groups.has(ep.seasonKey))
      groups.set(ep.seasonKey, { key: ep.seasonKey, title: ep.seasonTitle ?? "Saved episodes", order: ep.seasonOrder });
    return [...groups.values()].sort((a, b) => a.order - b.order);
  }, [data]);
  const episodes = data?.episodes.filter(ep => single || ep.seasonKey === season) ?? [];
  const selected = episodes.find(ep => ep.episodeKey === episodeKey) ?? episodes[0];
  const watched = (ep: WatchHistoryEditorEpisode) => draft[ep.episodeKey] ?? ep.watched;
  const hasProgress = (ep: WatchHistoryEditorEpisode) => watched(ep) || (!(ep.episodeKey in draft) && ep.currentTime > 0);
  const selectable = episodes.filter(ep => ep.available || ep.watched || ep.currentTime > 0);
  const targets = single ? episodes : selectable.filter(ep => selection.has(ep.episodeKey));
  const allSelected = selectable.length > 0 && targets.length === selectable.length;
  const canMark = targets.length > 0 && targets.every(ep => ep.available) && targets.some(ep => !watched(ep));
  const canClear = targets.some(hasProgress);
  const changeEpisodes = (values: WatchHistoryEditorEpisode[], value: boolean) => {
    if (saving || loading || !canEdit || conflict) return;
    const next = { ...draft };
    for (const ep of values.filter(episode => episode.available || !value)) {
      if (value === ep.watched && (value || ep.currentTime === 0)) delete next[ep.episodeKey];
      else next[ep.episodeKey] = value;
    }
    const changed = values.filter(ep => draft[ep.episodeKey] !== next[ep.episodeKey]).length;
    if (!changed) return;
    retryRequest.current = null; setSaved(false); setError(null);
    setUndo({ draft, message: value ? `${changed} marked watched` : `${changed} ${changed === 1 ? "entry" : "entries"} cleared` });
    setDraft(next); clearSelection();
  };
  const toggleSelection = (ep: WatchHistoryEditorEpisode, range: boolean) => {
    const anchor = selectable.findIndex(value => value.episodeKey === selectionAnchor.current);
    const index = selectable.indexOf(ep);
    const keys = range && anchor >= 0 ? selectable.slice(Math.min(anchor, index), Math.max(anchor, index) + 1) : [ep];
    const add = range || !selection.has(ep.episodeKey);
    setSelection(current => {
      const next = new Set(current);
      for (const value of keys) { if (add) next.add(value.episodeKey); else next.delete(value.episodeKey); }
      return next;
    });
    if (!range || anchor < 0) selectionAnchor.current = ep.episodeKey;
  };
  const available = episodes.filter(ep => ep.available);
  const completed = available.filter(watched).length;
  const currentTime = selected && selected.episodeKey in draft ? (watched(selected) ? selected.duration : 0) : selected?.currentTime ?? 0;
  const progress = selected && selected.episodeKey in draft ? (watched(selected) ? 1 : 0) : selected?.progress ?? 0;
  const editLocked = saving || loading || conflict || !canEdit;
  const changeCount = Object.keys(draft).length;
  const selectedLabel = selected ? episodeLabel(selected, episodes.indexOf(selected)) : "";
  return <>
    <dialog ref={dialog} className="wh-inspector" aria-label={`${item.title} progress`} onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="wh-inspector-top"><button className="wh-text" onClick={onClose}><ChevronLeft size={16} /> Library</button><button className="wh-icon" aria-label="Close title" onClick={onClose}><X size={18} /></button></div>
      <div className="wh-identity"><div className={`wh-detail-cover ${single ? "wh-single-cover" : ""}`}><HistoryArtwork item={item} /></div>
        <div><span className={`wh-provider wh-provider-${item.provider}`}>{item.provider === "youtube" ? "YouTube" : "Crunchyroll"}</span><h2 dir="auto">{item.title}</h2><p>{titleProgress(item)}</p></div>
      </div>
      <div className={`wh-editor-heading ${editing ? "wh-editor-active" : ""}`}>
        <div><div className="wh-edit-title"><h3>{editing ? "Edit progress" : "Your progress"}</h3>{editing && !single && <EditorActions disabled={editLocked}><button type="button" className="wh-danger" onClick={() => setResetOpen(true)}><RotateCcw size={15} />Reset all title progress</button></EditorActions>}</div>{editing && <span className="wh-edit-count" role="status">{dirty ? `${changeCount} unsaved ${changeCount === 1 ? "change" : "changes"}` : "No changes yet"}</span>}</div>
        {!editing && <button ref={editButton} className="wh-text" disabled={!canEdit || !data || loading || busy} onClick={() => { setEditing(true); setSaved(false); }}><Pencil size={14} /> Edit</button>}
        {editing && <div className="wh-editor-buttons"><button ref={cancelButton} className="wh-text" disabled={saving} onClick={() => { discard(); setConflict(false); setError(null); }}>Cancel</button><button className="wh-primary" aria-label={saving ? "Saving changes" : `Save ${changeCount} ${changeCount === 1 ? "change" : "changes"}`} disabled={editLocked || !dirty} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</button></div>}
      </div>
      {!canEdit && <p className="wh-hint"><LockKeyhole size={14} /> Plus or Pro unlocks recording and progress editing. Saved history stays available.</p>}
      {loading && <p className="wh-hint" role="status">Loading progress…</p>}
      {error && <div className="wh-error" role="alert"><p>{error}</p>
        {conflict ? <button className="wh-text" disabled={saving} onClick={async () => {
          const latest = await load(); if (latest) {
            setDraft(current => Object.fromEntries(Object.entries(current).filter(([key, value]) => latest.episodes.some(ep => ep.episodeKey === key && ep.available && (ep.watched !== value || (!value && ep.currentTime > 0))))));
            retryRequest.current = null; setUndo(null); clearSelection(); setConflict(false);
          }
        }}>Load latest & review my changes</button> : <button className="wh-text" disabled={saving} onClick={() => void (dirty ? save() : load())}>Retry</button>}
      </div>}
      {data && <>
        {saved && <p className="wh-saved" role="status"><Check size={14} /> Progress saved</p>}
        {!data.catalogComplete && !single && <p className="wh-hint">Only saved episodes are available. Open this title in Crunchyroll with the extension to load its full catalog.</p>}
        {!single && <div className="wh-season-row"><label><span className="sr-only">Season or specials</span><select value={season ?? ""} onChange={event => { setSeason(event.target.value || null); setEpisodeKey(null); clearSelection(); }}>
          {seasons.map(value => <option value={value.key ?? ""} key={value.key ?? "saved"}>{value.title}</option>)}
        </select></label><span>{completed} / {available.length} {data.catalogComplete ? "watched" : "saved"}</span></div>}
        {editing && <div className={`wh-selection-tools ${single ? "wh-single-tools" : ""}`}>
          {!single && <div className="wh-selection-row">
            <label className="wh-select-season"><input type="checkbox" checked={allSelected} ref={node => { if (node) node.indeterminate = targets.length > 0 && !allSelected; }} disabled={editLocked || !selectable.length} onChange={() => { setSelection(new Set(allSelected ? [] : selectable.map(ep => ep.episodeKey))); selectionAnchor.current = null; }} />{data.catalogComplete ? "Select season" : "Select all saved"}</label>
            <div className="wh-selection-count"><span role="status">{targets.length} selected</span><button type="button" className="wh-icon" aria-label="Clear selection" disabled={editLocked || !targets.length} onClick={clearSelection}><X size={14} /></button></div>
          </div>}
          <div className="wh-selection-actions" aria-label={single ? "Progress actions" : "Actions for selected episodes"}>
            <button type="button" className="wh-button" title={targets.some(ep => !ep.available) ? "Unavailable episodes can only have their progress cleared." : undefined} disabled={editLocked || !canMark} onClick={() => changeEpisodes(targets, true)}><Check size={15} />Mark watched</button>
            <button type="button" className="wh-button" disabled={editLocked || !canClear} onClick={() => changeEpisodes(targets, false)}><RotateCcw size={14} />Clear progress</button>
          </div>
          <div className="wh-selection-feedback">
            {undo ? <><span role="status">{undo.message}</span><button type="button" className="wh-text" disabled={editLocked} onClick={() => { setDraft(undo.draft); setUndo(null); clearSelection(); retryRequest.current = null; setError(null); }}><Undo2 size={13} />Undo</button></>
              : <span>{single ? "Changes apply when you save." : "Select episodes, then choose an action."}</span>}
          </div>
        </div>}
        {!single && <div className={`wh-episodes ${editing ? "wh-episodes-editing" : ""}`} aria-label={editing ? "Select episodes" : "Episodes"} tabIndex={0}>
          {episodes.map((ep, index) => <button type="button" key={ep.episodeKey} disabled={saving || (editing ? editLocked || !selectable.includes(ep) : !ep.available)}
            className={`wh-episode ${watched(ep) ? "wh-watched" : ""} ${!editing && selected?.episodeKey === ep.episodeKey ? "wh-selected" : ""} ${editing && selection.has(ep.episodeKey) ? "wh-picked" : ""} ${ep.episodeKey in draft ? "wh-modified" : ""}`}
            role={editing ? "checkbox" : undefined} aria-checked={editing ? selection.has(ep.episodeKey) : undefined}
            aria-label={`${episodeLabel(ep, index)}: ${ep.episodeTitle}${!ep.available ? ", unavailable" : watched(ep) ? ", watched" : !(ep.episodeKey in draft) && ep.progress > 0 ? ", in progress" : ", not watched"}${ep.episodeKey in draft ? ", unsaved change" : ""}`}
            aria-pressed={editing ? undefined : selected?.episodeKey === ep.episodeKey} title={ep.episodeTitle} onClick={event => { setEpisodeKey(ep.episodeKey); if (editing) toggleSelection(ep, event.shiftKey); }}>
            <span>{episodeLabel(ep, index)}</span>{editing ? <span className="wh-cell-check" aria-hidden>{selection.has(ep.episodeKey) && <Check size={9} />}</span> : watched(ep) ? <Check size={11} aria-hidden /> : null}
            {!watched(ep) && ep.progress > 0 && !(ep.episodeKey in draft) && <i style={{ width: `${ep.progress * 100}%` }} />}
          </button>)}
        </div>}
        {editing && !single && selected && <div className="wh-edit-selection"><p><span>{selectedLabel}</span><span>{selected.episodeTitle}</span></p><span className="wh-range-hint">Shift + click selects a range.</span></div>}
        {selected && (!editing || single) && <div className="wh-selected-episode">
          <div className="wh-episode-name"><span>{single ? (item.provider === "youtube" ? "Video" : "Film") : episodeLabel(selected, episodes.indexOf(selected))}</span><h4>{single ? (watched(selected) ? "Watched" : progress > 0 ? "In progress" : "Not watched") : selected.episodeTitle}</h4></div>
          <div className="wh-progress" role="progressbar" aria-label="Episode progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress * 100}%` }} /></div>
          <div className="wh-playback"><span>{selected.duration > 0 ? `${clock(currentTime)} / ${clock(selected.duration)}` : watched(selected) ? "Marked as watched" : currentTime > 0 ? `${clock(currentTime)} watched` : "Not started"}</span>
            {!editing && <button className="wh-primary" disabled={busy || !selected.available} onClick={() => onNavigate(() => onResume(item.provider, selected.sourceUrl, watched(selected) ? 0 : currentTime))}><Play size={14} fill="currentColor" />{watched(selected) ? "Watch again" : currentTime > 0 ? "Resume" : "Watch"}</button>}
          </div>
        </div>}
      </>}
      {!editing && <div className="wh-detail-footer"><button className="wh-text wh-danger" disabled={busy || saving} onClick={() => onNavigate(() => onDelete({ scope: "title", provider: item.provider, titleKey: item.titleKey }))}><Trash2 size={14} /> Remove from history</button><p>Removing this title frees one history slot.</p></div>}
    </dialog>
    {resetOpen && <ConfirmDialog title="Reset this title’s progress?" onClose={() => setResetOpen(false)}>
      <p>This clears watched marks and playback positions across all saved seasons. The title stays in your library. Review the changes, then press Save to apply them.</p>
      <div className="wh-dialog-actions"><button className="wh-button" onClick={() => setResetOpen(false)}>Keep progress</button><button className="wh-primary" onClick={() => { changeEpisodes(data?.episodes ?? [], false); setResetOpen(false); }}>Reset progress</button></div>
    </ConfirmDialog>}
    {(pendingLink || pendingSignOut) && <ConfirmDialog title="Save before leaving?" onClose={() => { if (!saving) { setPendingLink(null); setPendingSignOut(null); } }}><p>You have unsaved progress changes.</p><div className="wh-dialog-actions">
      <button className="wh-button" disabled={saving} onClick={() => { setPendingLink(null); setPendingSignOut(null); }}>Stay</button><button className="wh-button" disabled={saving} onClick={() => { discard(); if (pendingSignOut) void pendingSignOut(); else window.location.assign(pendingLink!); setPendingLink(null); setPendingSignOut(null); }}>Discard</button>
      <button className="wh-primary" disabled={saving} onClick={async () => { if (await save()) { if (pendingSignOut) await pendingSignOut(); else window.location.assign(pendingLink!); setPendingLink(null); setPendingSignOut(null); } }}>Save & leave</button>
    </div></ConfirmDialog>}
  </>;
}

function EditorActions({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = useCallback((restoreFocus = false) => {
    if (!ref.current?.open) return;
    ref.current.open = false;
    if (restoreFocus) ref.current.querySelector("summary")?.focus();
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [close]);
  useEffect(() => { if (disabled) close(); }, [disabled, close]);
  return <details ref={ref} className="wh-edit-actions" onKeyDown={event => {
    if (event.key === "Escape" && ref.current?.open) { event.preventDefault(); event.stopPropagation(); close(true); }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
    <summary aria-label="Title options" title="Title options" aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }}><Ellipsis size={17} aria-hidden /></summary>
    <div className="wh-actions-popover" onClick={event => { if ((event.target as Element).closest("button:enabled")) close(true); }}>{children}</div>
  </details>;
}

function ConfirmDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="wh-confirm" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}><h2>{title}</h2>{children}</dialog>;
}
function HistoryArtwork({ item }: { item: WatchHistoryItem }) {
  const [failed, setFailed] = useState(false);
  const checkLoaded = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth === 0) setFailed(true);
  }, []);
  return item.artworkUrl && !failed ? <img ref={checkLoaded} src={item.artworkUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <span className="wh-artwork-fallback"><Film size={30} aria-hidden /><span>{item.title}</span></span>;
}
function isTitleWatched(item: WatchHistoryItem) { return item.itemKind === "movie" || item.provider === "youtube" ? Boolean(item.latestActivity.completedAt) : item.aggregate.progress === 1; }
function titleProgress(item: WatchHistoryItem) {
  if (item.itemKind === "movie" || item.provider === "youtube") return item.latestActivity.completedAt ? "Watched" : `${clock(item.latestActivity.currentTime)} watched`;
  return item.aggregate.availableEpisodes === 0 ? "Not currently available" : item.aggregate.availableEpisodes !== null ? `${item.aggregate.completedEpisodes} / ${item.aggregate.availableEpisodes} episodes` : `${item.completedEpisodeCount} watched · ${item.observedEpisodeCount} saved`;
}
function episodeLabel(ep: WatchHistoryEditorEpisode, index: number) { return ep.episodeNumber === null ? String(index + 1).padStart(2, "0") : ep.episodeNumber === 0 ? "E0" : String(ep.episodeNumber).padStart(2, "0"); }
function clock(seconds: number) { const value = Math.max(0, Math.floor(seconds)); const hours = Math.floor(value / 3600); return `${hours ? `${hours}:` : ""}${hours ? String(Math.floor(value % 3600 / 60)).padStart(2, "0") : Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`; }
