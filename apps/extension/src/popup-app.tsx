import {
  Check,
  ChevronDown,
  Film,
  Folder,
  Inbox,
  Link2,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentExtensionSession, signInWithWebsite } from "./auth-client";
import { WEB_HTTP_BASE } from "./constants";
import { loadCrunchyrollPosterArtwork } from "./crunchyroll-artwork";
import { popupStyles } from "./popup-styles";
import {
  acceptRoomInvite,
  declineRoomInvite,
  listInviteTargets,
  listRoomInvites,
  type FriendGroup,
  type FriendListItem,
  type InviteTargets,
  type RoomInvite,
  type RoomInvitesResponse,
} from "./social-client";
import {
  buildProviderFolders,
  createEmptyWatchProgressStore,
  formatProgressClock,
  loadWatchProgressStore,
  normalizeWatchProgressStore,
  recordWatchProgressInStore,
  WATCH_PROGRESS_STORAGE_KEY,
  type ProviderFolder,
  type StoredEpisodeProgress,
  type StoredWatchItem,
  type WatchProgressStore,
} from "./watch-progress";
import {
  createRoomFromWatchSession,
  reconcileWatchProgress,
  watchProgressEntriesFromStore,
  type WatchLibraryEpisode,
  type WatchLibraryResponse,
  type WatchLibrarySession,
} from "./watch-library-client";

type PopupTab = "resources" | "friends" | "inbox";

type SocialPanelData = {
  targets: InviteTargets;
  invites: RoomInvitesResponse;
};

type SocialPanelState =
  | { status: "loading"; data: SocialPanelData | null; error: null }
  | { status: "signed-out"; data: null; error: null }
  | { status: "ready"; data: SocialPanelData; error: null }
  | { status: "error"; data: SocialPanelData | null; error: string };

type WatchLibraryState =
  | { status: "loading"; data: WatchLibraryResponse | null; error: null }
  | { status: "signed-out"; data: null; error: null }
  | { status: "ready"; data: WatchLibraryResponse; error: null }
  | { status: "error"; data: WatchLibraryResponse | null; error: string };

export function PopupApp() {
  const [store, setStore] = useState<WatchProgressStore>(() => createEmptyWatchProgressStore());
  const [activeTab, setActiveTab] = useState<PopupTab>("resources");
  const [socialState, setSocialState] = useState<SocialPanelState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [watchLibraryState, setWatchLibraryState] = useState<WatchLibraryState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [busyWatchSessionId, setBusyWatchSessionId] = useState<string | null>(null);
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>({
    crunchyroll: true,
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const posterRequestsRef = useRef<Record<string, boolean>>({});
  const displayStore = useMemo(
    () => mergeWatchLibraryIntoStore(store, watchLibraryState.data),
    [store, watchLibraryState.data],
  );
  const folders = useMemo(() => buildProviderFolders(displayStore), [displayStore]);
  const libraryEpisodesByKey = useMemo(
    () => buildLibraryEpisodeIndex(watchLibraryState.data),
    [watchLibraryState.data],
  );
  const socialCount = socialState.data
    ? socialState.data.targets.friends.length + socialState.data.targets.groups.length
    : 0;
  const pendingInviteCount =
    socialState.data?.invites.inbox.filter((invite) => roomInviteCanBeAccepted(invite)).length ??
    0;

  const loadSocial = useCallback(async (interactive = false) => {
    setSocialState((current) => ({
      status: "loading",
      data: current.data,
      error: null,
    }));
    try {
      const tokens = interactive ? await signInWithWebsite() : await getCurrentExtensionSession();
      if (!tokens) {
        setSocialState({ status: "signed-out", data: null, error: null });
        return;
      }

      const [targets, invites] = await Promise.all([
        listInviteTargets(tokens.accessToken),
        listRoomInvites(tokens.accessToken),
      ]);
      setSocialState({ status: "ready", data: { targets, invites }, error: null });
    } catch (error) {
      setSocialState((current) => ({
        status: "error",
        data: current.data,
        error: error instanceof Error ? error.message : "Could not load friends",
      }));
    }
  }, []);

  const loadWatchLibrary = useCallback(
    async (localStore: WatchProgressStore, interactive = false) => {
      setWatchLibraryState((current) => ({
        status: "loading",
        data: current.data,
        error: null,
      }));
      try {
        const tokens = interactive ? await signInWithWebsite() : await getCurrentExtensionSession();
        if (!tokens) {
          setWatchLibraryState({ status: "signed-out", data: null, error: null });
          return;
        }

        const entries = watchProgressEntriesFromStore(localStore);
        const library = await reconcileWatchProgress(tokens.accessToken, entries);
        setWatchLibraryState({ status: "ready", data: library, error: null });
      } catch (error) {
        setWatchLibraryState((current) => ({
          status: "error",
          data: current.data,
          error: error instanceof Error ? error.message : "Could not sync watch history",
        }));
      }
    },
    [],
  );

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      setBusyInviteId(inviteId);
      try {
        const tokens = await getCurrentExtensionSession();
        if (!tokens) {
          setSocialState({ status: "signed-out", data: null, error: null });
          return;
        }
        const accepted = await acceptRoomInvite(tokens.accessToken, inviteId);
        await loadSocial(false);
        await chrome.tabs.create({ url: accepted.joinUrl });
      } catch (error) {
        setSocialState((current) => ({
          status: "error",
          data: current.data,
          error: error instanceof Error ? error.message : "Could not accept invite",
        }));
      } finally {
        setBusyInviteId(null);
      }
    },
    [loadSocial],
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      setBusyInviteId(inviteId);
      try {
        const tokens = await getCurrentExtensionSession();
        if (!tokens) {
          setSocialState({ status: "signed-out", data: null, error: null });
          return;
        }
        await declineRoomInvite(tokens.accessToken, inviteId);
        await loadSocial(false);
      } catch (error) {
        setSocialState((current) => ({
          status: "error",
          data: current.data,
          error: error instanceof Error ? error.message : "Could not decline invite",
        }));
      } finally {
        setBusyInviteId(null);
      }
    },
    [loadSocial],
  );

  const createRoomFromSession = useCallback(
    async (session: WatchLibrarySession, sourceUrl: string) => {
      setBusyWatchSessionId(session.id);
      try {
        const tokens = await getCurrentExtensionSession();
        if (!tokens) {
          setWatchLibraryState({ status: "signed-out", data: null, error: null });
          return;
        }

        const room = await createRoomFromWatchSession({
          accessToken: tokens.accessToken,
          sessionId: session.id,
          clientRequestId: `watch-library:${session.id}:${Date.now()}`,
        });
        await chrome.tabs.create({ url: buildWatchRoomLaunchUrl(sourceUrl, room.roomId) });
        window.close();
      } catch (error) {
        setWatchLibraryState((current) => ({
          status: "error",
          data: current.data,
          error: error instanceof Error ? error.message : "Could not create room",
        }));
      } finally {
        setBusyWatchSessionId(null);
      }
    },
    [],
  );

  useEffect(() => {
    void loadWatchProgressStore().then((loadedStore) => {
      setStore(loadedStore);
      void loadWatchLibrary(loadedStore, false);
    });
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
  }, [loadSocial, loadWatchLibrary]);

  const totalItems = folders.reduce((sum, folder) => sum + folder.items.length, 0);
  const localItemsCount = useMemo(
    () => buildProviderFolders(store).reduce((sum, folder) => sum + folder.items.length, 0),
    [store],
  );
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
            aria-label="Clear local progress cache"
            className="popup-icon-button"
            disabled={!localItemsCount}
            title="Clear local progress cache"
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
        <button
          className="popup-tab"
          data-active={activeTab === "inbox"}
          type="button"
          role="tab"
          aria-selected={activeTab === "inbox"}
          onClick={() => setActiveTab("inbox")}
        >
          Inbox <span>{pendingInviteCount}</span>
        </button>
      </div>

      {activeTab === "resources" ? (
        <section className="popup-section">
          <div className="popup-section-header">
            <div className="popup-section-title">Resources</div>
            <button
              aria-label="Sync watch library"
              className="popup-mini-button"
              disabled={watchLibraryState.status === "loading"}
              title="Sync watch library"
              type="button"
              onClick={() => void loadWatchLibrary(store, false)}
            >
              <RefreshCw size={13} />
            </button>
          </div>
          {watchLibraryState.status === "error" ? (
            <div className="popup-social-empty" data-tone="error">
              <span>{watchLibraryState.error}</span>
              <button
                className="popup-primary-button"
                type="button"
                onClick={() => void loadWatchLibrary(store, false)}
              >
                Retry
              </button>
            </div>
          ) : null}
          <div className="popup-resource-list">
            {folders.map((folder) => (
              <ProviderRow
                key={folder.provider}
                folder={folder}
                busyWatchSessionId={busyWatchSessionId}
                libraryEpisodesByKey={libraryEpisodesByKey}
                open={Boolean(openProviders[folder.provider])}
                onCreateRoomFromSession={(session, sourceUrl) =>
                  void createRoomFromSession(session, sourceUrl)
                }
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
      ) : activeTab === "friends" ? (
        <SocialPanel
          state={socialState}
          onRefresh={() => void loadSocial(false)}
          onSignIn={() => void loadSocial(true)}
        />
      ) : (
        <InviteInboxPanel
          busyInviteId={busyInviteId}
          onAccept={(inviteId) => void acceptInvite(inviteId)}
          onDecline={(inviteId) => void declineInvite(inviteId)}
          onRefresh={() => void loadSocial(false)}
          onSignIn={() => void loadSocial(true)}
          state={socialState}
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
  const data = state.data;

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

      {state.status === "loading" && !data ? (
        <div className="popup-empty">Loading friends...</div>
      ) : null}

      {data ? <SocialTargets targets={data.targets} /> : null}
    </section>
  );
}

function InviteInboxPanel({
  busyInviteId,
  onAccept,
  onDecline,
  onRefresh,
  onSignIn,
  state,
}: {
  busyInviteId: string | null;
  onAccept: (inviteId: string) => void;
  onDecline: (inviteId: string) => void;
  onRefresh: () => void;
  onSignIn: () => void;
  state: SocialPanelState;
}) {
  const pendingInvites =
    state.data?.invites.inbox.filter((invite) => roomInviteCanBeAccepted(invite)) ?? [];

  return (
    <section className="popup-section">
      <div className="popup-section-header">
        <div className="popup-section-title">Inbox</div>
        <button
          aria-label="Refresh inbox"
          className="popup-mini-button"
          disabled={state.status === "loading"}
          title="Refresh inbox"
          type="button"
          onClick={onRefresh}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {state.status === "signed-out" ? (
        <div className="popup-social-empty">
          <Inbox size={18} />
          <span>Sign in to view room invites.</span>
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

      {state.status === "loading" && !state.data ? (
        <div className="popup-empty">Loading invites...</div>
      ) : null}

      {state.data ? (
        <div className="popup-social-list">
          {pendingInvites.length ? (
            pendingInvites.map((invite) => (
              <InviteInboxRow
                busy={busyInviteId === invite.id}
                invite={invite}
                key={invite.id}
                onAccept={() => onAccept(invite.id)}
                onDecline={() => onDecline(invite.id)}
              />
            ))
          ) : (
            <div className="popup-social-empty">
              <Inbox size={18} />
              <span>No pending room invites.</span>
            </div>
          )}

          <button
            className="popup-dashboard-button"
            type="button"
            onClick={() => {
              void chrome.tabs.create({
                url: new URL("/account/invites", WEB_HTTP_BASE).toString(),
              });
            }}
          >
            Open dashboard
          </button>
        </div>
      ) : null}
    </section>
  );
}

function InviteInboxRow({
  busy,
  invite,
  onAccept,
  onDecline,
}: {
  busy: boolean;
  invite: RoomInvite;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="popup-inbox-card">
      <div className="popup-inbox-main">
        <ProfileAvatar avatarUrl={invite.sender.avatarUrl} displayName={invite.sender.displayName} />
        <span className="popup-social-main">
          <span>{invite.roomTitle ?? "Watch room invite"}</span>
          <span>From {invite.sender.displayName} · {formatInviteExpiry(invite.expiresAt)}</span>
        </span>
      </div>
      {invite.message ? <p className="popup-inbox-message">{invite.message}</p> : null}
      <div className="popup-inbox-actions">
        <button
          className="popup-primary-button"
          disabled={busy}
          type="button"
          onClick={onAccept}
        >
          <Check size={13} />
          Join
        </button>
        <button
          className="popup-secondary-button"
          disabled={busy}
          type="button"
          onClick={onDecline}
        >
          <X size={13} />
          Decline
        </button>
      </div>
    </div>
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

function getViewerInviteStatus(invite: RoomInvite): string {
  return invite.recipients[0]?.status ?? "pending";
}

function roomInviteCanBeAccepted(invite: RoomInvite): boolean {
  return getViewerInviteStatus(invite) === "pending" && !roomInviteExpired(invite);
}

function roomInviteExpired(invite: RoomInvite): boolean {
  return new Date(invite.expiresAt).getTime() <= Date.now();
}

function formatInviteExpiry(expiresAt: string): string {
  const expires = new Date(expiresAt).getTime();
  if (!Number.isFinite(expires)) return "expires soon";
  const minutes = Math.max(0, Math.ceil((expires - Date.now()) / 60000));
  if (minutes <= 1) return "expires now";
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.ceil(hours / 24);
  return `${days}d left`;
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

function buildLibraryEpisodeIndex(
  library: WatchLibraryResponse | null,
): Map<string, WatchLibraryEpisode> {
  const index = new Map<string, WatchLibraryEpisode>();
  for (const item of library?.items ?? []) {
    for (const episode of item.episodes) {
      index.set(libraryEpisodeKey(item.provider, item.itemKey, episode.episodeKey), episode);
    }
  }
  return index;
}

function libraryEpisodeKey(
  provider: string,
  itemKey: string,
  episodeKey: string,
): string {
  return `${provider}:${itemKey}:${episodeKey}`;
}

function mergeWatchLibraryIntoStore(
  localStore: WatchProgressStore,
  library: WatchLibraryResponse | null,
): WatchProgressStore {
  let nextStore = localStore;
  for (const item of library?.items ?? []) {
    for (const episode of item.episodes) {
      const observedAt = new Date(episode.lastWatchedAt).getTime();
      if (!Number.isFinite(observedAt)) {
        continue;
      }
      const existingItem = nextStore.providers[item.provider]?.items[item.itemKey];
      const existingEpisode =
        item.itemKind === "series" ? existingItem?.episodes?.[episode.episodeKey] : existingItem;
      if (existingEpisode && existingEpisode.lastWatchedAt >= observedAt) {
        continue;
      }

      const latestSession = episode.sessions[0] ?? null;
      nextStore = recordWatchProgressInStore(
        nextStore,
        {
          provider: item.provider,
          kind: item.itemKind === "series" ? "episode" : "movie",
          itemId: item.itemKey,
          itemTitle: item.itemTitle,
          contentId: episode.episodeKey,
          episodeId: episode.episodeKey,
          episodeTitle: episode.episodeTitle,
          artworkUrl: item.artworkUrl ?? undefined,
          sourceUrl: episode.sourceUrl,
          currentTime: episode.currentTime,
          duration: episode.duration,
          roomId: latestSession?.roomId ?? undefined,
          watchedWithCount: Math.max(1, latestSession?.participants.length ?? 1),
        },
        observedAt,
      );
    }
  }
  return nextStore;
}

function ProviderRow({
  busyWatchSessionId,
  folder,
  libraryEpisodesByKey,
  open,
  onCreateRoomFromSession,
  onToggle,
  openItems,
  onToggleItem,
}: {
  busyWatchSessionId: string | null;
  folder: ProviderFolder;
  libraryEpisodesByKey: Map<string, WatchLibraryEpisode>;
  open: boolean;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
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
                busyWatchSessionId={busyWatchSessionId}
                key={item.id}
                item={item}
                libraryEpisodesByKey={libraryEpisodesByKey}
                open={Boolean(openItems[item.id])}
                onCreateRoomFromSession={onCreateRoomFromSession}
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
  busyWatchSessionId,
  item,
  libraryEpisodesByKey,
  open,
  onCreateRoomFromSession,
  onToggle,
}: {
  busyWatchSessionId: string | null;
  item: StoredWatchItem;
  libraryEpisodesByKey: Map<string, WatchLibraryEpisode>;
  open: boolean;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
  onToggle: () => void;
}) {
  const episodes = Object.values(item.episodes ?? {}).sort(
    (a, b) => b.lastWatchedAt - a.lastWatchedAt,
  );
  const isSeries = item.kind === "series";

  if (!isSeries) {
    return (
      <MovieRow
        busyWatchSessionId={busyWatchSessionId}
        item={item}
        libraryEpisode={libraryEpisodesByKey.get(libraryEpisodeKey(item.provider, item.id, item.id))}
        onCreateRoomFromSession={onCreateRoomFromSession}
      />
    );
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
            <EpisodeRow
              busyWatchSessionId={busyWatchSessionId}
              episode={episode}
              episodeIndex={index}
              key={episode.id}
              libraryEpisode={libraryEpisodesByKey.get(
                libraryEpisodeKey(item.provider, item.id, episode.id),
              )}
              onCreateRoomFromSession={onCreateRoomFromSession}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MovieRow({
  busyWatchSessionId,
  item,
  libraryEpisode,
  onCreateRoomFromSession,
}: {
  busyWatchSessionId: string | null;
  item: StoredWatchItem;
  libraryEpisode?: WatchLibraryEpisode;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
}) {
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
          <SharedProgressTracker
            busySessionId={busyWatchSessionId}
            episode={movieEpisode}
            libraryEpisode={libraryEpisode}
            onCreateRoomFromSession={onCreateRoomFromSession}
            compact
          />
        </span>
      </div>
    </div>
  );
}

function EpisodeRow({
  busyWatchSessionId,
  episode,
  episodeIndex,
  libraryEpisode,
  onCreateRoomFromSession,
}: {
  busyWatchSessionId: string | null;
  episode: StoredEpisodeProgress;
  episodeIndex: number;
  libraryEpisode?: WatchLibraryEpisode;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
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
        <SharedProgressTracker
          busySessionId={busyWatchSessionId}
          episode={episode}
          libraryEpisode={libraryEpisode}
          onCreateRoomFromSession={onCreateRoomFromSession}
          compact
        />
      </span>
    </div>
  );
}

function SharedProgressTracker({
  busySessionId,
  episode,
  libraryEpisode,
  onCreateRoomFromSession,
  compact = false,
}: {
  busySessionId: string | null;
  episode: StoredEpisodeProgress;
  libraryEpisode?: WatchLibraryEpisode;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
  compact?: boolean;
}) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const sessions = libraryEpisode?.sessions ?? [];
  const layeredSessions = getLayeredSessions(sessions);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  return (
    <div className={compact ? "shared-progress compact" : "shared-progress"}>
      <span className="shared-progress-track" data-active={Boolean(activeSession)}>
        {layeredSessions.map((session) => (
          <span
            className={`shared-progress-segment ${sessionVisualKind(session)}`}
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
            aria-label={`${sessionLabel(session)}: ${getSessionTimeLabel(session, episode.duration)}`}
            className={`shared-progress-marker ${sessionVisualKind(session)}`}
            data-tooltip={getSessionTooltip(session, episode.duration)}
            key={`${session.id}-marker`}
            onClick={(event) => {
              event.stopPropagation();
              setActiveSessionId((current) => (current === session.id ? null : session.id));
            }}
            style={{ left: `${getMarkerPercent(session.progress)}%` }}
            type="button"
          >
            <AvatarStack participants={session.participants} compact />
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
              <span>{sessionLabel(activeSession)}</span>
              <span>{getSessionTimeLabel(activeSession, episode.duration)}</span>
            </span>
            <span className="shared-session-friends">
              {activeSession.participants.map((participant) => (
                <span className="shared-session-friend" key={participant.user.userId}>
                  <Avatar participant={participant} />
                  <span>{participant.user.displayName}</span>
                </span>
              ))}
            </span>
            <button
              className="shared-session-action"
              disabled={busySessionId === activeSession.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActiveSessionId(null);
                onCreateRoomFromSession(activeSession, libraryEpisode?.sourceUrl ?? episode.sourceUrl);
              }}
            >
              {busySessionId === activeSession.id ? "Creating..." : "Create room"}
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

function AvatarStack({
  participants,
  compact,
}: {
  participants: WatchLibraryParticipantLike[];
  compact?: boolean;
}) {
  const visible = participants.slice(0, 5);
  return (
    <span className={compact ? "avatar-stack compact" : "avatar-stack"}>
      {visible.map((participant) => (
        <Avatar participant={participant} key={participant.user.userId} />
      ))}
    </span>
  );
}

function Avatar({ participant }: { participant: WatchLibraryParticipantLike }) {
  return (
    <span className="shared-avatar" style={{ background: avatarGradient(participant.user.userId) }}>
      {getInitials(participant.user.displayName)}
    </span>
  );
}

type WatchLibraryParticipantLike = WatchLibrarySession["participants"][number];

function getLayeredSessions(sessions: WatchLibrarySession[]): WatchLibrarySession[] {
  return [...sessions].sort((a, b) => b.progress - a.progress);
}

function getSessionTooltip(session: WatchLibrarySession, duration: number): string {
  return `${sessionLabel(session)} · ${getSessionTimeLabel(session, duration)}`;
}

function getSessionTimeLabel(session: WatchLibrarySession, duration: number): string {
  return formatTimePair(clampProgress(session.progress) * duration, duration);
}

function sessionLabel(session: WatchLibrarySession): string {
  if (session.kind === "shared") {
    const others = session.participants.filter((participant) => participant.role !== "host");
    const count = Math.max(1, others.length || session.participants.length);
    return count === 1 ? "Watched together" : `Watched together · ${count}`;
  }
  return "Your progress";
}

function sessionVisualKind(session: WatchLibrarySession): "friends" | "solo" {
  return session.kind === "shared" ? "friends" : "solo";
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

function avatarGradient(seed: string): string {
  const gradients = [
    "linear-gradient(135deg, #60a5fa, #8b5cf6)",
    "linear-gradient(135deg, #fb7185, #f472b6)",
    "linear-gradient(135deg, #34d399, #22c55e)",
    "linear-gradient(135deg, #f59e0b, #ef4444)",
    "linear-gradient(135deg, #38bdf8, #06b6d4)",
    "linear-gradient(135deg, #a78bfa, #5b6cff)",
  ];
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length] ?? gradients[0];
}

function buildWatchRoomLaunchUrl(sourceUrl: string, roomId: string): string {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported URL");
    }

    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    params.set("anidachiRoom", roomId);
    url.hash = params.toString();
    return url.toString();
  } catch {
    return new URL(`/room/${encodeURIComponent(roomId)}`, WEB_HTTP_BASE).toString();
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
