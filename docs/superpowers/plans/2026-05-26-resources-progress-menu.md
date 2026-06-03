# Resources Progress Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact collapsible "Resources" section to the Anidachi mini-panel, with Crunchyroll watch-progress history and placeholder provider folders for Netflix, YouTube, and Amazon.

**Architecture:** Keep the current overlay minimal by extracting progress storage, Crunchyroll metadata, and resource rendering into separate files. Progress is local-only for this prototype and stored in `chrome.storage.local`; it is recorded only while a room is active so the section represents things watched together.

**Tech Stack:** WXT content script, React, TypeScript, `chrome.storage.local`, Vitest, existing Shadow DOM mini-panel styles.

---

## File Structure

- Create `apps/extension/src/watch-progress.ts`
  - Owns provider types, storage schema, CRUD, progress math, and library grouping.
- Create `apps/extension/src/crunchyroll-progress.ts`
  - Extracts Crunchyroll item identity from URL, adapter title, DOM metadata, current time, and duration.
- Create `apps/extension/src/resources-panel.tsx`
  - Renders the collapsible Resources section, provider folders, Crunchyroll series/movie rows, episode rows, and tiny progress bars.
- Modify `apps/extension/src/overlay-app.tsx`
  - Starts the progress recorder when `roomId` exists and renders `<ResourcesPanel />` between Participants and Settings.
- Modify `apps/extension/src/styles.ts`
  - Adds compact glass-style resource rows, nested episode rows, caret states, empty states, and green progress bars.
- Test `apps/extension/test/watch-progress.test.ts`
  - Verifies progress clamping, upsert behavior, series grouping, and placeholder providers.
- Test `apps/extension/test/crunchyroll-progress.test.ts`
  - Verifies Crunchyroll URL parsing and movie-vs-series identity detection.

---

## UX Contract

Default panel order:

1. Header and room actions
2. Reactions
3. Participants
4. Resources
5. Settings
6. Debug

Resources behavior:

- The whole section is collapsed by default to preserve the current quiet panel.
- Opening "Resources" shows provider folders: Crunchyroll, Netflix, YouTube, Amazon.
- Crunchyroll can expand and show actual watched items.
- Netflix, YouTube, and Amazon show empty provider folders only: "No local history yet".
- A movie row shows title, last watched timestamp, and one green progress bar.
- A series row behaves like a folder. It shows series title, episode count, aggregate progress, and can expand into episode rows.
- Episode rows show episode title, watched time like `14:33 / 52:39`, and their own tiny green progress bar.
- Rows are dense and stay inside the current `300px` panel. The list should cap height and scroll inside Resources instead of making the mini-panel huge.

Visual style:

- Use the current dark glass style, thin borders, 12px radius, muted secondary text, and small uppercase section labels.
- Use small chevrons/folder icons from `lucide-react`; no big cards inside cards.
- Progress bars are 2px high, soft green, with an inactive translucent track.
- Text truncates to one line; episode metadata goes below in smaller muted text.

---

## Task 1: Local Watch Progress Store

**Files:**
- Create: `apps/extension/src/watch-progress.ts`
- Test: `apps/extension/test/watch-progress.test.ts`

- [ ] **Step 1: Write the failing storage/model tests**

Create `apps/extension/test/watch-progress.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProviderFolders,
  createEmptyWatchProgressStore,
  recordWatchProgressInStore,
  type WatchProgressEntry,
} from "../src/watch-progress";

describe("watch progress store", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-05-26T01:02:03.000Z"));
  });

  it("clamps progress and upserts Crunchyroll episode progress", () => {
    const store = createEmptyWatchProgressStore();
    const entry: WatchProgressEntry = {
      provider: "crunchyroll",
      kind: "episode",
      itemId: "chainsaw-man",
      itemTitle: "Chainsaw Man",
      episodeId: "GMEE00351495ENUS",
      episodeTitle: "E1 - Reze Arc",
      sourceUrl: "https://www.crunchyroll.com/ru/watch/GMEE00351495ENUS/chainsaw-man--the-movie-reze-arc",
      currentTime: 900,
      duration: 1800,
      roomId: "room-1",
      watchedWithCount: 2,
    };

    const next = recordWatchProgressInStore(store, entry, Date.now());
    const updated = recordWatchProgressInStore(
      next,
      { ...entry, currentTime: 2500, duration: 1800 },
      Date.now() + 1000,
    );

    const episode = updated.providers.crunchyroll.items["chainsaw-man"]?.episodes?.GMEE00351495ENUS;

    expect(episode?.progress).toBe(1);
    expect(episode?.currentTime).toBe(1800);
    expect(episode?.duration).toBe(1800);
    expect(episode?.lastWatchedAt).toBe(Date.now() + 1000);
  });

  it("builds placeholder provider folders for services without tracking yet", () => {
    const folders = buildProviderFolders(createEmptyWatchProgressStore());

    expect(folders.map((folder) => folder.provider)).toEqual([
      "crunchyroll",
      "netflix",
      "youtube",
      "amazon",
    ]);
    expect(folders.find((folder) => folder.provider === "netflix")?.items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm --filter @anidachi/extension test -- watch-progress.test.ts
```

Expected: fail because `watch-progress.ts` does not exist.

- [ ] **Step 3: Implement the progress store**

Create `apps/extension/src/watch-progress.ts`:

```ts
export type ResourceProvider = "crunchyroll" | "netflix" | "youtube" | "amazon";
export type WatchItemKind = "movie" | "series" | "episode";

export interface WatchProgressEntry {
  provider: ResourceProvider;
  kind: WatchItemKind;
  itemId: string;
  itemTitle: string;
  episodeId?: string;
  episodeTitle?: string;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  roomId: string;
  watchedWithCount: number;
}

export interface StoredEpisodeProgress {
  id: string;
  title: string;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  progress: number;
  lastRoomId: string;
  watchedWithCount: number;
  lastWatchedAt: number;
}

export interface StoredWatchItem {
  id: string;
  kind: "movie" | "series";
  title: string;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  progress: number;
  lastRoomId: string;
  watchedWithCount: number;
  lastWatchedAt: number;
  episodes?: Record<string, StoredEpisodeProgress>;
}

export interface WatchProgressStore {
  version: 1;
  providers: Record<ResourceProvider, { items: Record<string, StoredWatchItem> }>;
}

export interface ProviderFolder {
  provider: ResourceProvider;
  label: string;
  items: StoredWatchItem[];
}

export const WATCH_PROGRESS_STORAGE_KEY = "anidachi.watchProgress.v1";

const PROVIDER_LABELS: Record<ResourceProvider, string> = {
  crunchyroll: "Crunchyroll",
  netflix: "Netflix",
  youtube: "YouTube",
  amazon: "Amazon",
};

export function createEmptyWatchProgressStore(): WatchProgressStore {
  return {
    version: 1,
    providers: {
      crunchyroll: { items: {} },
      netflix: { items: {} },
      youtube: { items: {} },
      amazon: { items: {} },
    },
  };
}

export function recordWatchProgressInStore(
  store: WatchProgressStore,
  entry: WatchProgressEntry,
  now = Date.now(),
): WatchProgressStore {
  const currentTime = clampTime(entry.currentTime, entry.duration);
  const duration = Math.max(0, Number.isFinite(entry.duration) ? entry.duration : 0);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const provider = store.providers[entry.provider] ?? { items: {} };
  const previous = provider.items[entry.itemId];
  const itemKind = entry.kind === "episode" ? "series" : entry.kind;

  const nextItem: StoredWatchItem = {
    id: entry.itemId,
    kind: itemKind,
    title: entry.itemTitle,
    sourceUrl: entry.sourceUrl,
    currentTime,
    duration,
    progress,
    lastRoomId: entry.roomId,
    watchedWithCount: entry.watchedWithCount,
    lastWatchedAt: now,
    ...(previous?.episodes ? { episodes: { ...previous.episodes } } : {}),
  };

  if (entry.kind === "episode") {
    const episodeId = entry.episodeId ?? entry.itemId;
    const episodes = nextItem.episodes ?? {};
    episodes[episodeId] = {
      id: episodeId,
      title: entry.episodeTitle ?? entry.itemTitle,
      sourceUrl: entry.sourceUrl,
      currentTime,
      duration,
      progress,
      lastRoomId: entry.roomId,
      watchedWithCount: entry.watchedWithCount,
      lastWatchedAt: now,
    };
    nextItem.episodes = episodes;
    nextItem.progress = getAverageProgress(Object.values(episodes));
    nextItem.currentTime = currentTime;
    nextItem.duration = duration;
  }

  return {
    version: 1,
    providers: {
      ...store.providers,
      [entry.provider]: {
        items: {
          ...provider.items,
          [entry.itemId]: nextItem,
        },
      },
    },
  };
}

export function buildProviderFolders(store: WatchProgressStore): ProviderFolder[] {
  return (Object.keys(PROVIDER_LABELS) as ResourceProvider[]).map((provider) => ({
    provider,
    label: PROVIDER_LABELS[provider],
    items: Object.values(store.providers[provider]?.items ?? {}).sort(
      (a, b) => b.lastWatchedAt - a.lastWatchedAt,
    ),
  }));
}

export async function loadWatchProgressStore(): Promise<WatchProgressStore> {
  const value = await chrome.storage.local.get(WATCH_PROGRESS_STORAGE_KEY);
  return normalizeWatchProgressStore(value[WATCH_PROGRESS_STORAGE_KEY]);
}

export async function saveWatchProgressStore(store: WatchProgressStore): Promise<void> {
  await chrome.storage.local.set({ [WATCH_PROGRESS_STORAGE_KEY]: store });
}

export async function recordWatchProgress(entry: WatchProgressEntry): Promise<WatchProgressStore> {
  const store = await loadWatchProgressStore();
  const next = recordWatchProgressInStore(store, entry);
  await saveWatchProgressStore(next);
  return next;
}

export function normalizeWatchProgressStore(value: unknown): WatchProgressStore {
  if (!value || typeof value !== "object") {
    return createEmptyWatchProgressStore();
  }

  const candidate = value as Partial<WatchProgressStore>;
  const empty = createEmptyWatchProgressStore();
  return {
    version: 1,
    providers: {
      crunchyroll: candidate.providers?.crunchyroll ?? empty.providers.crunchyroll,
      netflix: candidate.providers?.netflix ?? empty.providers.netflix,
      youtube: candidate.providers?.youtube ?? empty.providers.youtube,
      amazon: candidate.providers?.amazon ?? empty.providers.amazon,
    },
  };
}

function clampTime(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime)) {
    return 0;
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, currentTime);
  }

  return Math.max(0, Math.min(duration, currentTime));
}

function getAverageProgress(episodes: StoredEpisodeProgress[]): number {
  if (!episodes.length) {
    return 0;
  }

  return episodes.reduce((sum, episode) => sum + episode.progress, 0) / episodes.length;
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
pnpm --filter @anidachi/extension test -- watch-progress.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/watch-progress.ts apps/extension/test/watch-progress.test.ts
git commit -m "Add local watch progress store"
```

---

## Task 2: Crunchyroll Progress Identity

**Files:**
- Create: `apps/extension/src/crunchyroll-progress.ts`
- Test: `apps/extension/test/crunchyroll-progress.test.ts`

- [ ] **Step 1: Write failing Crunchyroll identity tests**

Create `apps/extension/test/crunchyroll-progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getCrunchyrollProgressEntry } from "../src/crunchyroll-progress";

describe("Crunchyroll progress identity", () => {
  it("extracts an episode entry from a Crunchyroll watch URL", () => {
    document.title = "E4 - Смелый шаг - Watch on Crunchyroll";
    history.replaceState(
      null,
      "",
      "https://www.crunchyroll.com/ru/watch/G8WUNM123/e4-bold-step#anidachiRoom=room-1",
    );

    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 873 });
    Object.defineProperty(video, "duration", { configurable: true, value: 3159 });

    const entry = getCrunchyrollProgressEntry({
      title: "E4 - Смелый шаг",
      video,
      roomId: "room-1",
      watchedWithCount: 2,
    });

    expect(entry).toMatchObject({
      provider: "crunchyroll",
      kind: "episode",
      itemId: "crunchyroll-series:e4-bold-step",
      episodeId: "G8WUNM123",
      episodeTitle: "E4 - Смелый шаг",
      currentTime: 873,
      duration: 3159,
      roomId: "room-1",
      watchedWithCount: 2,
    });
    expect(entry?.sourceUrl).toBe("https://www.crunchyroll.com/ru/watch/G8WUNM123/e4-bold-step");
  });

  it("returns null outside Crunchyroll watch pages", () => {
    history.replaceState(null, "", "https://www.crunchyroll.com/ru/series/example");
    const video = document.createElement("video");

    expect(
      getCrunchyrollProgressEntry({
        title: "Series detail",
        video,
        roomId: "room-1",
        watchedWithCount: 2,
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm --filter @anidachi/extension test -- crunchyroll-progress.test.ts
```

Expected: fail because `crunchyroll-progress.ts` does not exist.

- [ ] **Step 3: Implement Crunchyroll extraction**

Create `apps/extension/src/crunchyroll-progress.ts`:

```ts
import type { WatchProgressEntry } from "./watch-progress";

interface CrunchyrollProgressInput {
  title: string | null;
  video: HTMLVideoElement;
  roomId: string;
  watchedWithCount: number;
}

export function getCrunchyrollProgressEntry(
  input: CrunchyrollProgressInput,
): WatchProgressEntry | null {
  const url = new URL(location.href);
  const match = url.pathname.match(/\/watch\/([^/]+)\/?([^/?#]*)?/);

  if (!match) {
    return null;
  }

  const episodeId = match[1];
  const slug = match[2] || episodeId;
  const title = cleanTitle(input.title ?? document.title);
  const seriesTitle = getSeriesTitle(title, slug);
  const sourceUrl = `${url.origin}${url.pathname}`;

  return {
    provider: "crunchyroll",
    kind: looksLikeEpisode(title) ? "episode" : "movie",
    itemId: looksLikeEpisode(title)
      ? `crunchyroll-series:${slug}`
      : `crunchyroll-movie:${episodeId}`,
    itemTitle: looksLikeEpisode(title) ? seriesTitle : title,
    episodeId,
    episodeTitle: title,
    sourceUrl,
    currentTime: input.video.currentTime || 0,
    duration: Number.isFinite(input.video.duration) ? input.video.duration : 0,
    roomId: input.roomId,
    watchedWithCount: input.watchedWithCount,
  };
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*-\s*Watch on Crunchyroll\s*$/i, "")
    .replace(/\s*\|\s*Crunchyroll\s*$/i, "")
    .trim();
}

function looksLikeEpisode(title: string): boolean {
  return /^E\d+\b/i.test(title) || /\bEpisode\s+\d+\b/i.test(title);
}

function getSeriesTitle(title: string, slug: string): string {
  const metaTitle =
    document.querySelector<HTMLMetaElement>('meta[property="og:video:series"]')?.content ??
    document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content;

  if (metaTitle && metaTitle.toLowerCase() !== "crunchyroll") {
    return metaTitle.trim();
  }

  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
pnpm --filter @anidachi/extension test -- crunchyroll-progress.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/crunchyroll-progress.ts apps/extension/test/crunchyroll-progress.test.ts
git commit -m "Track Crunchyroll progress identity"
```

---

## Task 3: Resources Panel Component

**Files:**
- Create: `apps/extension/src/resources-panel.tsx`
- Modify: `apps/extension/src/styles.ts`

- [ ] **Step 1: Create the component**

Create `apps/extension/src/resources-panel.tsx`:

```tsx
import { ChevronDown, ChevronRight, Folder, PlayCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { buildProviderFolders, type ProviderFolder, type StoredWatchItem } from "./watch-progress";
import type { WatchProgressStore } from "./watch-progress";

interface ResourcesPanelProps {
  store: WatchProgressStore;
}

export function ResourcesPanel({ store }: ResourcesPanelProps) {
  const [open, setOpen] = useState(false);
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>({
    crunchyroll: true,
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const folders = useMemo(() => buildProviderFolders(store), [store]);

  return (
    <div className="resources-section">
      <button className="resource-section-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        <span>Resources</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open ? (
        <div className="resource-list">
          {folders.map((folder) => (
            <ProviderFolderRow
              key={folder.provider}
              folder={folder}
              open={Boolean(openProviders[folder.provider])}
              onToggle={() =>
                setOpenProviders((current) => ({
                  ...current,
                  [folder.provider]: !current[folder.provider],
                }))
              }
              openItems={openItems}
              setOpenItems={setOpenItems}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProviderFolderRow({
  folder,
  open,
  onToggle,
  openItems,
  setOpenItems,
}: {
  folder: ProviderFolder;
  open: boolean;
  onToggle: () => void;
  openItems: Record<string, boolean>;
  setOpenItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <div className="resource-provider">
      <button className="resource-provider-row" type="button" onClick={onToggle}>
        <span className={`resource-provider-dot ${folder.provider}`} />
        <span className="resource-provider-name">{folder.label}</span>
        <span className="resource-provider-count">{folder.items.length || "empty"}</span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      {open ? (
        <div className="resource-provider-body">
          {folder.items.length ? (
            folder.items.slice(0, 8).map((item) => (
              <WatchItemRow
                key={item.id}
                item={item}
                open={Boolean(openItems[item.id])}
                onToggle={() =>
                  setOpenItems((current) => ({
                    ...current,
                    [item.id]: !current[item.id],
                  }))
                }
              />
            ))
          ) : (
            <div className="resource-empty">No local history yet</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function WatchItemRow({
  item,
  open,
  onToggle,
}: {
  item: StoredWatchItem;
  open: boolean;
  onToggle: () => void;
}) {
  const episodes = Object.values(item.episodes ?? {}).sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
  const isSeries = item.kind === "series";

  return (
    <div className="watch-item">
      <button className="watch-item-row" type="button" onClick={isSeries ? onToggle : undefined}>
        <span className="watch-item-icon">{isSeries ? <Folder size={13} /> : <PlayCircle size={13} />}</span>
        <span className="watch-item-main">
          <span className="watch-item-title">{item.title}</span>
          <span className="watch-item-meta">
            {isSeries ? `${episodes.length} episodes` : formatProgressTime(item.currentTime, item.duration)}
          </span>
          <ProgressBar progress={item.progress} />
        </span>
        {isSeries ? open ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
      </button>

      {isSeries && open ? (
        <div className="episode-list">
          {episodes.map((episode) => (
            <div className="episode-row" key={episode.id}>
              <span className="episode-title">{episode.title}</span>
              <span className="episode-meta">{formatProgressTime(episode.currentTime, episode.duration)}</span>
              <ProgressBar progress={episode.progress} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <span className="resource-progress">
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
    </span>
  );
}

function formatProgressTime(currentTime: number, duration: number): string {
  return `${formatClock(currentTime)} / ${formatClock(duration)}`;
}

function formatClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
```

- [ ] **Step 2: Add resource styles**

Append these styles inside `overlayStyles` in `apps/extension/src/styles.ts` after `.toggle span:last-child`:

```css
  .resources-section {
    display: grid;
    gap: 8px;
  }

  .resource-section-toggle,
  .resource-provider-row,
  .watch-item-row {
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .resource-section-toggle {
    justify-content: space-between;
    margin: 14px 0 2px;
    font-size: 11px;
    font-weight: 760;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
  }

  .resource-list {
    max-height: 210px;
    overflow: auto;
    display: grid;
    gap: 7px;
  }

  .resource-provider {
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.045);
    overflow: hidden;
  }

  .resource-provider-row {
    min-height: 34px;
    padding: 8px 9px;
  }

  .resource-provider-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.3);
  }

  .resource-provider-dot.crunchyroll {
    background: #f97316;
  }

  .resource-provider-dot.netflix {
    background: #ef4444;
  }

  .resource-provider-dot.youtube {
    background: #f43f5e;
  }

  .resource-provider-dot.amazon {
    background: #38bdf8;
  }

  .resource-provider-name {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    font-weight: 700;
  }

  .resource-provider-count,
  .resource-empty,
  .watch-item-meta,
  .episode-meta {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.48);
  }

  .resource-provider-body {
    display: grid;
    gap: 5px;
    padding: 0 8px 8px;
  }

  .resource-empty {
    padding: 4px 2px 2px 18px;
  }

  .watch-item {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding-top: 6px;
  }

  .watch-item-row {
    align-items: flex-start;
    padding: 0 2px;
  }

  .watch-item-icon {
    width: 16px;
    height: 16px;
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 1px;
  }

  .watch-item-main {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .watch-item-title,
  .episode-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    font-weight: 650;
  }

  .episode-list {
    display: grid;
    gap: 6px;
    padding: 7px 0 2px 24px;
  }

  .episode-row {
    display: grid;
    gap: 3px;
  }

  .resource-progress {
    width: 100%;
    height: 2px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.11);
    overflow: hidden;
  }

  .resource-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #7dd3a7, #22c55e);
  }
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter @anidachi/extension check
```

Expected: pass after the component is imported in Task 4; before import it may only verify syntax if included by TS.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/src/resources-panel.tsx apps/extension/src/styles.ts
git commit -m "Add resources panel UI"
```

---

## Task 4: Overlay Integration and Recorder

**Files:**
- Modify: `apps/extension/src/overlay-app.tsx`

- [ ] **Step 1: Import progress helpers**

Add imports near the current imports in `apps/extension/src/overlay-app.tsx`:

```ts
import { getCrunchyrollProgressEntry } from "./crunchyroll-progress";
import { ResourcesPanel } from "./resources-panel";
import {
  createEmptyWatchProgressStore,
  loadWatchProgressStore,
  recordWatchProgress,
  type WatchProgressStore,
} from "./watch-progress";
```

- [ ] **Step 2: Add local progress state**

Inside `OverlayApp`, near existing `useState` calls, add:

```ts
const [watchProgressStore, setWatchProgressStore] = useState<WatchProgressStore>(() =>
  createEmptyWatchProgressStore(),
);
```

- [ ] **Step 3: Load stored progress once**

Add this effect near other setup effects:

```ts
useEffect(() => {
  let cancelled = false;

  void loadWatchProgressStore().then((store) => {
    if (!cancelled) {
      setWatchProgressStore(store);
    }
  });

  return () => {
    cancelled = true;
  };
}, []);
```

- [ ] **Step 4: Record Crunchyroll progress while a room is active**

Add this effect after `participantCount` is computed or before render:

```ts
useEffect(() => {
  if (adapter.id !== "crunchyroll" || !roomId) {
    return;
  }

  const watchedWithCount = Math.max(1, participantCount);

  const save = () => {
    const entry = getCrunchyrollProgressEntry({
      title: adapter.getTitle(),
      video: adapter.video,
      roomId,
      watchedWithCount,
    });

    if (!entry || entry.duration <= 0) {
      return;
    }

    void recordWatchProgress(entry).then(setWatchProgressStore);
  };

  const interval = window.setInterval(save, 5000);
  adapter.video.addEventListener("pause", save);
  adapter.video.addEventListener("seeked", save);
  window.addEventListener("pagehide", save);

  save();

  return () => {
    window.clearInterval(interval);
    adapter.video.removeEventListener("pause", save);
    adapter.video.removeEventListener("seeked", save);
    window.removeEventListener("pagehide", save);
  };
}, [adapter, roomId, participantCount]);
```

- [ ] **Step 5: Render Resources before Settings**

In the JSX, insert this after the Participants block and before `<div className="section-title">Settings</div>`:

```tsx
<ResourcesPanel store={watchProgressStore} />
```

- [ ] **Step 6: Run check**

```bash
pnpm --filter @anidachi/extension check
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/extension/src/overlay-app.tsx
git commit -m "Record Crunchyroll progress in overlay"
```

---

## Task 5: Full Verification and Local Build

**Files:**
- Verify: `apps/extension`
- Verify: `anidachi-extension-public`
- Verify: `anidachi-extension-experiment`

- [ ] **Step 1: Run focused tests**

```bash
pnpm --filter @anidachi/extension test -- watch-progress.test.ts crunchyroll-progress.test.ts
```

Expected: pass.

- [ ] **Step 2: Run full extension checks**

```bash
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
```

Expected: pass.

- [ ] **Step 3: Build public extension**

```bash
pnpm build:extension:public
```

Expected: `anidachi-extension-public` and `anidachi-extension-public.zip` are updated.

- [ ] **Step 4: Sync experiment folder**

```bash
rm -rf /Users/vladyslavhulyi/anidachi/anidachi-extension-experiment
cp -R /Users/vladyslavhulyi/anidachi/anidachi-extension-public /Users/vladyslavhulyi/anidachi/anidachi-extension-experiment
```

Expected: Mac experiment folder contains the latest build.

- [ ] **Step 5: Manual test on Crunchyroll**

1. Reload unpacked extension from `/Users/vladyslavhulyi/anidachi/anidachi-extension-experiment`.
2. Open Crunchyroll watch page.
3. Create or join a room.
4. Watch for at least 10 seconds.
5. Open Anidachi mini-panel.
6. Open `Resources`.
7. Open `Crunchyroll`.
8. Verify current item appears with a green progress bar.
9. Seek forward.
10. Pause.
11. Reopen the panel and verify progress updates.
12. Move to next episode and verify the previous episode remains listed.

- [ ] **Step 6: Commit verification docs if behavior differs**

If Crunchyroll metadata does not produce good series names, update `docs/crunchyroll-adapter-notes.md` with the observed selectors or title patterns:

```bash
git add docs/crunchyroll-adapter-notes.md
git commit -m "Document Crunchyroll progress metadata behavior"
```

---

## Acceptance Criteria

- Mini-panel has a collapsed "Resources" section.
- Opening Resources shows Crunchyroll, Netflix, YouTube, and Amazon provider folders.
- Only Crunchyroll records real progress in this iteration.
- Netflix, YouTube, and Amazon are visible placeholders and do not record anything.
- Crunchyroll progress persists across mini-panel close/open, page reload, and episode navigation.
- Progress writes only happen when a room is active.
- Series rows can expand into episode rows.
- Movie rows show one progress bar.
- UI remains compact inside the current panel and does not cover more video by default.
- Existing playback sync, reactions, Ghost Cam, and debug controls keep working.

---

## Future Backend Upgrade

This plan intentionally stores progress locally. When accounts are added, move storage to backend:

- `watch_sessions`: one row per room/provider/source item.
- `watch_progress`: one row per user/item/episode.
- Durable Object can keep live progress, but final progress should be flushed to Postgres at room end or every 30-60 seconds.
- The same `WatchProgressEntry` shape can become the payload for a future `PROGRESS_UPDATE` room event.
