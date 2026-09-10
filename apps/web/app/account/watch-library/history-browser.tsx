"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, Film, LockKeyhole, Pencil, Play, Search, Trash2, X } from "lucide-react";
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
      <div className="wh-toolbar">
        <label className="wh-search"><Search size={17} aria-hidden /><span className="sr-only">Search your library</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your library" type="search" /></label>
        <select aria-label="Filter by platform" value={provider} onChange={event => setProvider(event.target.value)}>
          <option value="all">All platforms</option><option value="crunchyroll">Crunchyroll</option><option value="youtube">YouTube</option>
        </select>
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

type InspectorHandle = { dirty(): boolean; discard(): void; save(): Promise<boolean> };
function TitleInspector({ item, owner, generation, canEdit, busy, onEdited, onDraftChange, onResume, onDelete, onClose, onNavigate, handle, captureAccessFailure }: Props & {
  item: WatchHistoryItem; handle: React.RefObject<InspectorHandle | null>; onClose(): void; onNavigate(action: () => void): void;
}) {
  const [data, setData] = useState<WatchHistoryEditorResponse | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [episodeKey, setEpisodeKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
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

  const discard = () => { leaveGuard.current = false; setDraft({}); retryRequest.current = null; setEditing(false); setSaved(false); onDraftChange(false); };
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
      leaveGuard.current = false; setDraft({}); setEditing(false); retryRequest.current = null; setSaved(true); onDraftChange(false);
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
  const changeEpisodes = (values: WatchHistoryEditorEpisode[], value: boolean) => {
    if (saving || !canEdit || conflict) return;
    retryRequest.current = null; setSaved(false);
    setDraft(current => {
      const next = { ...current };
      for (const ep of values.filter(episode => episode.available || !value)) {
        if (value === ep.watched && (value || ep.currentTime === 0)) delete next[ep.episodeKey];
        else next[ep.episodeKey] = value;
      }
      return next;
    });
  };
  const available = episodes.filter(ep => ep.available);
  const completed = available.filter(watched).length;
  const currentTime = selected && selected.episodeKey in draft ? (watched(selected) ? selected.duration : 0) : selected?.currentTime ?? 0;
  const progress = selected && selected.episodeKey in draft ? (watched(selected) ? 1 : 0) : selected?.progress ?? 0;
  return <>
    <dialog ref={dialog} className="wh-inspector" aria-label={`${item.title} progress`} onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="wh-inspector-top"><button className="wh-text" onClick={onClose}><ChevronLeft size={16} /> Library</button><button className="wh-icon" aria-label="Close title" onClick={onClose}><X size={18} /></button></div>
      <div className="wh-identity"><div className={`wh-detail-cover ${single ? "wh-single-cover" : ""}`}><HistoryArtwork item={item} /></div>
        <div><span className={`wh-provider wh-provider-${item.provider}`}>{item.provider === "youtube" ? "YouTube" : "Crunchyroll"}</span><h2 dir="auto">{item.title}</h2><p>{titleProgress(item)}</p></div>
      </div>
      <div className="wh-editor-heading"><h3>{editing ? "Edit progress" : "Your progress"}</h3>
        {!editing && <button className="wh-text" disabled={!canEdit || loading || busy} onClick={() => { setEditing(true); setSaved(false); }}><Pencil size={14} /> Edit</button>}
        {editing && <span className="wh-editing"><Pencil size={12} /> Editing</span>}
      </div>
      {!canEdit && <p className="wh-hint"><LockKeyhole size={14} /> Plus or Pro unlocks recording and progress editing. Saved history stays available.</p>}
      {loading && <p className="wh-hint" role="status">Loading progress…</p>}
      {error && <div className="wh-error" role="alert"><p>{error}</p>
        {conflict ? <button className="wh-text" disabled={saving} onClick={async () => {
          const latest = await load(); if (latest) {
            setDraft(current => Object.fromEntries(Object.entries(current).filter(([key, value]) => latest.episodes.some(ep => ep.episodeKey === key && ep.available && (ep.watched !== value || (!value && ep.currentTime > 0))))));
            retryRequest.current = null; setConflict(false);
          }
        }}>Load latest & review my changes</button> : <button className="wh-text" disabled={saving} onClick={() => void (dirty ? save() : load())}>Retry</button>}
      </div>}
      {data && <>
        {!data.catalogComplete && !single && <p className="wh-hint">Only saved episodes are available. Open this title in Crunchyroll with the extension to load its full catalog.</p>}
        {!single && <div className="wh-season-row"><label><span className="sr-only">Season or specials</span><select value={season ?? ""} onChange={event => { setSeason(event.target.value || null); setEpisodeKey(null); }}>
          {seasons.map(value => <option value={value.key ?? ""} key={value.key ?? "saved"}>{value.title}</option>)}
        </select></label><span>{completed} / {available.length} {data.catalogComplete ? "watched" : "saved"}</span></div>}
        {editing && !single && <div className="wh-edit-tools">
          <button className="wh-text" disabled={saving || conflict || !available.length} onClick={() => changeEpisodes(available, true)}><Check size={14} /> Mark {data.catalogComplete ? "season" : "saved episodes"}</button>
          <button className="wh-text" disabled={saving || conflict || !available.length} onClick={() => changeEpisodes(available, false)}>Clear marks</button>
        </div>}
        {!single && <div className="wh-episodes" aria-label="Episodes" tabIndex={0}>
          {episodes.map((ep, index) => <button type="button" key={ep.episodeKey} disabled={!ep.available || saving}
            className={`wh-episode ${watched(ep) ? "wh-watched" : ""} ${selected?.episodeKey === ep.episodeKey ? "wh-selected" : ""} ${ep.episodeKey in draft ? "wh-modified" : ""}`}
            aria-label={`${episodeLabel(ep, index)}: ${ep.episodeTitle}${!ep.available ? ", unavailable" : watched(ep) ? ", watched" : ep.progress > 0 ? ", in progress" : ", not watched"}`}
            aria-pressed={selected?.episodeKey === ep.episodeKey} title={ep.episodeTitle} onClick={() => setEpisodeKey(ep.episodeKey)}>
            <span>{episodeLabel(ep, index)}</span>{watched(ep) ? <Check size={11} aria-hidden /> : null}
            {!watched(ep) && ep.progress > 0 && !(ep.episodeKey in draft) && <i style={{ width: `${ep.progress * 100}%` }} />}
          </button>)}
        </div>}
        {selected && <div className="wh-selected-episode">
          <div className="wh-episode-name"><span>{single ? (item.provider === "youtube" ? "Video" : "Film") : episodeLabel(selected, episodes.indexOf(selected))}</span><h4>{single ? (watched(selected) ? "Watched" : progress > 0 ? "In progress" : "Not watched") : selected.episodeTitle}</h4></div>
          <div className="wh-progress" role="progressbar" aria-label="Episode progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress * 100}%` }} /></div>
          <div className="wh-playback"><span>{selected.duration > 0 ? `${clock(currentTime)} / ${clock(selected.duration)}` : watched(selected) ? "Marked as watched" : currentTime > 0 ? `${clock(currentTime)} watched` : "Not started"}</span>
            {!editing && <button className="wh-primary" disabled={busy || !selected.available} onClick={() => onNavigate(() => onResume(item.provider, selected.sourceUrl, watched(selected) ? 0 : currentTime))}><Play size={14} fill="currentColor" />{watched(selected) ? "Watch again" : currentTime > 0 ? "Resume" : "Watch"}</button>}
          </div>
          {editing && <div className="wh-mark-actions"><button className="wh-button" disabled={saving || conflict || !selected.available} onClick={() => changeEpisodes([selected], !watched(selected))}><Check size={15} />{watched(selected) ? "Mark unwatched" : "Mark watched"}</button>
            {!single && <button className="wh-text" disabled={saving || conflict || !selected.available} onClick={() => changeEpisodes(episodes.slice(0, episodes.indexOf(selected) + 1), true)}>Watched through this episode</button>}
          </div>}
        </div>}
        {editing && <><p className="wh-edit-note">Mark what you watched before AniDachi. Changes apply to your personal history.</p>
          <button className="wh-text" disabled={saving || conflict} onClick={() => setResetOpen(true)}>Reset all title progress</button>
          <div className="wh-save-row"><button className="wh-button" disabled={saving} onClick={() => { discard(); setConflict(false); setError(null); }}>Cancel</button><button className="wh-primary" disabled={saving || !dirty || conflict} onClick={() => void save()}>{saving ? "Saving…" : `Save${dirty ? ` ${Object.keys(draft).length} ${Object.keys(draft).length === 1 ? "change" : "changes"}` : " changes"}`}</button></div></>}
        {saved && <p className="wh-saved" role="status"><Check size={14} /> Progress saved</p>}
      </>}
      <div className="wh-detail-footer"><button className="wh-text wh-danger" disabled={busy || saving} onClick={() => onNavigate(() => onDelete({ scope: "title", provider: item.provider, titleKey: item.titleKey }))}><Trash2 size={14} /> Remove from history</button><p>Removing this title frees one history slot.</p></div>
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
