import {
  ChevronDown,
  Film,
  Folder,
  Link2,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentExtensionSession, signInWithWebsite } from "./auth-client";
import { WEB_HTTP_BASE } from "./constants";
import { loadCrunchyrollPosterArtwork } from "./crunchyroll-artwork";
import { popupStyles } from "./popup-styles";
import {
  listInviteTargets,
  type FriendGroup,
  type FriendListItem,
  type InviteTargets,
} from "./social-client";
import {
  buildProviderFolders,
  createEmptyWatchProgressStore,
  formatProgressClock,
  loadWatchProgressStore,
  normalizeWatchProgressStore,
  WATCH_PROGRESS_STORAGE_KEY,
  type ProviderFolder,
  type StoredEpisodeProgress,
  type StoredWatchItem,
  type WatchProgressStore,
} from "./watch-progress";

type PopupTab = "resources" | "friends";

type SocialPanelState =
  | { status: "loading"; targets: InviteTargets | null; error: null }
  | { status: "signed-out"; targets: null; error: null }
  | { status: "ready"; targets: InviteTargets; error: null }
  | { status: "error"; targets: InviteTargets | null; error: string };

export function PopupApp() {
  const [store, setStore] = useState<WatchProgressStore>(() => createEmptyWatchProgressStore());
  const [activeTab, setActiveTab] = useState<PopupTab>("resources");
  const [socialState, setSocialState] = useState<SocialPanelState>({
    status: "loading",
    targets: null,
    error: null,
  });
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>({
    crunchyroll: true,
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const posterRequestsRef = useRef<Record<string, boolean>>({});
  const folders = useMemo(() => buildProviderFolders(store), [store]);
  const socialCount = socialState.targets
    ? socialState.targets.friends.length + socialState.targets.groups.length
    : 0;

  const loadSocial = useCallback(async (interactive = false) => {
    setSocialState((current) => ({
      status: "loading",
      targets: current.targets,
      error: null,
    }));
    try {
      const tokens = interactive ? await signInWithWebsite() : await getCurrentExtensionSession();
      if (!tokens) {
        setSocialState({ status: "signed-out", targets: null, error: null });
        return;
      }

      const targets = await listInviteTargets(tokens.accessToken);
      setSocialState({ status: "ready", targets, error: null });
    } catch (error) {
      setSocialState((current) => ({
        status: "error",
        targets: current.targets,
        error: error instanceof Error ? error.message : "Could not load friends",
      }));
    }
  }, []);

  useEffect(() => {
    void loadWatchProgressStore().then(setStore);
    void loadSocial(false);

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[WATCH_PROGRESS_STORAGE_KEY]) {
        return;
      }

      setStore(normalizeWatchProgressStore(changes[WATCH_PROGRESS_STORAGE_KEY].newValue));
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [loadSocial]);

  const totalItems = folders.reduce((sum, folder) => sum + folder.items.length, 0);
  useEffect(() => {
    const missingPosters = folders
      .flatMap((folder) => folder.items)
      .filter(
        (item) =>
          item.provider === "crunchyroll" &&
          !item.artworkUrl &&
          Boolean(getArtworkRequestKey(item)) &&
          !posterRequestsRef.current[getArtworkRequestKey(item) ?? ""],
      );

    for (const item of missingPosters) {
      const requestKey = getArtworkRequestKey(item);
      if (!requestKey) {
        continue;
      }

      posterRequestsRef.current[requestKey] = true;
      void loadCrunchyrollPosterArtwork({
        contentId: item.contentId ?? getCrunchyrollWatchId(item.sourceUrl),
        seriesId: item.seriesId,
      }).then(async (posterUrl) => {
        if (!posterUrl) {
          delete posterRequestsRef.current[requestKey];
          return;
        }

        const latestStore = await loadWatchProgressStore();
        const latestItem = latestStore.providers.crunchyroll.items[item.id];
        if (!latestItem || latestItem.artworkUrl) {
          return;
        }

        const nextStore = structuredClone(latestStore);
        const nextItem = nextStore.providers.crunchyroll.items[item.id];
        if (!nextItem) {
          return;
        }

        nextItem.artworkUrl = posterUrl;
        await chrome.storage.local.set({ [WATCH_PROGRESS_STORAGE_KEY]: nextStore });
        setStore(nextStore);
      });
    }
  }, [folders]);

  const clearHistory = async () => {
    await chrome.storage.local.remove(WATCH_PROGRESS_STORAGE_KEY);
    setStore(createEmptyWatchProgressStore());
  };

  return (
    <main className="popup-shell">
      <style>{popupStyles}</style>
      <header className="popup-header">
        <div>
          <div className="popup-brand">Anidachi</div>
          <div className="popup-subtitle">
            {totalItems ? `${totalItems} saved items` : "No saved progress yet"}
          </div>
        </div>
        <div className="popup-header-actions">
          <button
            aria-label="Clear watch history"
            className="popup-icon-button"
            disabled={!totalItems}
            title="Clear watch history"
            type="button"
            onClick={clearHistory}
          >
            <Trash2 size={14} />
          </button>
          <button
            aria-label="Reload popup"
            className="popup-icon-button"
            title="Reload popup"
            type="button"
            onClick={() => location.reload()}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </header>

      <div className="popup-tabs" role="tablist" aria-label="Popup sections">
        <button
          className="popup-tab"
          data-active={activeTab === "resources"}
          type="button"
          role="tab"
          aria-selected={activeTab === "resources"}
          onClick={() => setActiveTab("resources")}
        >
          Resources <span>{totalItems}</span>
        </button>
        <button
          className="popup-tab"
          data-active={activeTab === "friends"}
          type="button"
          role="tab"
          aria-selected={activeTab === "friends"}
          onClick={() => setActiveTab("friends")}
        >
          Friends <span>{socialCount}</span>
        </button>
      </div>

      {activeTab === "resources" ? (
        <section className="popup-section">
          <div className="popup-section-title">Resources</div>
          <div className="popup-resource-list">
            {folders.map((folder) => (
              <ProviderRow
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
                onToggleItem={(itemId) =>
                  setOpenItems((current) => ({
                    ...current,
                    [itemId]: !current[itemId],
                  }))
                }
              />
            ))}
          </div>
        </section>
      ) : (
        <SocialPanel
          state={socialState}
          onRefresh={() => void loadSocial(false)}
          onSignIn={() => void loadSocial(true)}
        />
      )}
    </main>
  );
}

function SocialPanel({
  onRefresh,
  onSignIn,
  state,
}: {
  onRefresh: () => void;
  onSignIn: () => void;
  state: SocialPanelState;
}) {
  const targets = state.targets;

  return (
    <section className="popup-section">
      <div className="popup-section-header">
        <div className="popup-section-title">Friends & Groups</div>
        <button
          aria-label="Refresh friends and groups"
          className="popup-mini-button"
          disabled={state.status === "loading"}
          title="Refresh friends and groups"
          type="button"
          onClick={onRefresh}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {state.status === "signed-out" ? (
        <div className="popup-social-empty">
          <Users size={18} />
          <span>Sign in to view friends and groups.</span>
          <button className="popup-primary-button" type="button" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="popup-social-empty" data-tone="error">
          <span>{state.error}</span>
          <button className="popup-primary-button" type="button" onClick={onRefresh}>
            Retry
          </button>
        </div>
      ) : null}

      {state.status === "loading" && !targets ? (
        <div className="popup-empty">Loading friends...</div>
      ) : null}

      {targets ? <SocialTargets targets={targets} /> : null}
    </section>
  );
}

function SocialTargets({ targets }: { targets: InviteTargets }) {
  return (
    <div className="popup-social-list">
      <div className="popup-social-block">
        <div className="popup-social-heading">
          <span>Friends</span>
          <span>{targets.friends.length}</span>
        </div>
        {targets.friends.length ? (
          targets.friends.map((friend) => (
            <SocialFriendRow friend={friend} key={friend.friendshipId} />
          ))
        ) : (
          <div className="popup-empty">No friends yet.</div>
        )}
      </div>

      <div className="popup-social-block">
        <div className="popup-social-heading">
          <span>Groups</span>
          <span>{targets.groups.length}</span>
        </div>
        {targets.groups.length ? (
          targets.groups.map((group) => <SocialGroupRow group={group} key={group.id} />)
        ) : (
          <div className="popup-empty">No groups yet.</div>
        )}
      </div>

      <button
        className="popup-dashboard-button"
        type="button"
        onClick={() => {
          void chrome.tabs.create({
            url: new URL("/account/friends", WEB_HTTP_BASE).toString(),
          });
        }}
      >
        Open dashboard
      </button>
    </div>
  );
}

function SocialFriendRow({ friend }: { friend: FriendListItem }) {
  return (
    <div className="popup-social-row">
      <ProfileAvatar
        avatarUrl={friend.user.avatarUrl}
        displayName={friend.user.displayName}
      />
      <span className="popup-social-main">
        <span>{friend.user.displayName}</span>
        <span>{friend.user.handle ? `@${friend.user.handle}` : "AniDachi user"}</span>
      </span>
    </div>
  );
}

function SocialGroupRow({ group }: { group: FriendGroup }) {
  return (
    <div className="popup-social-row">
      <span className="popup-social-group-icon">
        <Users size={15} />
      </span>
      <span className="popup-social-main">
        <span>{group.name}</span>
        <span>{group.members.length} members</span>
      </span>
    </div>
  );
}

function ProfileAvatar({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  if (avatarUrl) {
    return <img className="popup-social-avatar" src={avatarUrl} alt="" loading="lazy" />;
  }

  return <span className="popup-social-avatar">{getInitials(displayName)}</span>;
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  );
}

function ProviderRow({
  folder,
  open,
  onToggle,
  openItems,
  onToggleItem,
}: {
  folder: ProviderFolder;
  open: boolean;
  onToggle: () => void;
  openItems: Record<string, boolean>;
  onToggleItem: (itemId: string) => void;
}) {
  const [activeKind, setActiveKind] = useState<"series" | "movie">("series");
  const seriesCount = folder.items.filter((item) => item.kind === "series").length;
  const movieCount = folder.items.filter((item) => item.kind === "movie").length;
  const hasKindTabs =
    folder.provider === "crunchyroll" && Boolean(seriesCount) && Boolean(movieCount);
  const visibleItems = hasKindTabs
    ? folder.items.filter((item) => item.kind === activeKind)
    : folder.items;

  useEffect(() => {
    if (activeKind === "series" && !seriesCount && movieCount) {
      setActiveKind("movie");
    } else if (activeKind === "movie" && !movieCount && seriesCount) {
      setActiveKind("series");
    }
  }, [activeKind, movieCount, seriesCount]);

  return (
    <div className="popup-provider">
      <button className="popup-provider-row" type="button" onClick={onToggle}>
        <span className={`resource-provider-logo ${folder.provider}`}>
          {folder.provider === "crunchyroll" ? <span /> : folder.label.slice(0, 1)}
        </span>
        <span className="popup-provider-main">
          <span className="popup-provider-name">{folder.label}</span>
          <span className="popup-provider-meta">
            {formatProviderCount(folder.items.length, seriesCount, movieCount)}
          </span>
        </span>
        <span className="popup-provider-chevron" data-open={open}>
          <ChevronDown size={18} />
        </span>
      </button>

      {open ? (
        <div className="popup-provider-body">
          {hasKindTabs ? (
            <div className="popup-kind-tabs" role="tablist" aria-label="Crunchyroll watch type">
              <button
                className="popup-kind-tab"
                data-active={activeKind === "series"}
                type="button"
                role="tab"
                aria-selected={activeKind === "series"}
                onClick={() => setActiveKind("series")}
              >
                Series <span>{seriesCount}</span>
              </button>
              <button
                className="popup-kind-tab"
                data-active={activeKind === "movie"}
                type="button"
                role="tab"
                aria-selected={activeKind === "movie"}
                onClick={() => setActiveKind("movie")}
              >
                Movies <span>{movieCount}</span>
              </button>
            </div>
          ) : null}

          {visibleItems.length ? (
            visibleItems.map((item) => (
              <WatchItemRow
                key={item.id}
                item={item}
                open={Boolean(openItems[item.id])}
                onToggle={() => onToggleItem(item.id)}
              />
            ))
          ) : (
            <div className="popup-empty">Progress will appear here after watching together.</div>
          )}
          {folder.provider === "crunchyroll" && folder.items.length ? <InviteFooter /> : null}
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
  const episodes = Object.values(item.episodes ?? {}).sort(
    (a, b) => b.lastWatchedAt - a.lastWatchedAt,
  );
  const isSeries = item.kind === "series";

  if (!isSeries) {
    return <MovieRow item={item} />;
  }

  return (
    <div className="popup-watch-item" data-kind="series">
      <button className="popup-watch-row" type="button" onClick={onToggle}>
        <span
          className="popup-watch-artwork"
          data-has-artwork={Boolean(item.artworkUrl)}
          aria-hidden="true"
        >
          {item.artworkUrl ? (
            <img src={item.artworkUrl} alt="" loading="lazy" />
          ) : (
            <Folder size={16} />
          )}
        </span>
        <span className="popup-watch-main">
          <span className="popup-watch-title">{item.title}</span>
          <span className="popup-watch-meta">{episodes.length} episodes</span>
        </span>
        <span className="popup-watch-chevron" data-open={open}>
          <ChevronDown size={16} />
        </span>
      </button>

      {open ? (
        <div className="popup-episode-list">
          {episodes.map((episode, index) => (
            <EpisodeRow episode={episode} episodeIndex={index} key={episode.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MovieRow({ item }: { item: StoredWatchItem }) {
  const movieEpisode = getMovieEpisodeProgress(item);

  return (
    <div className="popup-watch-item" data-kind="movie">
      <div className="popup-movie-card">
        <button
          className="popup-card-link"
          type="button"
          onClick={() => openWatchUrl(item.sourceUrl)}
          aria-label={`Open ${item.title}`}
        />
        <span
          className="popup-watch-artwork popup-movie-artwork"
          data-has-artwork={Boolean(item.artworkUrl)}
          aria-hidden="true"
        >
          {item.artworkUrl ? (
            <img src={item.artworkUrl} alt="" loading="lazy" />
          ) : (
            <Film size={15} />
          )}
        </span>
        <span className="popup-episode-main">
          <span className="popup-episode-header">
            <span className="popup-episode-number">Movie</span>
            <span className="popup-episode-title">{item.title}</span>
          </span>
          <SharedProgressTracker episode={movieEpisode} episodeIndex={0} compact />
        </span>
      </div>
    </div>
  );
}

function EpisodeRow({
  episode,
  episodeIndex,
}: {
  episode: StoredEpisodeProgress;
  episodeIndex: number;
}) {
  const selected = episodeIndex === 0;

  return (
    <div className="popup-episode-row" data-selected={selected}>
      <button
        className="popup-card-link"
        type="button"
        onClick={() => openWatchUrl(episode.sourceUrl)}
        aria-label={`Open ${stripEpisodePrefix(episode.title)}`}
      />
      <span className="popup-episode-main">
        <span className="popup-episode-header">
          <span className="popup-episode-number">
            {getEpisodeLabel(episode.title, episodeIndex)}
          </span>
          <span className="popup-episode-title">{stripEpisodePrefix(episode.title)}</span>
        </span>
        <SharedProgressTracker episode={episode} episodeIndex={episodeIndex} compact />
      </span>
    </div>
  );
}

interface DemoFriend {
  id: string;
  name: string;
  initials: string;
  color: string;
}

interface DemoWatchSession {
  id: string;
  label: string;
  detail: string;
  actionLabel: string;
  kind: "friends" | "date" | "solo";
  progress: number;
  friends: DemoFriend[];
}

const DEMO_FRIENDS: Record<string, DemoFriend> = {
  you: {
    id: "you",
    name: "You",
    initials: "YU",
    color: "linear-gradient(135deg, #60a5fa, #8b5cf6)",
  },
  alina: {
    id: "alina",
    name: "Alina",
    initials: "AL",
    color: "linear-gradient(135deg, #fb7185, #f472b6)",
  },
  maxim: {
    id: "maxim",
    name: "Max",
    initials: "MX",
    color: "linear-gradient(135deg, #34d399, #22c55e)",
  },
  denis: {
    id: "denis",
    name: "Denis",
    initials: "DN",
    color: "linear-gradient(135deg, #f59e0b, #ef4444)",
  },
  ira: {
    id: "ira",
    name: "Ira",
    initials: "IR",
    color: "linear-gradient(135deg, #38bdf8, #06b6d4)",
  },
};

function SharedProgressTracker({
  episode,
  episodeIndex,
  compact = false,
}: {
  episode: StoredEpisodeProgress;
  episodeIndex: number;
  compact?: boolean;
}) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const sessions = getDemoSessions(episode, episodeIndex);
  const layeredSessions = getLayeredSessions(sessions);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  return (
    <div className={compact ? "shared-progress compact" : "shared-progress"}>
      <span className="shared-progress-track" data-active={Boolean(activeSession)}>
        {layeredSessions.map((session) => (
          <span
            className={`shared-progress-segment ${session.kind}`}
            data-tooltip={getSessionTooltip(session, episode.duration)}
            key={session.id}
            style={{
              width: `${toPercent(session.progress)}%`,
              zIndex: getSegmentLayer(session.progress),
            }}
          />
        ))}
        <span
          className="shared-progress-base"
          style={{ width: `${toPercent(episode.progress)}%` }}
        />
        {sessions.map((session) => (
          <button
            aria-expanded={activeSessionId === session.id}
            aria-label={`${session.label}: ${getSessionTimeLabel(session, episode.duration)}`}
            className={`shared-progress-marker ${session.kind}`}
            data-tooltip={getSessionTooltip(session, episode.duration)}
            key={`${session.id}-marker`}
            onClick={(event) => {
              event.stopPropagation();
              setActiveSessionId((current) => (current === session.id ? null : session.id));
            }}
            style={{ left: `${getMarkerPercent(session.progress)}%` }}
            type="button"
          >
            <AvatarStack friends={session.friends} compact />
          </button>
        ))}
        {activeSession ? (
          <span
            className="shared-session-popover"
            data-align={getPopoverAlign(activeSession.progress)}
            role="dialog"
            style={{ left: `${getMarkerPercent(activeSession.progress)}%` }}
          >
            <span className="shared-session-topline">
              <span>{activeSession.label}</span>
              <span>{getSessionTimeLabel(activeSession, episode.duration)}</span>
            </span>
            <span className="shared-session-friends">
              {activeSession.friends.map((friend) => (
                <span className="shared-session-friend" key={friend.id}>
                  <Avatar friend={friend} />
                  <span>{friend.name}</span>
                </span>
              ))}
            </span>
            <button
              className="shared-session-action"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActiveSessionId(null);
              }}
            >
              {activeSession.actionLabel}
            </button>
          </span>
        ) : null}
      </span>
    </div>
  );
}

function InviteFooter() {
  return (
    <footer className="popup-invite-footer">
      <span className="popup-invite-icon">
        <UserPlus size={17} />
      </span>
      <span className="popup-invite-copy">
        <span>Invite friends</span>
        <span>Share the link and watch together</span>
      </span>
      <button className="popup-copy-button" type="button">
        <Link2 size={13} />
        Copy link
      </button>
    </footer>
  );
}

function AvatarStack({ friends, compact }: { friends: DemoFriend[]; compact?: boolean }) {
  return (
    <span className={compact ? "avatar-stack compact" : "avatar-stack"}>
      {friends.map((friend) => (
        <Avatar friend={friend} key={friend.id} />
      ))}
    </span>
  );
}

function Avatar({ friend }: { friend: DemoFriend }) {
  return (
    <span className="shared-avatar" style={{ background: friend.color }}>
      {friend.initials}
    </span>
  );
}

function getDemoSessions(episode: StoredEpisodeProgress, episodeIndex: number): DemoWatchSession[] {
  const soloProgress = clampProgress(Math.max(episode.progress, 0.42));
  const dateProgress = clampProgress(Math.max(Math.min(episode.progress, 0.62), 0.5));

  if (episodeIndex === 0) {
    return [
      {
        id: `${episode.id}-date`,
        label: "Досмотреть с Алиной",
        detail: `${Math.round(dateProgress * 100)}%`,
        actionLabel: "Создать комнату",
        kind: "date",
        progress: dateProgress,
        friends: [DEMO_FRIENDS.alina],
      },
      {
        id: `${episode.id}-friends`,
        label: "Смотрели вместе",
        detail: "5 друзей",
        actionLabel: "Собрать группу",
        kind: "friends",
        progress: 1,
        friends: [
          DEMO_FRIENDS.you,
          DEMO_FRIENDS.alina,
          DEMO_FRIENDS.maxim,
          DEMO_FRIENDS.denis,
          DEMO_FRIENDS.ira,
        ],
      },
    ];
  }

  if (episodeIndex === 1) {
    return [
      {
        id: `${episode.id}-solo`,
        label: "Ты смотрел один",
        detail: `${Math.round(soloProgress * 100)}%`,
        actionLabel: "Продолжить",
        kind: "solo",
        progress: soloProgress,
        friends: [DEMO_FRIENDS.you],
      },
      {
        id: `${episode.id}-date`,
        label: "План с Алиной",
        detail: "на выходные",
        actionLabel: "Создать комнату",
        kind: "date",
        progress: 0.5,
        friends: [DEMO_FRIENDS.alina],
      },
    ];
  }

  if (episodeIndex === 2) {
    return [
      {
        id: `${episode.id}-friends`,
        label: "Смотрели вместе",
        detail: "4 друга",
        actionLabel: "Повторить комнату",
        kind: "friends",
        progress: clampProgress(Math.max(episode.progress, 0.78)),
        friends: [DEMO_FRIENDS.maxim, DEMO_FRIENDS.alina, DEMO_FRIENDS.denis, DEMO_FRIENDS.you],
      },
    ];
  }

  return [
    {
      id: `${episode.id}-solo`,
      label: "Личный прогресс",
      detail: `${Math.round(soloProgress * 100)}%`,
      actionLabel: "Продолжить",
      kind: "solo",
      progress: soloProgress,
      friends: [DEMO_FRIENDS.you],
    },
  ];
}

function getLayeredSessions(sessions: DemoWatchSession[]): DemoWatchSession[] {
  return [...sessions].sort((a, b) => b.progress - a.progress);
}

function getSessionTooltip(session: DemoWatchSession, duration: number): string {
  return `${session.label} · ${getSessionTimeLabel(session, duration)}`;
}

function getSessionTimeLabel(session: DemoWatchSession, duration: number): string {
  return formatTimePair(clampProgress(session.progress) * duration, duration);
}

function getPopoverAlign(progress: number): "left" | "center" | "right" {
  if (progress < 0.24) {
    return "left";
  }

  if (progress > 0.76) {
    return "right";
  }

  return "center";
}

function getMovieEpisodeProgress(item: StoredWatchItem): StoredEpisodeProgress {
  return {
    id: item.id,
    title: item.title,
    sourceUrl: item.sourceUrl,
    currentTime: item.currentTime,
    duration: item.duration,
    progress: item.progress,
    ...(item.lastRoomId ? { lastRoomId: item.lastRoomId } : {}),
    watchedWithCount: item.watchedWithCount,
    lastWatchedAt: item.lastWatchedAt,
  };
}

function getEpisodeLabel(title: string, fallbackIndex: number): string {
  const match = title.match(/\bE\s?(\d+)\b/i) ?? title.match(/^(\d+)[\s.:-]/);
  return match ? `E${match[1]}` : `E${fallbackIndex + 1}`;
}

function stripEpisodePrefix(title: string): string {
  return title
    .replace(/^\s*E\s?\d+\s*[-:–—]\s*/i, "")
    .replace(/^\s*\d+\s*[-:–—.]\s*/, "")
    .trim();
}

function getSegmentLayer(progress: number): number {
  return 2 + Math.round((1 - clampProgress(progress)) * 12);
}

function toPercent(progress: number): number {
  return Math.round(clampProgress(progress) * 1000) / 10;
}

function getMarkerPercent(progress: number): number {
  return Math.max(7, Math.min(94, toPercent(progress)));
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
}

function formatTimePair(currentTime: number, duration: number): string {
  return `${formatProgressClock(currentTime)} / ${formatProgressClock(duration)}`;
}

function formatProviderCount(total: number, seriesCount: number, movieCount: number): string {
  if (!total) {
    return "0 titles";
  }

  const parts = [
    seriesCount ? `${seriesCount} series` : "",
    movieCount ? `${movieCount} ${movieCount === 1 ? "movie" : "movies"}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : `${total} titles`;
}

function getArtworkRequestKey(item: StoredWatchItem): string | null {
  if (item.seriesId) {
    return `series:${item.seriesId}`;
  }

  const contentId = item.contentId ?? getCrunchyrollWatchId(item.sourceUrl);
  return contentId ? `content:${contentId}` : null;
}

function getCrunchyrollWatchId(sourceUrl: string): string | undefined {
  try {
    const url = new URL(sourceUrl);
    if (!url.hostname.endsWith("crunchyroll.com")) {
      return undefined;
    }

    return url.pathname.match(/\/watch\/([^/?#]+)/)?.[1];
  } catch {
    return undefined;
  }
}

function openWatchUrl(sourceUrl: string): void {
  if (!sourceUrl) {
    return;
  }

  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return;
    }

    void chrome.tabs.create({ url: url.toString(), active: true });
    window.close();
  } catch {
    // Ignore malformed local history entries.
  }
}
