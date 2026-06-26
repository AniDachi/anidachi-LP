import {
  Check,
  ChevronDown,
  Filter,
  Film,
  Folder,
  Grid2X2,
  Inbox,
  LogIn,
  Mail,
  Play,
  Pencil,
  RefreshCw,
  Settings,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  getCachedExtensionSession,
  getCurrentExtensionSession,
  signInWithWebsite,
  signInWithWebsiteSilently,
} from "./auth-client";
import type { ExtensionAuthTokens } from "./auth-tokens";
import { WEB_HTTP_BASE } from "./constants";
import { loadCrunchyrollPosterArtwork } from "./crunchyroll-artwork";
import {
  inferCrunchyrollSeasonFromSourceUrl,
  seasonNumberFromTitle,
} from "./crunchyroll-season";
import { popupStyles } from "./popup-styles";
import {
  acceptRoomInvite,
  addFriendGroupMember,
  archiveFriendGroup,
  createFriendGroup,
  declineRoomInvite,
  listInviteTargets,
  listRoomInvites,
  removeFriendGroupMember,
  type FriendGroup,
  type FriendListItem,
  type InviteTargets,
  type RoomInvite,
  type RoomInvitesResponse,
  updateFriendGroup,
} from "./social-client";
import {
  buildProviderFolders,
  clearWatchProgressStoreForUser,
  createEmptyWatchProgressStore,
  formatProgressClock,
  loadWatchProgressStoreForUser,
  normalizeWatchProgressStore,
  recordWatchProgressInStore,
  saveWatchProgressStoreForUser,
  watchProgressStorageKeyForUser,
  type ProviderFolder,
  type StoredEpisodeProgress,
  type StoredWatchItem,
  type WatchProgressStore,
} from "./watch-progress";
import {
  clearCachedWatchLibrary,
  clearWatchLibrary,
  clearWatchLibrarySyncWatermark,
  createRoomFromWatchSession,
  getCachedWatchLibraryForUser,
  getWatchLibrarySyncWatermark,
  isWatchLibraryCacheFresh,
  listWatchLibrary,
  reconcileWatchProgress,
  setCachedWatchLibraryForUser,
  setWatchLibrarySyncWatermark,
  watchProgressEntriesFromStore,
  type WatchLibraryEpisode,
  type WatchLibraryResponse,
  type WatchLibrarySession,
} from "./watch-library-client";

type PopupTab = "resources" | "friends" | "inbox";
type LibraryActivityFilter = "all" | "solo" | "together";
type LibraryPersonFilter = "all" | `user:${string}` | `group:${string}`;

type LibraryCompanionFilter = {
  value: LibraryPersonFilter;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  sessionCount: number;
};

type LibraryFilterOptions = {
  activity: LibraryActivityFilter;
  person: LibraryPersonFilter;
  groupMemberUserIds?: Set<string>;
};

type SocialPanelData = {
  targets: InviteTargets;
  invites: RoomInvitesResponse;
};

type PopupNotice = {
  tone: "success" | "error";
  text: string;
};

type ContinueRowMode = "solo" | "together" | "group";

type EpisodeSeasonGroup = {
  key: string;
  title: string;
  known: boolean;
  sortNumber: number | null;
  latestWatchedAt: number;
  episodes: StoredEpisodeProgress[];
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

type AuthSessionState =
  | { status: "loading"; tokens: null; error: null }
  | { status: "signed-out"; tokens: null; error: null }
  | { status: "ready"; tokens: ExtensionAuthTokens; error: null }
  | { status: "error"; tokens: null; error: string };

export function PopupApp() {
  const [store, setStore] = useState<WatchProgressStore>(() => createEmptyWatchProgressStore());
  const [activeTab, setActiveTab] = useState<PopupTab>("resources");
  const [authSession, setAuthSession] = useState<AuthSessionState>({
    status: "loading",
    tokens: null,
    error: null,
  });
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
  const [busySocialAction, setBusySocialAction] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState<PopupNotice | null>(null);
  const [busyWatchSessionId, setBusyWatchSessionId] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [libraryActivityFilter, setLibraryActivityFilter] = useState<LibraryActivityFilter>("solo");
  const [libraryPersonFilter, setLibraryPersonFilter] = useState<LibraryPersonFilter>("all");
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>({
    crunchyroll: true,
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const posterRequestsRef = useRef<Record<string, boolean>>({});
  const storeUserIdRef = useRef<string | null>(null);
  const accountUser = authSession.status === "ready" ? authSession.tokens.user : null;
  const displayStore = useMemo(
    () => mergeWatchLibraryIntoStore(store, watchLibraryState.data),
    [store, watchLibraryState.data],
  );
  const folders = useMemo(() => buildProviderFolders(displayStore), [displayStore]);
  const libraryEpisodesByKey = useMemo(
    () => buildLibraryEpisodeIndex(watchLibraryState.data),
    [watchLibraryState.data],
  );
  const libraryFilterOptions = useMemo<LibraryFilterOptions>(() => {
    const person = libraryActivityFilter === "together" ? libraryPersonFilter : "all";
    const selectedGroupId = person.startsWith("group:") ? person.slice("group:".length) : null;
    const selectedGroup = selectedGroupId
      ? socialState.data?.targets.groups.find((group) => group.id === selectedGroupId)
      : null;
    return {
      activity: libraryActivityFilter,
      person,
      ...(selectedGroup
        ? { groupMemberUserIds: new Set(selectedGroup.members.map((member) => member.user.userId)) }
        : {}),
    };
  }, [libraryActivityFilter, libraryPersonFilter, socialState.data?.targets.groups]);
  const filteredFolders = useMemo(
    () => filterProviderFolders(folders, libraryEpisodesByKey, libraryFilterOptions),
    [folders, libraryEpisodesByKey, libraryFilterOptions],
  );
  const companionFilters = useMemo(
    () => buildCompanionFilters(watchLibraryState.data, accountUser?.id ?? null),
    [watchLibraryState.data, accountUser?.id],
  );
  const libraryFilterCounts = useMemo(
    () => ({
      all: countProviderItems(folders),
      solo: countProviderItems(
        filterProviderFolders(folders, libraryEpisodesByKey, {
          activity: "solo",
          person: "all",
        }),
      ),
      together: countProviderItems(
        filterProviderFolders(folders, libraryEpisodesByKey, {
          activity: "together",
          person: "all",
        }),
      ),
    }),
    [folders, libraryEpisodesByKey],
  );
  const socialCount = socialState.data
    ? socialState.data.targets.friends.length + socialState.data.targets.groups.length
    : 0;
  const pendingInviteCount =
    socialState.data?.invites.inbox.filter((invite) => roomInviteCanBeAccepted(invite)).length ?? 0;

  const ensureStoreForUser = useCallback(
    async (
      userId: string | null,
      currentStore: WatchProgressStore,
    ): Promise<WatchProgressStore> => {
      if (storeUserIdRef.current === userId) {
        return currentStore;
      }

      const scopedStore = await loadWatchProgressStoreForUser(userId);
      storeUserIdRef.current = userId;
      setStore(scopedStore);
      return scopedStore;
    },
    [],
  );

  const loadSocialForTokens = useCallback(async (tokens: ExtensionAuthTokens) => {
    setSocialState((current) => ({
      status: "loading",
      data: current.data,
      error: null,
    }));
    try {
      const [targets, invites] = await Promise.all([
        listInviteTargets(tokens.accessToken),
        listRoomInvites(tokens.accessToken),
      ]);
      setSocialState({
        status: "ready",
        data: { targets, invites },
        error: null,
      });
    } catch (error) {
      setSocialState((current) => ({
        status: "error",
        data: current.data,
        error: error instanceof Error ? error.message : "Could not load friends",
      }));
    }
  }, []);

  const loadWatchLibraryForTokens = useCallback(
    async (tokens: ExtensionAuthTokens, localStore: WatchProgressStore, useCachedSnapshot = true) => {
      try {
        const cached = useCachedSnapshot
          ? await getCachedWatchLibraryForUser(tokens.user.id)
          : null;
        if (useCachedSnapshot) {
          if (cached) {
            setWatchLibraryState({
              status: "ready",
              data: cached.library,
              error: null,
            });
          } else {
            setWatchLibraryState((current) => ({
              status: "loading",
              data: current.data,
              error: null,
            }));
          }
        } else {
          setWatchLibraryState((current) => ({
            status: "loading",
            data: current.data,
            error: null,
          }));
        }

        // The overlay reconciles progress live during playback, so the popup
        // only needs to backfill local progress newer than our last successful
        // sync instead of re-sending the entire local store on every open.
        const watermark = await getWatchLibrarySyncWatermark(tokens.user.id);
        const entries = watchProgressEntriesFromStore(localStore, "reconcile", watermark);
        if (cached && entries.length === 0 && isWatchLibraryCacheFresh(cached)) {
          return;
        }

        const library = entries.length
          ? await reconcileWatchProgress(tokens.accessToken, entries)
          : await listWatchLibrary(tokens.accessToken);
        if (entries.length) {
          const latestObservedAt = entries.reduce(
            (max, entry) => Math.max(max, Number(entry.observedAt ?? 0)),
            watermark,
          );
          await setWatchLibrarySyncWatermark(tokens.user.id, latestObservedAt);
        }
        await setCachedWatchLibraryForUser(tokens.user.id, library);
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

  const syncPopupData = useCallback(
    async (
      localStore: WatchProgressStore,
      options: {
        interactive?: boolean;
        tokens?: ExtensionAuthTokens;
        useCachedSnapshot?: boolean;
      } = {},
    ): Promise<ExtensionAuthTokens | null> => {
      try {
        if (!options.tokens && !options.interactive) {
          const cachedTokens = await getCachedExtensionSession();
          if (cachedTokens) {
            setAuthSession({ status: "ready", tokens: cachedTokens, error: null });
            if (options.useCachedSnapshot ?? true) {
              const cachedLibrary = await getCachedWatchLibraryForUser(cachedTokens.user.id);
              if (cachedLibrary) {
                setWatchLibraryState({
                  status: "ready",
                  data: cachedLibrary.library,
                  error: null,
                });
              }
            }
          }
        }

        const tokens =
          options.tokens ??
          (options.interactive
            ? await signInWithWebsite()
            : (await getCurrentExtensionSession({ validateWebsiteSession: true })) ??
              (await signInWithWebsiteSilently()));
        if (!tokens) {
          await ensureStoreForUser(null, localStore);
          setAuthSession({ status: "signed-out", tokens: null, error: null });
          setSocialState({ status: "signed-out", data: null, error: null });
          setWatchLibraryState({
            status: "signed-out",
            data: null,
            error: null,
          });
          return null;
        }

        const scopedStore = await ensureStoreForUser(tokens.user.id, localStore);
        setAuthSession({ status: "ready", tokens, error: null });
        await Promise.all([
          loadWatchLibraryForTokens(tokens, scopedStore, options.useCachedSnapshot ?? true),
          loadSocialForTokens(tokens),
        ]);
        return tokens;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not sync account";
        setAuthSession({ status: "error", tokens: null, error: message });
        setSocialState((current) => ({
          status: "error",
          data: current.data,
          error: message,
        }));
        setWatchLibraryState((current) => ({
          status: "error",
          data: current.data,
          error: message,
        }));
        return null;
      }
    },
    [ensureStoreForUser, loadSocialForTokens, loadWatchLibraryForTokens],
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
        setAuthSession({ status: "ready", tokens, error: null });
        await loadSocialForTokens(tokens);
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
    [loadSocialForTokens],
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
        setAuthSession({ status: "ready", tokens, error: null });
        await loadSocialForTokens(tokens);
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
    [loadSocialForTokens],
  );

  const upsertSocialGroup = useCallback((group: FriendGroup) => {
    setSocialState((current) => {
      if (!current.data) return current;
      const groups = current.data.targets.groups.some((item) => item.id === group.id)
        ? current.data.targets.groups.map((item) => (item.id === group.id ? group : item))
        : [group, ...current.data.targets.groups];
      return {
        ...current,
        data: {
          ...current.data,
          targets: {
            ...current.data.targets,
            groups: groups.filter((item) => !item.archivedAt),
          },
        },
      };
    });
  }, []);

  const patchSocialGroup = useCallback((groupId: string, updater: (group: FriendGroup) => FriendGroup) => {
    let previous: FriendGroup | null = null;
    setSocialState((current) => {
      if (!current.data) return current;
      return {
        ...current,
        data: {
          ...current.data,
          targets: {
            ...current.data.targets,
            groups: current.data.targets.groups.map((group) => {
              if (group.id !== groupId) return group;
              previous = group;
              return updater(group);
            }),
          },
        },
      };
    });
    return previous;
  }, []);

  const runSocialAction = useCallback(
    async (
      key: string,
      action: (accessToken: string) => Promise<unknown>,
      success: string,
      fallbackError: string,
    ): Promise<boolean> => {
      setBusySocialAction(key);
      setSocialNotice(null);
      try {
        const tokens = await getCurrentExtensionSession();
        if (!tokens) {
          setSocialState({ status: "signed-out", data: null, error: null });
          return false;
        }

        setAuthSession({ status: "ready", tokens, error: null });
        await action(tokens.accessToken);
        setSocialNotice({ tone: "success", text: success });
        return true;
      } catch (error) {
        setSocialNotice({
          tone: "error",
          text: error instanceof Error ? error.message : fallbackError,
        });
        return false;
      } finally {
        setBusySocialAction(null);
      }
    },
    [],
  );

  const createGroup = useCallback(
    async (name: string) =>
      runSocialAction(
        "create-group",
        async (accessToken) => {
          const group = await createFriendGroup(accessToken, { name });
          upsertSocialGroup(group);
        },
        "Group created.",
        "Could not create group",
      ),
    [runSocialAction, upsertSocialGroup],
  );

  const renameGroup = useCallback(
    async (groupId: string, name: string) =>
      runSocialAction(
        `rename-group:${groupId}`,
        async (accessToken) => {
          const updatedAt = new Date().toISOString();
          const previous = patchSocialGroup(groupId, (group) => ({
            ...group,
            name,
            updatedAt,
          }));
          try {
            const group = await updateFriendGroup(accessToken, { groupId, name });
            upsertSocialGroup(group);
          } catch (error) {
            if (previous) upsertSocialGroup(previous);
            throw error;
          }
        },
        "Group renamed.",
        "Could not rename group",
      ),
    [patchSocialGroup, runSocialAction, upsertSocialGroup],
  );

  const archiveGroup = useCallback(
    async (groupId: string) =>
      runSocialAction(
        `archive-group:${groupId}`,
        async (accessToken) => {
          let previous: FriendGroup | null = null;
          setSocialState((current) => {
            if (!current.data) return current;
            return {
              ...current,
              data: {
                ...current.data,
                targets: {
                  ...current.data.targets,
                  groups: current.data.targets.groups.filter((group) => {
                    if (group.id !== groupId) return true;
                    previous = group;
                    return false;
                  }),
                },
              },
            };
          });
          try {
            await archiveFriendGroup(accessToken, groupId);
          } catch (error) {
            if (previous) upsertSocialGroup(previous);
            throw error;
          }
        },
        "Group archived.",
        "Could not archive group",
      ),
    [runSocialAction, upsertSocialGroup],
  );

  const addGroupMember = useCallback(
    async (groupId: string, userId: string) =>
      runSocialAction(
        `add-member:${groupId}:${userId}`,
        async (accessToken) => {
          const friend = socialState.data?.targets.friends.find(
            (item) => item.user.userId === userId,
          );
          const previous = friend
            ? patchSocialGroup(groupId, (group) =>
                addOptimisticMember(group, friend, new Date().toISOString()),
              )
            : null;
          try {
            const group = await addFriendGroupMember(accessToken, { groupId, userId });
            upsertSocialGroup(group);
          } catch (error) {
            if (previous) upsertSocialGroup(previous);
            throw error;
          }
        },
        "Friend added.",
        "Could not add friend",
      ),
    [patchSocialGroup, runSocialAction, socialState.data?.targets.friends, upsertSocialGroup],
  );

  const removeGroupMember = useCallback(
    async (groupId: string, userId: string) =>
      runSocialAction(
        `remove-member:${groupId}:${userId}`,
        async (accessToken) => {
          const previous = patchSocialGroup(groupId, (group) =>
            removeOptimisticMember(group, userId, new Date().toISOString()),
          );
          try {
            const group = await removeFriendGroupMember(accessToken, { groupId, userId });
            upsertSocialGroup(group);
          } catch (error) {
            if (previous) upsertSocialGroup(previous);
            throw error;
          }
        },
        "Member removed.",
        "Could not remove member",
      ),
    [patchSocialGroup, runSocialAction, upsertSocialGroup],
  );

  const createRoomFromSession = useCallback(async (session: WatchLibrarySession, sourceUrl: string) => {
    setBusyWatchSessionId(session.id);
    try {
      const tokens = await getCurrentExtensionSession();
      if (!tokens) {
        setWatchLibraryState({
          status: "signed-out",
          data: null,
          error: null,
        });
        return;
      }
      setAuthSession({ status: "ready", tokens, error: null });

      const room = await createRoomFromWatchSession({
        accessToken: tokens.accessToken,
        sessionId: session.id,
        clientRequestId: `watch-library:${session.id}:${Date.now()}`,
      });
      await chrome.tabs.create({
        url: buildWatchRoomLaunchUrl(sourceUrl, room.roomId),
      });
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loadedStore = await loadWatchProgressStoreForUser(null);
      if (cancelled) return;
      storeUserIdRef.current = null;
      setStore(loadedStore);
      void syncPopupData(loadedStore, {
        useCachedSnapshot: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [syncPopupData]);

  useEffect(() => {
    const storageKey = watchProgressStorageKeyForUser(accountUser?.id ?? null);
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "local" || !changes[storageKey]) {
        return;
      }

      setStore(normalizeWatchProgressStore(changes[storageKey].newValue));
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [accountUser?.id]);

  useEffect(() => {
    if (libraryActivityFilter !== "together" && libraryPersonFilter !== "all") {
      setLibraryPersonFilter("all");
    }
  }, [libraryActivityFilter, libraryPersonFilter]);

  useEffect(() => {
    if (
      libraryPersonFilter !== "all" &&
      !companionFilters.some((filter) => filter.value === libraryPersonFilter) &&
      !socialState.data?.targets.groups.some((group) => `group:${group.id}` === libraryPersonFilter)
    ) {
      setLibraryPersonFilter("all");
    }
  }, [companionFilters, libraryPersonFilter, socialState.data?.targets.groups]);

  const totalItems = folders.reduce((sum, folder) => sum + folder.items.length, 0);
  const filteredItemsCount = filteredFolders.reduce((sum, folder) => sum + folder.items.length, 0);
  const localItemsCount = useMemo(
    () => buildProviderFolders(store).reduce((sum, folder) => sum + folder.items.length, 0),
    [store],
  );
  const serverItemsCount = watchLibraryState.data?.items.length ?? 0;
  const canClearHistory = localItemsCount > 0 || serverItemsCount > 0;
  const authChecking = authSession.status === "loading";
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

        const currentUserId = storeUserIdRef.current;
        const latestStore = await loadWatchProgressStoreForUser(currentUserId);
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
        await saveWatchProgressStoreForUser(currentUserId, nextStore);
        setStore(nextStore);
      });
    }
  }, [folders]);

  const clearHistory = async () => {
    if (clearingHistory || !canClearHistory) return;
    const confirmed = window.confirm(
      "Clear watch history for this AniDachi account and this browser?",
    );
    if (!confirmed) return;

    setClearingHistory(true);
    setWatchLibraryState((current) =>
      current.data ? { status: "loading", data: current.data, error: null } : current,
    );
    try {
      const tokens = authSession.status === "ready" ? authSession.tokens : await getCachedExtensionSession();
      const currentUserId = tokens?.user.id ?? storeUserIdRef.current;
      const clearedLibrary = tokens ? await clearWatchLibrary(tokens.accessToken) : null;

      await Promise.all([
        clearWatchProgressStoreForUser(currentUserId),
        clearCachedWatchLibrary(),
        clearWatchLibrarySyncWatermark(),
      ]);

      const emptyStore = createEmptyWatchProgressStore();
      storeUserIdRef.current = currentUserId;
      setStore(emptyStore);
      if (tokens && clearedLibrary) {
        await setCachedWatchLibraryForUser(tokens.user.id, clearedLibrary);
        setWatchLibraryState({ status: "ready", data: clearedLibrary, error: null });
      } else {
        setWatchLibraryState({ status: "signed-out", data: null, error: null });
      }
    } catch (error) {
      setWatchLibraryState((current) => ({
        status: "error",
        data: current.data,
        error: error instanceof Error ? error.message : "Could not clear watch history",
      }));
    } finally {
      setClearingHistory(false);
    }
  };

  const openAccount = async () => {
    const tokens =
      authSession.status === "ready"
        ? authSession.tokens
        : await syncPopupData(store, {
            interactive: true,
            useCachedSnapshot: true,
          });
    if (!tokens) return;
    await chrome.tabs.create({
      url: new URL("/account", WEB_HTTP_BASE).toString(),
    });
  };

  return (
    <main className="popup-shell">
      <style>{popupStyles}</style>
      <header className="popup-topbar">
        <button
          aria-label={accountUser ? "Open account dashboard" : authChecking ? "Checking account" : "Sign in"}
          className="popup-profile-button"
          type="button"
          disabled={authChecking}
          onClick={() => void openAccount()}
        >
          <span className="popup-profile-avatar" data-signed-in={Boolean(accountUser)}>
            {accountUser ? (
              <ProfileAvatar avatarUrl={accountUser.avatarUrl} displayName={accountUser.displayName} />
            ) : authChecking ? (
              <RefreshCw size={18} />
            ) : (
              <LogIn size={18} />
            )}
            <span className="popup-presence-dot" />
          </span>
          <span className="popup-profile-copy">
            <span className="popup-brand">AniDachi</span>
            <span className="popup-subtitle">
              {accountUser ? (
                <>
                  Signed in <span>·</span> <strong>{planLabel(accountUser.plan)}</strong>
                </>
              ) : authChecking ? (
                "Checking account..."
              ) : (
                "Sign in to sync progress"
              )}
            </span>
          </span>
        </button>
        <div className="popup-header-actions">
          <button
            aria-label="Open account dashboard"
            className="popup-command-button"
            type="button"
            onClick={() => void openAccount()}
          >
            <Grid2X2 size={18} />
            <span>Dashboard</span>
          </button>
          <button
            aria-label="Sync popup data"
            className="popup-command-button"
            disabled={watchLibraryState.status === "loading"}
            type="button"
            onClick={() => void syncPopupData(store, { useCachedSnapshot: false })}
          >
            <RefreshCw size={18} />
            <span>Sync</span>
          </button>
          <button
            aria-label="Open settings"
            className="popup-command-button"
            type="button"
            onClick={() => void openAccount()}
          >
            <Settings size={18} />
            <span>Settings</span>
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
          <Play size={15} />
          Watch <span>{totalItems}</span>
        </button>
        <button
          className="popup-tab"
          data-active={activeTab === "friends"}
          type="button"
          role="tab"
          aria-selected={activeTab === "friends"}
          onClick={() => setActiveTab("friends")}
        >
          <Users size={15} />
          People <span>{socialCount}</span>
        </button>
        <button
          className="popup-tab"
          data-active={activeTab === "inbox"}
          type="button"
          role="tab"
          aria-selected={activeTab === "inbox"}
          onClick={() => setActiveTab("inbox")}
        >
          <Mail size={15} />
          Invites <span>{pendingInviteCount}</span>
        </button>
      </div>

      {activeTab === "resources" ? (
        <section className="popup-watch-screen">
          <div className="popup-watch-controls">
            <WatchModeBar
              activity={libraryActivityFilter}
              counts={libraryFilterCounts}
              onSelectActivity={(activity) => {
                setLibraryActivityFilter(activity);
                if (activity !== "together") {
                  setLibraryPersonFilter("all");
                }
              }}
            />
            {libraryActivityFilter === "together" ? (
              <TogetherFilterBar
                companions={companionFilters}
                groups={socialState.data?.targets.groups ?? []}
                selectedValue={libraryPersonFilter}
                onSelect={setLibraryPersonFilter}
              />
            ) : null}
          </div>

          {watchLibraryState.status === "error" ? (
            <div className="popup-social-empty" data-tone="error">
              <span>{watchLibraryState.error}</span>
              <button
                className="popup-primary-button"
                type="button"
                onClick={() => void syncPopupData(store, { useCachedSnapshot: false })}
              >
                Retry
              </button>
            </div>
          ) : null}
          {watchLibraryState.status === "loading" && !totalItems ? (
            <div className="popup-empty">Loading watch library...</div>
          ) : !filteredItemsCount ? (
            <LibraryEmptyState activity={libraryActivityFilter} personFilter={libraryPersonFilter} />
          ) : (
            <div className="popup-resource-list">
              {filteredFolders.map((folder) => (
                <ProviderRow
                  key={folder.provider}
                  folder={folder}
                  busyWatchSessionId={busyWatchSessionId}
                  filters={libraryFilterOptions}
                  libraryEpisodesByKey={libraryEpisodesByKey}
                  open={Boolean(openProviders[folder.provider])}
                  onCreateRoomFromSession={(session, sourceUrl) => void createRoomFromSession(session, sourceUrl)}
                  viewerUserId={accountUser?.id ?? null}
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
          )}
          <button
            aria-label="Clear watch history"
            className="popup-quiet-danger"
            disabled={!canClearHistory || clearingHistory}
            title="Clear watch history"
            type="button"
            onClick={clearHistory}
          >
            <Trash2 size={13} />
            {clearingHistory ? "Clearing..." : "Clear watch history"}
          </button>
        </section>
      ) : activeTab === "friends" ? (
        <SocialPanel
          busyAction={busySocialAction}
          notice={socialNotice}
          onAddGroupMember={addGroupMember}
          onArchiveGroup={archiveGroup}
          onCreateGroup={createGroup}
          state={socialState}
          onRefresh={() => void syncPopupData(store, { useCachedSnapshot: true })}
          onRemoveGroupMember={removeGroupMember}
          onRenameGroup={renameGroup}
          onSignIn={() =>
            void syncPopupData(store, {
              interactive: true,
              useCachedSnapshot: true,
            })
          }
        />
      ) : (
        <InviteInboxPanel
          busyInviteId={busyInviteId}
          onAccept={(inviteId) => void acceptInvite(inviteId)}
          onDecline={(inviteId) => void declineInvite(inviteId)}
          onRefresh={() => void syncPopupData(store, { useCachedSnapshot: true })}
          onSignIn={() =>
            void syncPopupData(store, {
              interactive: true,
              useCachedSnapshot: true,
            })
          }
          state={socialState}
        />
      )}
    </main>
  );
}

function WatchModeBar({
  activity,
  counts,
  onSelectActivity,
}: {
  activity: LibraryActivityFilter;
  counts: Record<LibraryActivityFilter, number>;
  onSelectActivity: (activity: LibraryActivityFilter) => void;
}) {
  return (
    <div className="popup-watch-mode-switch" role="tablist" aria-label="Watch history scope">
      <button
        aria-selected={activity === "solo"}
        data-active={activity === "solo"}
        role="tab"
        type="button"
        onClick={() => onSelectActivity("solo")}
      >
        <span>Mine</span>
        <strong>{counts.solo}</strong>
      </button>
      <button
        aria-selected={activity === "together"}
        data-active={activity === "together"}
        role="tab"
        type="button"
        onClick={() => onSelectActivity("together")}
      >
        <span>Together</span>
        <strong>{counts.together}</strong>
      </button>
    </div>
  );
}

function TogetherFilterBar({
  companions,
  groups,
  onSelect,
  selectedValue,
}: {
  companions: LibraryCompanionFilter[];
  groups: FriendGroup[];
  onSelect: (value: LibraryPersonFilter) => void;
  selectedValue: LibraryPersonFilter;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = getTogetherFilterLabel(selectedValue, companions, groups);
  const selectedCount =
    selectedValue === "all"
      ? companions.length + groups.length
      : selectedValue.startsWith("group:")
        ? (groups.find((group) => `group:${group.id}` === selectedValue)?.members.length ?? 0)
        : (companions.find((companion) => companion.value === selectedValue)?.sessionCount ?? 0);

  const selectFilter = (value: LibraryPersonFilter) => {
    onSelect(value);
    setOpen(false);
  };

  return (
    <div className="popup-together-filter">
      <button
        aria-label={`Filter shared watch history: ${selectedLabel}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="popup-filter-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <Filter size={15} />
        <span>{selectedLabel}</span>
        <strong>{selectedCount}</strong>
      </button>
      {open ? (
        <div className="popup-filter-menu" role="group" aria-label="Together filters">
          <button
            aria-pressed={selectedValue === "all"}
            className="popup-filter-option"
            data-active={selectedValue === "all"}
            type="button"
            onClick={() => selectFilter("all")}
          >
            <span className="popup-filter-option-icon">
              <Users size={14} />
            </span>
            <span className="popup-filter-option-copy">
              <span>All shared</span>
              <small>Every shared session</small>
            </span>
            <Check size={14} />
          </button>

          <div className="popup-filter-section">
            <div className="popup-filter-section-title">People</div>
            {companions.length ? (
              companions.map((companion) => (
                <button
                  aria-pressed={selectedValue === companion.value}
                  className="popup-filter-option"
                  data-active={selectedValue === companion.value}
                  key={companion.userId}
                  title={companion.displayName}
                  type="button"
                  onClick={() => selectFilter(companion.value)}
                >
                  <span className="popup-companion-avatar" style={{ background: avatarGradient(companion.userId) }}>
                    {getInitials(companion.displayName)}
                  </span>
                  <span className="popup-filter-option-copy">
                    <span>{companion.displayName}</span>
                    <small>{companion.sessionCount} shared sessions</small>
                  </span>
                  <Check size={14} />
                </button>
              ))
            ) : (
              <div className="popup-filter-empty">No shared people yet.</div>
            )}
          </div>

          <div className="popup-filter-section">
            <div className="popup-filter-section-title">Groups</div>
            {groups.length ? (
              groups.map((group) => (
                <button
                  aria-pressed={selectedValue === `group:${group.id}`}
                  className="popup-filter-option"
                  data-active={selectedValue === `group:${group.id}`}
                  key={group.id}
                  title={group.name}
                  type="button"
                  onClick={() => selectFilter(`group:${group.id}`)}
                >
                  <span className="popup-filter-option-icon">
                    <Users size={14} />
                  </span>
                  <span className="popup-filter-option-copy">
                    <span>{group.name}</span>
                    <small>{group.members.length} members</small>
                  </span>
                  <Check size={14} />
                </button>
              ))
            ) : (
              <div className="popup-filter-empty">No groups yet.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getTogetherFilterLabel(
  selectedValue: LibraryPersonFilter,
  companions: LibraryCompanionFilter[],
  groups: FriendGroup[],
): string {
  if (selectedValue === "all") {
    return "All";
  }
  if (selectedValue.startsWith("group:")) {
    const group = groups.find((item) => `group:${item.id}` === selectedValue);
    return group?.name ?? "Group";
  }
  const companion = companions.find((item) => item.value === selectedValue);
  return companion?.displayName ?? "Person";
}

function continueCompanionLabel(
  participants: WatchLibraryParticipantLike[],
  viewerUserId: string | null,
): string {
  const names = participants
    .filter((participant) => !viewerUserId || participant.user.userId !== viewerUserId)
    .map((participant) => participant.user.displayName)
    .filter(Boolean);
  if (!names.length) {
    return "Together";
  }
  const first = names[0] ?? "friend";
  return names.length > 1 ? `with ${first} +${names.length - 1}` : `with ${first}`;
}

function continueModeLabel(mode: ContinueRowMode): string {
  if (mode === "group") return "Group";
  if (mode === "together") return "Together";
  return "Mine";
}

function SocialPanel({
  busyAction,
  notice,
  onAddGroupMember,
  onArchiveGroup,
  onCreateGroup,
  onRefresh,
  onRemoveGroupMember,
  onRenameGroup,
  onSignIn,
  state,
}: {
  busyAction: string | null;
  notice: PopupNotice | null;
  onAddGroupMember: (groupId: string, userId: string) => Promise<boolean>;
  onArchiveGroup: (groupId: string) => Promise<boolean>;
  onCreateGroup: (name: string) => Promise<boolean>;
  onRefresh: () => void;
  onRemoveGroupMember: (groupId: string, userId: string) => Promise<boolean>;
  onRenameGroup: (groupId: string, name: string) => Promise<boolean>;
  onSignIn: () => void;
  state: SocialPanelState;
}) {
  const data = state.data;
  const [groupName, setGroupName] = useState("");
  const createDisabled = !groupName.trim() || busyAction !== null;

  const submitCreateGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = groupName.trim();
    if (!name || busyAction) return;
    void onCreateGroup(name).then((ok) => {
      if (ok) setGroupName("");
    });
  };

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

      {state.status === "loading" && !data ? <div className="popup-empty">Loading friends...</div> : null}

      <div className="popup-social-notice-slot" aria-live="polite">
        {notice ? (
          <div className="popup-social-notice" data-tone={notice.tone} role="status">
            {notice.text}
          </div>
        ) : null}
      </div>

      {data ? (
        <SocialTargets
          busyAction={busyAction}
          createDisabled={createDisabled}
          groupName={groupName}
          onAddGroupMember={onAddGroupMember}
          onArchiveGroup={onArchiveGroup}
          onCreateGroupNameChange={setGroupName}
          onRemoveGroupMember={onRemoveGroupMember}
          onRenameGroup={onRenameGroup}
          onSubmitCreateGroup={submitCreateGroup}
          targets={data.targets}
        />
      ) : null}
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
  const pendingInvites = state.data?.invites.inbox.filter((invite) => roomInviteCanBeAccepted(invite)) ?? [];

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

      {state.status === "loading" && !state.data ? <div className="popup-empty">Loading invites...</div> : null}

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
          <span>
            From {invite.sender.displayName} · {formatInviteExpiry(invite.expiresAt)}
          </span>
        </span>
      </div>
      {invite.message ? <p className="popup-inbox-message">{invite.message}</p> : null}
      <div className="popup-inbox-actions">
        <button className="popup-primary-button" disabled={busy} type="button" onClick={onAccept}>
          <Check size={13} />
          Join
        </button>
        <button className="popup-secondary-button" disabled={busy} type="button" onClick={onDecline}>
          <X size={13} />
          Decline
        </button>
      </div>
    </div>
  );
}

function SocialTargets({
  busyAction,
  createDisabled,
  groupName,
  onAddGroupMember,
  onArchiveGroup,
  onCreateGroupNameChange,
  onRemoveGroupMember,
  onRenameGroup,
  onSubmitCreateGroup,
  targets,
}: {
  busyAction: string | null;
  createDisabled: boolean;
  groupName: string;
  onAddGroupMember: (groupId: string, userId: string) => Promise<boolean>;
  onArchiveGroup: (groupId: string) => Promise<boolean>;
  onCreateGroupNameChange: (name: string) => void;
  onRemoveGroupMember: (groupId: string, userId: string) => Promise<boolean>;
  onRenameGroup: (groupId: string, name: string) => Promise<boolean>;
  onSubmitCreateGroup: (event: FormEvent<HTMLFormElement>) => void;
  targets: InviteTargets;
}) {
  return (
    <div className="popup-social-list">
      <div className="popup-social-block">
        <div className="popup-social-heading">
          <span>Friends</span>
          <span>{targets.friends.length}</span>
        </div>
        {targets.friends.length ? (
          targets.friends.map((friend) => <SocialFriendRow friend={friend} key={friend.friendshipId} />)
        ) : (
          <div className="popup-empty">No friends yet.</div>
        )}
      </div>

      <div className="popup-social-block">
        <div className="popup-social-heading">
          <span>Groups</span>
          <span>{targets.groups.length}</span>
        </div>
        <form className="popup-group-create-form" onSubmit={onSubmitCreateGroup}>
          <input
            className="popup-group-name-input"
            disabled={busyAction !== null}
            maxLength={80}
            onChange={(event) => onCreateGroupNameChange(event.target.value)}
            placeholder="New group"
            value={groupName}
          />
          <button
            aria-label="Create group"
            className="popup-primary-button"
            disabled={createDisabled}
            type="submit"
          >
            <UserPlus size={13} />
            Create
          </button>
        </form>
        {targets.groups.length ? (
          targets.groups.map((group) => (
            <SocialGroupRow
              busyAction={busyAction}
              friends={targets.friends}
              group={group}
              key={group.id}
              onAddGroupMember={onAddGroupMember}
              onArchiveGroup={onArchiveGroup}
              onRemoveGroupMember={onRemoveGroupMember}
              onRenameGroup={onRenameGroup}
            />
          ))
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
      <ProfileAvatar avatarUrl={friend.user.avatarUrl} displayName={friend.user.displayName} />
      <span className="popup-social-main">
        <span>{friend.user.displayName}</span>
        <span>{friend.user.handle ? `@${friend.user.handle}` : "AniDachi user"}</span>
      </span>
    </div>
  );
}

function SocialGroupRow({
  busyAction,
  friends,
  group,
  onAddGroupMember,
  onArchiveGroup,
  onRemoveGroupMember,
  onRenameGroup,
}: {
  busyAction: string | null;
  friends: FriendListItem[];
  group: FriendGroup;
  onAddGroupMember: (groupId: string, userId: string) => Promise<boolean>;
  onArchiveGroup: (groupId: string) => Promise<boolean>;
  onRemoveGroupMember: (groupId: string, userId: string) => Promise<boolean>;
  onRenameGroup: (groupId: string, name: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const memberIds = useMemo(
    () => new Set(group.members.map((member) => member.user.userId)),
    [group.members],
  );
  const addableFriends = friends.filter((friend) => !memberIds.has(friend.user.userId));
  const renameBusy = busyAction === `rename-group:${group.id}`;
  const archiveBusy = busyAction === `archive-group:${group.id}`;
  const canSaveName = name.trim().length > 0 && name.trim() !== group.name && busyAction === null;

  useEffect(() => {
    if (!editing) setName(group.name);
  }, [editing, group.name]);

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || nextName === group.name || busyAction !== null) return;
    void onRenameGroup(group.id, nextName).then((ok) => {
      if (ok) setEditing(false);
    });
  };

  return (
    <div className="popup-group-card">
      <div className="popup-group-header">
        <span className="popup-social-group-icon">
          <Users size={15} />
        </span>
        <div className="popup-social-main">
          {editing ? (
            <form className="popup-group-edit-form" onSubmit={submitRename}>
              <input
                className="popup-group-name-input"
                disabled={busyAction !== null}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <button
                aria-label="Save group name"
                className="popup-mini-button"
                disabled={!canSaveName || renameBusy}
                title="Save group name"
                type="submit"
              >
                <Check size={13} />
              </button>
              <button
                aria-label="Cancel rename"
                className="popup-mini-button"
                disabled={renameBusy}
                title="Cancel rename"
                type="button"
                onClick={() => setEditing(false)}
              >
                <X size={13} />
              </button>
            </form>
          ) : (
            <>
              <span>{group.name}</span>
              <span>{group.members.length} members</span>
            </>
          )}
        </div>
        {!editing ? (
          <div className="popup-group-actions">
            <button
              aria-label={`Rename ${group.name}`}
              className="popup-mini-button"
              disabled={busyAction !== null}
              title="Rename group"
              type="button"
              onClick={() => setEditing(true)}
            >
              <Pencil size={13} />
            </button>
            <button
              aria-label={`Archive ${group.name}`}
              className="popup-mini-button popup-mini-button-danger"
              disabled={busyAction !== null}
              title="Archive group"
              type="button"
              onClick={() => {
                if (archiveBusy) return;
                const confirmed = window.confirm(`Archive "${group.name}"?`);
                if (confirmed) void onArchiveGroup(group.id);
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="popup-group-member-list">
        {group.members.length ? (
          group.members.map((member) => {
            const removeKey = `remove-member:${group.id}:${member.user.userId}`;
            return (
              <div className="popup-group-member-row" key={member.user.userId}>
                <ProfileAvatar
                  avatarUrl={member.user.avatarUrl}
                  displayName={member.user.displayName}
                />
                <span>{member.user.displayName}</span>
                <button
                  aria-label={`Remove ${member.user.displayName}`}
                  className="popup-mini-button"
                  disabled={busyAction !== null}
                  title="Remove member"
                  type="button"
                  onClick={() => void onRemoveGroupMember(group.id, member.user.userId)}
                >
                  {busyAction === removeKey ? <RefreshCw size={13} /> : <X size={13} />}
                </button>
              </div>
            );
          })
        ) : (
          <div className="popup-group-empty">No members yet.</div>
        )}
      </div>

      <div className="popup-group-add-row">
        <select
          className="popup-group-select"
          disabled={!addableFriends.length || busyAction !== null}
          value=""
          onChange={(event) => {
            const userId = event.target.value;
            if (userId) void onAddGroupMember(group.id, userId);
          }}
        >
          <option value="">{addableFriends.length ? "Add friend" : "No friends to add"}</option>
          {addableFriends.map((friend) => (
            <option key={friend.user.userId} value={friend.user.userId}>
              {friend.user.displayName}
            </option>
          ))}
        </select>
      </div>
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

function sortGroupMembers(members: FriendGroup["members"]): FriendGroup["members"] {
  return [...members].sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
}

function addOptimisticMember(
  group: FriendGroup,
  friend: FriendListItem,
  addedAt: string,
): FriendGroup {
  if (group.members.some((member) => member.user.userId === friend.user.userId)) {
    return group;
  }

  return {
    ...group,
    updatedAt: addedAt,
    members: sortGroupMembers([
      ...group.members,
      {
        user: friend.user,
        addedAt,
      },
    ]),
  };
}

function removeOptimisticMember(group: FriendGroup, userId: string, updatedAt: string): FriendGroup {
  return {
    ...group,
    updatedAt,
    members: group.members.filter((member) => member.user.userId !== userId),
  };
}

function ProfileAvatar({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string }) {
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

function planLabel(plan: string): string {
  if (plan === "plus") return "Plus";
  if (plan === "pro") return "Pro";
  return "Free";
}

function buildLibraryEpisodeIndex(library: WatchLibraryResponse | null): Map<string, WatchLibraryEpisode> {
  const index = new Map<string, WatchLibraryEpisode>();
  for (const item of library?.items ?? []) {
    for (const episode of item.episodes) {
      index.set(libraryEpisodeKey(item.provider, item.itemKey, episode.episodeKey), episode);
    }
  }
  return index;
}

function libraryEpisodeKey(provider: string, itemKey: string, episodeKey: string): string {
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
      const existingEpisode = item.itemKind === "series" ? existingItem?.episodes?.[episode.episodeKey] : existingItem;
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
          seasonId: episode.seasonId ?? undefined,
          seasonTitle: episode.seasonTitle ?? undefined,
          seasonNumber: episode.seasonNumber ?? undefined,
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

function CompanionFilterBar({
  companions,
  onSelect,
  selectedValue,
}: {
  companions: LibraryCompanionFilter[];
  onSelect: (value: LibraryPersonFilter) => void;
  selectedValue: LibraryPersonFilter;
}) {
  return (
    <div className="popup-companion-filter">
      <span className="popup-companion-filter-label">With</span>
      <div className="popup-companion-scroll" role="group" aria-label="People watched with">
        <button
          aria-pressed={selectedValue === "all"}
          className="popup-companion-chip"
          data-active={selectedValue === "all"}
          type="button"
          onClick={() => onSelect("all")}
        >
          All people
        </button>
        {companions.map((companion) => (
          <button
            aria-pressed={selectedValue === companion.value}
            className="popup-companion-chip"
            data-active={selectedValue === companion.value}
            key={companion.userId}
            title={companion.displayName}
            type="button"
            onClick={() => onSelect(companion.value)}
          >
            <span className="popup-companion-avatar" style={{ background: avatarGradient(companion.userId) }}>
              {getInitials(companion.displayName)}
            </span>
            <span>{companion.displayName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LibraryEmptyState({
  activity,
  personFilter,
}: {
  activity: LibraryActivityFilter;
  personFilter: LibraryPersonFilter;
}) {
  const message =
    activity === "together"
      ? personFilter === "all"
      ? "No shared watch history yet."
      : "No shared sessions with this person yet."
      : activity === "solo"
        ? "No personal watch progress yet."
        : "Progress will appear here after watching.";

  return <div className="popup-empty">{message}</div>;
}

function filterProviderFolders(
  folders: ProviderFolder[],
  libraryEpisodesByKey: Map<string, WatchLibraryEpisode>,
  filters: LibraryFilterOptions,
): ProviderFolder[] {
  const keepEmptyProviders = filters.activity === "all" && filters.person === "all";
  return folders
    .map((folder) => {
      const items = folder.items
        .map((item) => filterStoredWatchItem(item, libraryEpisodesByKey, filters))
        .filter((item): item is StoredWatchItem => item !== null)
        .sort(
          (a, b) =>
            getFilteredWatchItemLastWatchedAt(b, libraryEpisodesByKey, filters) -
            getFilteredWatchItemLastWatchedAt(a, libraryEpisodesByKey, filters),
        );

      return {
        ...folder,
        items,
      };
    })
    .filter((folder) => keepEmptyProviders || folder.items.length > 0);
}

function filterStoredWatchItem(
  item: StoredWatchItem,
  libraryEpisodesByKey: Map<string, WatchLibraryEpisode>,
  filters: LibraryFilterOptions,
): StoredWatchItem | null {
  if (item.kind === "movie") {
    const libraryEpisode = libraryEpisodesByKey.get(libraryEpisodeKey(item.provider, item.id, item.id));
    return watchEntryMatchesFilters(item, libraryEpisode, filters) ? item : null;
  }

  const episodes = Object.values(item.episodes ?? {});
  if (!episodes.length) {
    return null;
  }

  const filteredEpisodes = episodes.filter((episode) =>
    watchEntryMatchesFilters(
      episode,
      libraryEpisodesByKey.get(libraryEpisodeKey(item.provider, item.id, episode.id)),
      filters,
    ),
  );

  if (!filteredEpisodes.length) {
    return null;
  }

  return {
    ...item,
    episodes: Object.fromEntries(filteredEpisodes.map((episode) => [episode.id, episode])),
  };
}

function getFilteredWatchItemLastWatchedAt(
  item: StoredWatchItem,
  libraryEpisodesByKey: Map<string, WatchLibraryEpisode>,
  filters: LibraryFilterOptions,
): number {
  if (item.kind === "movie") {
    const libraryEpisode = libraryEpisodesByKey.get(libraryEpisodeKey(item.provider, item.id, item.id));
    return (
      getFilteredLibraryEpisodeLastWatchedAt(libraryEpisode, filters) ||
      item.lastWatchedAt
    );
  }

  const episodeTimes = Object.values(item.episodes ?? {}).map((episode) => {
    const libraryEpisode = libraryEpisodesByKey.get(libraryEpisodeKey(item.provider, item.id, episode.id));
    return getFilteredLibraryEpisodeLastWatchedAt(libraryEpisode, filters) || episode.lastWatchedAt;
  });
  return Math.max(item.lastWatchedAt, 0, ...episodeTimes);
}

function getFilteredLibraryEpisodeLastWatchedAt(
  libraryEpisode: WatchLibraryEpisode | undefined,
  filters: LibraryFilterOptions,
): number {
  const displayEpisode = getDisplayLibraryEpisode(libraryEpisode, filters);
  return Math.max(0, ...(displayEpisode?.sessions ?? []).map((session) => watchedAtMs(session.lastWatchedAt)));
}

function watchEntryMatchesFilters(
  entry: StoredEpisodeProgress | StoredWatchItem,
  libraryEpisode: WatchLibraryEpisode | undefined,
  filters: LibraryFilterOptions,
): boolean {
  if (filters.activity === "all" && filters.person === "all") {
    return true;
  }

  const sessions = libraryEpisode?.sessions ?? [];
  if (filters.activity === "together" || filters.person !== "all") {
    const sharedSessions = sessions.filter((session) => session.kind === "shared");
    if (!sharedSessions.length) {
      return false;
    }

    if (filters.person === "all") {
      return true;
    }

    if (filters.person.startsWith("user:")) {
      const userId = filters.person.slice("user:".length);
      return sharedSessions.some((session) =>
        session.participants.some((participant) => participant.user.userId === userId),
      );
    }

    if (filters.person.startsWith("group:")) {
      return sharedSessions.some((session) =>
        session.participants.some((participant) => filters.groupMemberUserIds?.has(participant.user.userId)),
      );
    }
  }

  if (filters.activity === "solo") {
    if (sessions.length) {
      return sessions.some((session) => session.kind === "solo");
    }
    return !entry.lastRoomId && entry.watchedWithCount <= 1;
  }

  return true;
}

function getDisplayLibraryEpisode(
  libraryEpisode: WatchLibraryEpisode | undefined,
  filters: LibraryFilterOptions,
): WatchLibraryEpisode | undefined {
  if (!libraryEpisode) {
    return undefined;
  }

  if (filters.activity === "solo") {
    return {
      ...libraryEpisode,
      sessions: libraryEpisode.sessions.filter((session) => session.kind === "solo"),
    };
  }

  if (filters.activity !== "together") {
    return libraryEpisode;
  }

  const sessions = libraryEpisode.sessions.filter((session) => {
    if (session.kind !== "shared") {
      return false;
    }
    if (filters.person === "all") {
      return true;
    }
    if (filters.person.startsWith("user:")) {
      const userId = filters.person.slice("user:".length);
      return session.participants.some((participant) => participant.user.userId === userId);
    }
    if (filters.person.startsWith("group:")) {
      return session.participants.some((participant) =>
        filters.groupMemberUserIds?.has(participant.user.userId),
      );
    }
    return false;
  });

  return {
    ...libraryEpisode,
    sessions,
  };
}

function buildCompanionFilters(
  library: WatchLibraryResponse | null,
  viewerUserId: string | null,
): LibraryCompanionFilter[] {
  const companionsByUserId = new Map<
    string,
    {
      displayName: string;
      avatarUrl: string | null;
      sessionIds: Set<string>;
    }
  >();

  for (const item of library?.items ?? []) {
    for (const episode of item.episodes) {
      for (const session of episode.sessions) {
        if (session.kind !== "shared") {
          continue;
        }

        for (const participant of session.participants) {
          if (viewerUserId && participant.user.userId === viewerUserId) {
            continue;
          }

          const existing = companionsByUserId.get(participant.user.userId) ?? {
            displayName: participant.user.displayName,
            avatarUrl: participant.user.avatarUrl,
            sessionIds: new Set<string>(),
          };
          existing.sessionIds.add(session.id);
          companionsByUserId.set(participant.user.userId, existing);
        }
      }
    }
  }

  return Array.from(companionsByUserId.entries())
    .map(([userId, companion]) => ({
      value: `user:${userId}` as const,
      userId,
      displayName: companion.displayName,
      avatarUrl: companion.avatarUrl,
      sessionCount: companion.sessionIds.size,
    }))
    .sort(
      (a, b) =>
        b.sessionCount - a.sessionCount ||
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    )
    .slice(0, 12);
}

function countProviderItems(folders: ProviderFolder[]): number {
  return folders.reduce((sum, folder) => sum + folder.items.length, 0);
}

function ProviderRow({
  busyWatchSessionId,
  filters,
  folder,
  libraryEpisodesByKey,
  open,
  onCreateRoomFromSession,
  onToggle,
  openItems,
  onToggleItem,
  viewerUserId,
}: {
  busyWatchSessionId: string | null;
  filters: LibraryFilterOptions;
  folder: ProviderFolder;
  libraryEpisodesByKey: Map<string, WatchLibraryEpisode>;
  open: boolean;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
  onToggle: () => void;
  openItems: Record<string, boolean>;
  onToggleItem: (itemId: string) => void;
  viewerUserId: string | null;
}) {
  const [activeKind, setActiveKind] = useState<"series" | "movie">("series");
  const seriesCount = folder.items.filter((item) => item.kind === "series").length;
  const movieCount = folder.items.filter((item) => item.kind === "movie").length;
  const hasKindTabs = folder.provider === "crunchyroll" && Boolean(seriesCount) && Boolean(movieCount);
  const visibleItems = hasKindTabs ? folder.items.filter((item) => item.kind === activeKind) : folder.items;

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
                filters={filters}
                key={item.id}
                item={item}
                libraryEpisodesByKey={libraryEpisodesByKey}
                open={Boolean(openItems[item.id])}
                onCreateRoomFromSession={onCreateRoomFromSession}
                onToggle={() => onToggleItem(item.id)}
                viewerUserId={viewerUserId}
              />
            ))
          ) : (
            <div className="popup-empty">Progress will appear here after watching together.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function WatchItemRow({
  busyWatchSessionId,
  filters,
  item,
  libraryEpisodesByKey,
  open,
  onCreateRoomFromSession,
  onToggle,
  viewerUserId,
}: {
  busyWatchSessionId: string | null;
  filters: LibraryFilterOptions;
  item: StoredWatchItem;
  libraryEpisodesByKey: Map<string, WatchLibraryEpisode>;
  open: boolean;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
  onToggle: () => void;
  viewerUserId: string | null;
}) {
  const episodesByLatest = Object.values(item.episodes ?? {}).sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
  const episodesByOrder = Object.values(item.episodes ?? {}).sort(compareEpisodesByDisplayOrder);
  const latestEpisode = episodesByLatest[0] ?? null;
  const episodeGroups = useMemo(
    () => buildEpisodeSeasonGroups(episodesByOrder, item.title),
    [episodesByOrder, item.title],
  );
  const latestSeasonKey = latestEpisode ? episodeSeasonKey(latestEpisode, item.title) : null;
  const showSeasonGroups = episodeGroups.length > 1 || episodeGroups.some((group) => group.known);
  const latestLibraryEpisode = latestEpisode
    ? getDisplayLibraryEpisode(
        libraryEpisodesByKey.get(libraryEpisodeKey(item.provider, item.id, latestEpisode.id)),
        filters,
      )
    : undefined;
  const isSeries = item.kind === "series";

  if (!isSeries) {
    return (
      <MovieRow
        busyWatchSessionId={busyWatchSessionId}
        item={item}
        libraryEpisode={getDisplayLibraryEpisode(
          libraryEpisodesByKey.get(libraryEpisodeKey(item.provider, item.id, item.id)),
          filters,
        )}
        onCreateRoomFromSession={onCreateRoomFromSession}
        viewerUserId={viewerUserId}
      />
    );
  }

  return (
    <div className="popup-watch-item" data-kind="series">
      <button className="popup-watch-row" type="button" onClick={onToggle}>
        <span className="popup-watch-artwork" data-has-artwork={Boolean(item.artworkUrl)} aria-hidden="true">
          {item.artworkUrl ? <img src={item.artworkUrl} alt="" loading="lazy" /> : <Folder size={16} />}
        </span>
        <span className="popup-watch-main">
          <span className="popup-watch-title">{item.title}</span>
          <span className="popup-watch-meta">
            {latestEpisode ? (
              <>
                {getEpisodeLabel(latestEpisode.title, 0)} · {stripEpisodePrefix(latestEpisode.title)}
              </>
            ) : (
              `${episodesByOrder.length} episodes`
            )}
          </span>
          {latestEpisode ? (
            <SeriesLatestSummary
              episode={latestEpisode}
              libraryEpisode={latestLibraryEpisode}
              viewerUserId={viewerUserId}
            />
          ) : null}
        </span>
        <span className="popup-watch-chevron" data-open={open}>
          <ChevronDown size={16} />
        </span>
      </button>

      {open ? (
        showSeasonGroups ? (
          <div className="popup-season-list">
            {episodeGroups.map((group) => (
              <SeasonGroup
                busyWatchSessionId={busyWatchSessionId}
                defaultOpen={episodeGroups.length <= 2 || group.key === latestSeasonKey}
                group={group}
                key={group.key}
                latestEpisodeId={latestEpisode?.id ?? null}
                libraryEpisodesByKey={libraryEpisodesByKey}
                filters={filters}
                item={item}
                onCreateRoomFromSession={onCreateRoomFromSession}
                viewerUserId={viewerUserId}
              />
            ))}
          </div>
        ) : (
        <div className="popup-episode-list">
          {episodesByOrder.map((episode, index) => (
            <EpisodeRow
              busyWatchSessionId={busyWatchSessionId}
              episode={episode}
              episodeIndex={index}
              selected={episode.id === latestEpisode?.id}
              key={episode.id}
              libraryEpisode={getDisplayLibraryEpisode(
                libraryEpisodesByKey.get(libraryEpisodeKey(item.provider, item.id, episode.id)),
                filters,
              )}
              onCreateRoomFromSession={onCreateRoomFromSession}
              viewerUserId={viewerUserId}
            />
          ))}
        </div>
        )
      ) : null}
    </div>
  );
}

function SeasonGroup({
  busyWatchSessionId,
  defaultOpen,
  filters,
  group,
  item,
  latestEpisodeId,
  libraryEpisodesByKey,
  onCreateRoomFromSession,
  viewerUserId,
}: {
  busyWatchSessionId: string | null;
  defaultOpen: boolean;
  filters: LibraryFilterOptions;
  group: EpisodeSeasonGroup;
  item: StoredWatchItem;
  latestEpisodeId: string | null;
  libraryEpisodesByKey: Map<string, WatchLibraryEpisode>;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
  viewerUserId: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const latestEpisode = group.episodes.reduce<StoredEpisodeProgress | null>(
    (latest, episode) => (!latest || episode.lastWatchedAt > latest.lastWatchedAt ? episode : latest),
    null,
  );
  const latestEpisodeIndex = latestEpisode ? group.episodes.findIndex((episode) => episode.id === latestEpisode.id) : -1;

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen, group.key]);

  return (
    <div className="popup-season-group" data-open={open}>
      <button
        className="popup-season-header"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="popup-season-main">
          <span className="popup-season-title">{group.title}</span>
          <span className="popup-season-meta">
            {formatEpisodeCount(group.episodes.length)}
            {latestEpisode ? ` · latest ${getEpisodeLabel(latestEpisode.title, latestEpisodeIndex)}` : ""}
          </span>
        </span>
        <span className="popup-season-chevron" data-open={open}>
          <ChevronDown size={14} />
        </span>
      </button>

      {open ? (
        <div className="popup-season-episode-list">
          {group.episodes.map((episode, index) => (
            <EpisodeRow
              busyWatchSessionId={busyWatchSessionId}
              episode={episode}
              episodeIndex={index}
              selected={episode.id === latestEpisodeId}
              key={episode.id}
              libraryEpisode={getDisplayLibraryEpisode(
                libraryEpisodesByKey.get(libraryEpisodeKey(item.provider, item.id, episode.id)),
                filters,
              )}
              onCreateRoomFromSession={onCreateRoomFromSession}
              viewerUserId={viewerUserId}
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
  viewerUserId,
}: {
  busyWatchSessionId: string | null;
  item: StoredWatchItem;
  libraryEpisode?: WatchLibraryEpisode;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
  viewerUserId: string | null;
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
          {item.artworkUrl ? <img src={item.artworkUrl} alt="" loading="lazy" /> : <Film size={15} />}
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
          <SharedSessionSummary
            busySessionId={busyWatchSessionId}
            libraryEpisode={libraryEpisode}
            onCreateRoomFromSession={onCreateRoomFromSession}
            sourceUrl={item.sourceUrl}
            viewerUserId={viewerUserId}
          />
        </span>
      </div>
    </div>
  );
}

function SeriesLatestSummary({
  episode,
  libraryEpisode,
  viewerUserId,
}: {
  episode: StoredEpisodeProgress;
  libraryEpisode?: WatchLibraryEpisode;
  viewerUserId: string | null;
}) {
  const shared = latestSharedSession(libraryEpisode);
  const progress = toPercent(libraryEpisode?.progress ?? episode.progress);
  const mode = shared ? (shared.participants.length > 2 ? "group" : "together") : "solo";
  return (
    <span className="popup-series-summary">
      <span className="popup-series-progress">
        <span className="popup-progress-track">
          <span style={{ width: `${progress}%` }} />
        </span>
        <span>{Math.round(progress)}%</span>
      </span>
      <span className="popup-series-context">
        <span className="popup-mode-badge" data-mode={mode}>
          {continueModeLabel(mode)}
        </span>
        {shared ? (
          <>
            <AvatarStack participants={shared.participants} compact />
            <span>{continueCompanionLabel(shared.participants, viewerUserId)}</span>
          </>
        ) : null}
      </span>
    </span>
  );
}

function EpisodeRow({
  busyWatchSessionId,
  episode,
  episodeIndex,
  libraryEpisode,
  onCreateRoomFromSession,
  selected,
  viewerUserId,
}: {
  busyWatchSessionId: string | null;
  episode: StoredEpisodeProgress;
  episodeIndex: number;
  libraryEpisode?: WatchLibraryEpisode;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
  selected: boolean;
  viewerUserId: string | null;
}) {
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
          <span className="popup-episode-number">{getEpisodeLabel(episode.title, episodeIndex)}</span>
          <span className="popup-episode-title">{stripEpisodePrefix(episode.title)}</span>
        </span>
        <SharedProgressTracker
          busySessionId={busyWatchSessionId}
          episode={episode}
          libraryEpisode={libraryEpisode}
          onCreateRoomFromSession={onCreateRoomFromSession}
          compact
        />
        <SharedSessionSummary
          busySessionId={busyWatchSessionId}
          libraryEpisode={libraryEpisode}
          onCreateRoomFromSession={onCreateRoomFromSession}
          sourceUrl={episode.sourceUrl}
          viewerUserId={viewerUserId}
        />
      </span>
    </div>
  );
}

function SharedSessionSummary({
  busySessionId,
  libraryEpisode,
  onCreateRoomFromSession,
  sourceUrl,
  viewerUserId,
}: {
  busySessionId: string | null;
  libraryEpisode?: WatchLibraryEpisode;
  onCreateRoomFromSession: (session: WatchLibrarySession, sourceUrl: string) => void;
  sourceUrl: string;
  viewerUserId: string | null;
}) {
  const session = latestSharedSession(libraryEpisode);
  if (!session) {
    return null;
  }

  return (
    <span className="popup-session-summary">
      <span className="popup-session-summary-main">
        <AvatarStack participants={session.participants} compact />
        <span>{sharedParticipantSummary(session.participants, viewerUserId)}</span>
      </span>
      <button
        className="popup-session-summary-action"
        disabled={busySessionId === session.id}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCreateRoomFromSession(session, libraryEpisode?.sourceUrl ?? sourceUrl);
        }}
      >
        {busySessionId === session.id ? "Creating..." : "Continue"}
      </button>
    </span>
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
        <span className="shared-progress-base" style={{ width: `${toPercent(episode.progress)}%` }} />
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

function AvatarStack({ participants, compact }: { participants: WatchLibraryParticipantLike[]; compact?: boolean }) {
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

function latestSharedSession(libraryEpisode?: WatchLibraryEpisode): WatchLibrarySession | null {
  return (
    [...(libraryEpisode?.sessions ?? [])]
      .filter((session) => session.kind === "shared")
      .sort((a, b) => watchedAtMs(b.lastWatchedAt) - watchedAtMs(a.lastWatchedAt))[0] ?? null
  );
}

function sharedParticipantSummary(participants: WatchLibraryParticipantLike[], viewerUserId: string | null): string {
  const names = participants
    .filter((participant) => !viewerUserId || participant.user.userId !== viewerUserId)
    .map((participant) => participant.user.displayName)
    .filter(Boolean);
  if (!names.length) {
    return "Watched together";
  }

  const visibleNames = names.slice(0, 2);
  const remainingCount = names.length - visibleNames.length;
  const people = remainingCount > 0 ? `${visibleNames.join(", ")} +${remainingCount}` : visibleNames.join(", ");
  return `Watched with ${people}`;
}

function watchedAtMs(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
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

function compareEpisodesByDisplayOrder(a: StoredEpisodeProgress, b: StoredEpisodeProgress): number {
  const aNumber = getEpisodeNumber(a.title);
  const bNumber = getEpisodeNumber(b.title);
  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
    return aNumber - bNumber;
  }
  if (aNumber !== null && bNumber === null) {
    return -1;
  }
  if (aNumber === null && bNumber !== null) {
    return 1;
  }
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
}

function buildEpisodeSeasonGroups(episodes: StoredEpisodeProgress[], itemTitle: string): EpisodeSeasonGroup[] {
  const groups = new Map<string, EpisodeSeasonGroup>();
  for (const episode of episodes) {
    const key = episodeSeasonKey(episode, itemTitle);
    const existing = groups.get(key);
    if (existing) {
      existing.episodes.push(episode);
      existing.latestWatchedAt = Math.max(existing.latestWatchedAt, episode.lastWatchedAt);
      continue;
    }

    groups.set(key, {
      key,
      title: episodeSeasonTitle(episode, itemTitle),
      known: hasEpisodeSeason(episode, itemTitle),
      sortNumber:
        preferredEpisodeSeason(episode, itemTitle)?.seasonNumber ??
        normalizedEpisodeSeasonNumber(episode, itemTitle) ??
        getEpisodeSeasonNumber(episode.title),
      latestWatchedAt: episode.lastWatchedAt,
      episodes: [episode],
    });
  }

  return Array.from(groups.values()).sort(compareSeasonGroups);
}

function compareSeasonGroups(a: EpisodeSeasonGroup, b: EpisodeSeasonGroup): number {
  if (a.known !== b.known) {
    return a.known ? -1 : 1;
  }
  if (a.sortNumber !== null && b.sortNumber !== null && a.sortNumber !== b.sortNumber) {
    return a.sortNumber - b.sortNumber;
  }
  if (a.sortNumber !== null && b.sortNumber === null) {
    return -1;
  }
  if (a.sortNumber === null && b.sortNumber !== null) {
    return 1;
  }
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
}

function episodeSeasonKey(episode: StoredEpisodeProgress, itemTitle: string): string {
  const preferred = preferredEpisodeSeason(episode, itemTitle);
  if (preferred) {
    return preferred.seasonId;
  }
  if (episode.seasonId) {
    return episode.seasonId;
  }
  const seasonNumber = normalizedEpisodeSeasonNumber(episode, itemTitle);
  if (seasonNumber) {
    return `season-${seasonNumber}`;
  }
  const seasonTitle = normalizedEpisodeSeasonTitle(episode, itemTitle);
  if (seasonTitle) {
    return `season:${slugKey(seasonTitle)}`;
  }
  return "season:unknown";
}

function episodeSeasonTitle(episode: StoredEpisodeProgress, itemTitle: string): string {
  const preferred = preferredEpisodeSeason(episode, itemTitle);
  if (preferred) {
    return preferred.seasonTitle;
  }
  const seasonTitle = normalizedEpisodeSeasonTitle(episode, itemTitle);
  if (seasonTitle) {
    return seasonTitle;
  }
  const seasonNumber = normalizedEpisodeSeasonNumber(episode, itemTitle);
  if (seasonNumber) {
    return `Season ${seasonNumber}`;
  }
  const titleSeasonNumber = getEpisodeSeasonNumber(episode.title);
  if (titleSeasonNumber) {
    return `Season ${titleSeasonNumber}`;
  }
  return "Other episodes";
}

function hasEpisodeSeason(episode: StoredEpisodeProgress, itemTitle: string): boolean {
  return Boolean(
    preferredEpisodeSeason(episode, itemTitle) ||
      episode.seasonId ||
      normalizedEpisodeSeasonTitle(episode, itemTitle) ||
      normalizedEpisodeSeasonNumber(episode, itemTitle) ||
      getEpisodeSeasonNumber(episode.title),
  );
}

function preferredEpisodeSeason(episode: StoredEpisodeProgress, itemTitle: string) {
  const inferred = inferredEpisodeSeason(episode);
  if (!inferred) {
    return null;
  }
  const seasonTitle = episode.seasonTitle ?? null;
  if (!seasonTitle || isPlaceholderSeasonTitle(seasonTitle) || sameNormalizedTitle(seasonTitle, itemTitle)) {
    return inferred;
  }
  return null;
}

function normalizedEpisodeSeasonTitle(episode: StoredEpisodeProgress, itemTitle: string): string | null {
  const seasonTitle = episode.seasonTitle?.trim() || null;
  if (!seasonTitle || isPlaceholderSeasonTitle(seasonTitle) || sameNormalizedTitle(seasonTitle, itemTitle)) {
    return null;
  }
  return seasonTitle;
}

function normalizedEpisodeSeasonNumber(episode: StoredEpisodeProgress, itemTitle: string): number | null {
  const seasonTitle = episode.seasonTitle ?? null;
  if (seasonTitle && (isPlaceholderSeasonTitle(seasonTitle) || sameNormalizedTitle(seasonTitle, itemTitle))) {
    return null;
  }
  return episode.seasonNumber ?? null;
}

function inferredEpisodeSeason(episode: StoredEpisodeProgress) {
  return inferCrunchyrollSeasonFromSourceUrl(episode.sourceUrl);
}

function isPlaceholderSeasonTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return normalized === "?" || normalized === "unknown" || normalized === "n/a" || normalized === "na";
}

function sameNormalizedTitle(a: string, b: string): boolean {
  return normalizeComparableTitle(a) === normalizeComparableTitle(b);
}

function normalizeComparableTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\W_]+/g, " ")
    .trim();
}

function formatEpisodeCount(count: number): string {
  return `${count} ${count === 1 ? "episode" : "episodes"}`;
}

function getEpisodeNumber(title: string): number | null {
  const match = title.match(/\bE\s?(\d+)\b/i) ?? title.match(/^(\d+)[\s.:-]/);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function getEpisodeSeasonNumber(title: string): number | null {
  return seasonNumberFromTitle(title);
}

function stripEpisodePrefix(title: string): string {
  return title
    .replace(/^\s*S\s?\d+\s*E\s?\d+\s*[-:–—]\s*/i, "")
    .replace(/^\s*Season\s+\d+\s+Episode\s+\d+\s*[-:–—]\s*/i, "")
    .replace(/^\s*Сезон\s+\d+\s+Серия\s+\d+\s*[-:–—]\s*/i, "")
    .replace(/^\s*E\s?\d+\s*[-:–—]\s*/i, "")
    .replace(/^\s*\d+\s*[-:–—.]\s*/, "")
    .trim();
}

function slugKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
