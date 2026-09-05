import {
  type AccountInboxResponse,
  type MarkAccountInboxSeenRequest,
  type SocialSnapshot,
  SocialSnapshotSchema,
} from "@anidachi/protocol";
import {
  Check,
  Bell,
  BellOff,
  Inbox,
  LogIn,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  accountInboxItemInstanceKey,
  getCachedAccountInboxForUser,
  mergeAccountInboxResponses,
  publishAccountInboxForUser,
  subscribeToAccountInboxForUser,
} from "./account-inbox-cache";
import { listAccountInbox, markAccountInboxItemsSeen } from "./account-inbox-client";
import {
  type AccountOwnedState,
  type AccountRequestToken,
  accountErrorState,
  accountIdentityChanged,
  accountLoadingState,
  accountReadyState,
  createAccountRequestGate,
  createAsyncGenerationGate,
  signedOutAccountState,
} from "./account-sync";
import {
  getCachedExtensionSession,
  requestCurrentExtensionSession,
  requestSilentWebsiteSignIn,
  requestWebsiteSignIn,
} from "./auth-client";
import {
  AUTH_TOKENS_STORAGE_KEY,
  type ExtensionAuthTokens,
  normalizeExtensionAuthTokens,
} from "./auth-tokens";
import { WEB_HTTP_BASE } from "./constants";
import { logDebug } from "./debug-log";
import { PanelAccountTitle } from "./panel-account-title";
import {
  buildPopupInboxModel,
  type PopupInboxFriendRequest,
  type PopupInboxInvite,
  type PopupInboxModel,
} from "./popup-people-model";
import {
  type PopupPeopleActionKey,
  type PopupPeopleActionNotice,
  PopupPeoplePanel,
  type PopupPeoplePresentationState,
} from "./popup-people-panel";
import { popupStyles } from "./popup-styles";
import { PopupWatchHistoryPanel } from "./popup-watch-history";
import { PopupHistorySettings } from "./popup-history-settings";
import {
  consumePopupRouteIntent,
  requestRoomInviteNotificationPermission,
  requestRoomInviteNotificationStatus,
  setRoomInviteNotificationsEnabled,
  type RoomInviteNotificationStatus,
  updateInboxBadge,
} from "./room-invite-notifications";
import {
  acceptFriendRequest,
  acceptRoomInvite,
  createFriendGroup,
  declineFriendRequest,
  declineRoomInvite,
  listRoomInvites,
  listSocialDirectory,
  sendFriendRequest,
} from "./social-client";
import {
  getCachedSocialSnapshotForUser,
  isSocialSnapshotCacheFresh,
  setCachedSocialSnapshotForUser,
} from "./social-snapshot-cache";

export type PopupTab = "resources" | "friends" | "inbox";

type SocialPanelData = SocialSnapshot;

type PopupSocialActionKey =
  | PopupPeopleActionKey
  | `accept-friend:${string}`
  | `decline-friend:${string}`;

type PopupNotice = {
  actionKey: PopupSocialActionKey;
  tone: "success" | "warning" | "error";
  text: string;
};

type SocialPanelState = AccountOwnedState<SocialPanelData>;

type AccountInboxState = AccountOwnedState<AccountInboxResponse>;

type AuthSessionState =
  | { status: "loading"; tokens: null; error: null }
  | { status: "signed-out"; tokens: null; error: null }
  | { status: "ready"; tokens: ExtensionAuthTokens; error: null }
  | { status: "error"; tokens: null; error: string };

export function mapSocialStateToPeoplePresentation(
  state: SocialPanelState,
): PopupPeoplePresentationState {
  switch (state.status) {
    case "signed-out":
      return { status: "signed-out" };
    case "loading":
      return state.data
        ? { status: "stale", directory: state.data.directory }
        : { status: "loading" };
    case "error":
      return state.data
        ? {
            status: "stale-error",
            directory: state.data.directory,
            errorMessage: state.error,
          }
        : { status: "error", errorMessage: state.error };
    case "ready":
      return { status: "ready", directory: state.data.directory };
  }
}

export function popupInboxBadgeCount(model: PopupInboxModel | null): number {
  return model?.unseenCount ?? 0;
}

export function unseenAccountInboxItems(
  inbox: AccountInboxResponse,
): MarkAccountInboxSeenRequest["items"] {
  return inbox.items
    .filter((item) => item.seenAt === null)
    .map((item) => ({
      kind: item.kind,
      id: item.kind === "room-invite" ? item.inviteId : item.friendshipId,
    }));
}

export function PopupApp() {
  const [activeTab, setActiveTab] = useState<PopupTab>("resources");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] =
    useState<RoomInviteNotificationStatus | null>(null);
  const [notificationSettingsBusy, setNotificationSettingsBusy] = useState(false);
  const [notificationSettingsError, setNotificationSettingsError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSessionState>({
    status: "loading",
    tokens: null,
    error: null,
  });
  const tokens = authSession.status === "ready" ? authSession.tokens : null;
  const [historySession, setHistorySession] = useState({ tokens, revision: 0 });
  if (historySession.tokens?.user.id !== tokens?.user.id ||
    historySession.tokens?.accessToken !== tokens?.accessToken ||
    historySession.tokens?.refreshToken !== tokens?.refreshToken) {
    // A same-owner credential handoff can reject an in-flight history read.
    // Restart it from the new authority without remounting the drawer or tying
    // history refreshes to unrelated social/profile updates. Only the counter
    // reaches the history UI; credentials never enter its query keys or DOM.
    setHistorySession({
      tokens,
      revision: historySession.revision + (
        tokens && historySession.tokens?.user.id === tokens.user.id ? 1 : 0
      ),
    });
  }
  const [socialState, setSocialState] = useState<SocialPanelState>(() => signedOutAccountState());
  const [inboxState, setInboxState] = useState<AccountInboxState>(() => signedOutAccountState());
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [busySocialAction, setBusySocialAction] = useState<PopupSocialActionKey | null>(null);
  const [socialNotice, setSocialNotice] = useState<PopupNotice | null>(null);
  const accountGateRef = useRef(createAccountRequestGate());
  const popupSyncGateRef = useRef(createAsyncGenerationGate());
  const socialLoadGateRef = useRef(createAsyncGenerationGate());
  const inboxLoadGateRef = useRef(createAsyncGenerationGate());
  const socialMutationInFlightRef = useRef(false);
  const seenInboxSignatureRef = useRef<string | null>(null);
  const pendingSeenInboxItemsRef = useRef(new Set<string>());
  const consumedRouteIntentUserIdRef = useRef<string | null>(null);
  const activateAccount = useCallback((userId: string | null): AccountRequestToken | null => {
    const previousUserId = accountGateRef.current.currentUserId();
    accountGateRef.current.activate(userId);

    setSocialState((current) =>
      userId ? accountLoadingState(userId, current) : signedOutAccountState(),
    );
    setInboxState((current) =>
      userId ? accountLoadingState(userId, current) : signedOutAccountState(),
    );
    setSocialNotice(null);

    if (previousUserId !== userId) {
      socialLoadGateRef.current.begin();
      inboxLoadGateRef.current.begin();
      setBusyInviteId(null);
      setBusySocialAction(null);
      seenInboxSignatureRef.current = null;
      pendingSeenInboxItemsRef.current = new Set();
    }

    return userId ? accountGateRef.current.capture(userId) : null;
  }, []);
  const accountUser = authSession.status === "ready" ? authSession.tokens.user : null;
  const inboxModel = useMemo(() => buildPopupInboxModel(inboxState.data), [inboxState.data]);
  const peoplePresentationState = mapSocialStateToPeoplePresentation(socialState);
  const peoplePendingActionKey = isPopupPeopleActionKey(busySocialAction) ? busySocialAction : null;
  const peopleActionNotice = isPopupPeopleActionNotice(socialNotice) ? socialNotice : null;

  const loadSocialForTokens = useCallback(
    async (tokens: ExtensionAuthTokens, parentIsCurrent: () => boolean = () => true) => {
      const request = accountGateRef.current.capture(tokens.user.id);
      if (!request) return false;
      const loadGeneration = socialLoadGateRef.current.begin();
      const isCurrent = () =>
        parentIsCurrent() &&
        accountGateRef.current.isCurrent(request) &&
        socialLoadGateRef.current.isCurrent(loadGeneration);

      if (!isCurrent()) return false;
      setSocialState((current) => accountLoadingState(tokens.user.id, current));
      try {
        const cached = await getCachedSocialSnapshotForUser(tokens.user.id);
        if (!isCurrent()) return false;
        if (cached) {
          setSocialState(
            isSocialSnapshotCacheFresh(cached)
              ? accountReadyState(tokens.user.id, cached.data)
              : {
                  status: "loading",
                  ownerUserId: tokens.user.id,
                  data: cached.data,
                  error: null,
                },
          );
        }

        const [directory, invites] = await Promise.all([
          listSocialDirectory(tokens.accessToken),
          listRoomInvites(tokens.accessToken),
        ]);
        if (!isCurrent()) return false;
        const snapshot = SocialSnapshotSchema.parse({ directory, invites });
        if (!isCurrent()) return false;
        await setCachedSocialSnapshotForUser(tokens.user.id, snapshot);
        if (!isCurrent()) return false;
        setSocialState(accountReadyState(tokens.user.id, snapshot));
        return true;
      } catch (error) {
        if (!isCurrent()) return false;
        setSocialState((current) =>
          accountErrorState(
            tokens.user.id,
            current,
            error instanceof Error ? error.message : "Could not load friends",
          ),
        );
        return false;
      }
    },
    [],
  );

  const loadInboxForTokens = useCallback(
    async (tokens: ExtensionAuthTokens, parentIsCurrent: () => boolean = () => true) => {
      const request = accountGateRef.current.capture(tokens.user.id);
      if (!request) return false;
      const loadGeneration = inboxLoadGateRef.current.begin();
      seenInboxSignatureRef.current = null;
      const isCurrent = () =>
        parentIsCurrent() &&
        accountGateRef.current.isCurrent(request) &&
        inboxLoadGateRef.current.isCurrent(loadGeneration);

      if (!isCurrent()) return false;
      setInboxState((current) => accountLoadingState(tokens.user.id, current));
      try {
        const cached = await getCachedAccountInboxForUser(tokens.user.id);
        if (!isCurrent()) return false;
        if (cached) {
          setInboxState((current) => ({
            status: "loading",
            ownerUserId: tokens.user.id,
            data: mergeAccountInboxResponses(current.data, cached.data),
            error: null,
          }));
        }

        const inbox = await listAccountInbox(tokens.accessToken);
        if (!isCurrent()) return false;
        if (inbox.meta.ownerUserId !== tokens.user.id) {
          throw new Error("Inbox response belongs to another account");
        }
        const canonical = await publishAccountInboxForUser(tokens.user.id, inbox, {
          isCurrent,
          reread: () => listAccountInbox(tokens.accessToken),
        });
        if (!canonical || !isCurrent()) return false;
        setInboxState((current) => accountReadyState(tokens.user.id,
          mergeAccountInboxResponses(current.data, canonical)));
        return true;
      } catch (error) {
        if (!isCurrent()) return false;
        setInboxState((current) =>
          accountErrorState(
            tokens.user.id,
            current,
            error instanceof Error ? error.message : "Could not load inbox",
          ),
        );
        return false;
      }
    },
    [],
  );

  const syncPopupData = useCallback(
    async (
      options: {
        interactive?: boolean;
        tokens?: ExtensionAuthTokens;
      } = {},
    ): Promise<ExtensionAuthTokens | null> => {
      const syncGeneration = popupSyncGateRef.current.begin();
      const isCurrentSync = () => popupSyncGateRef.current.isCurrent(syncGeneration);
      try {
        if (!options.tokens && !options.interactive) {
          const cachedTokens = await getCachedExtensionSession();
          if (!isCurrentSync()) return null;
          if (cachedTokens && activateAccount(cachedTokens.user.id)) {
            setAuthSession({
              status: "ready",
              tokens: cachedTokens,
              error: null,
            });
          }
        }

        const tokens =
          options.tokens ??
          (options.interactive
            ? await requestWebsiteSignIn()
            : ((await requestCurrentExtensionSession()) ?? (await requestSilentWebsiteSignIn())));
        if (!isCurrentSync()) return null;
        if (!tokens) {
          activateAccount(null);
          setAuthSession({ status: "signed-out", tokens: null, error: null });
          return null;
        }

        const request = activateAccount(tokens.user.id);
        if (!request) return null;
        setAuthSession({ status: "ready", tokens, error: null });
        await Promise.all([
          loadSocialForTokens(tokens, isCurrentSync),
          loadInboxForTokens(tokens, isCurrentSync),
        ]);
        if (!isCurrentSync() || !accountGateRef.current.isCurrent(request)) return null;
        return tokens;
      } catch (error) {
        if (!isCurrentSync()) return null;
        const message = error instanceof Error ? error.message : "Could not sync account";
        const cachedTokens = await getCachedExtensionSession().catch(() => null);
        if (!isCurrentSync()) return null;
        const activeUserId = accountGateRef.current.currentUserId();
        if (activeUserId && cachedTokens?.user.id === activeUserId) {
          const request = accountGateRef.current.capture(activeUserId);
          if (!request || !accountGateRef.current.isCurrent(request)) return null;
          setAuthSession({
            status: "ready",
            tokens: cachedTokens,
            error: null,
          });
          setSocialState((current) => accountErrorState(activeUserId, current, message));
          setInboxState((current) => accountErrorState(activeUserId, current, message));
        } else {
          activateAccount(null);
          setAuthSession({ status: "error", tokens: null, error: message });
        }
        return null;
      }
    },
    [activateAccount, loadInboxForTokens, loadSocialForTokens],
  );

  const transitionToResolvedSession = useCallback(
    (tokens: ExtensionAuthTokens | null) => {
      popupSyncGateRef.current.begin();
      if (!tokens) {
        activateAccount(null);
        setAuthSession({ status: "signed-out", tokens: null, error: null });
        return;
      }

      activateAccount(tokens.user.id);
      setAuthSession({ status: "ready", tokens, error: null });
      void syncPopupData({ tokens });
    },
    [activateAccount, syncPopupData],
  );

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      if (socialMutationInFlightRef.current) return;
      socialMutationInFlightRef.current = true;
      const activeUserId = accountGateRef.current.currentUserId();
      const request = activeUserId ? accountGateRef.current.capture(activeUserId) : null;
      if (!request) {
        socialMutationInFlightRef.current = false;
        return;
      }
      setBusyInviteId(inviteId);
      try {
        const tokens = await requestCurrentExtensionSession();
        if (!accountGateRef.current.isCurrent(request)) return;
        if (tokens?.user.id !== request.userId) {
          transitionToResolvedSession(tokens);
          return;
        }
        const accepted = await acceptRoomInvite(tokens.accessToken, inviteId);
        if (!accountGateRef.current.isCurrent(request)) return;
        setAuthSession({ status: "ready", tokens, error: null });
        await Promise.all([loadSocialForTokens(tokens), loadInboxForTokens(tokens)]);
        if (!accountGateRef.current.isCurrent(request)) return;
        await chrome.tabs.create({ url: accepted.joinUrl });
      } catch (error) {
        if (!accountGateRef.current.isCurrent(request)) return;
        setInboxState((current) =>
          accountErrorState(
            request.userId,
            current,
            error instanceof Error ? error.message : "Could not accept invite",
          ),
        );
      } finally {
        socialMutationInFlightRef.current = false;
        if (accountGateRef.current.isCurrent(request)) setBusyInviteId(null);
      }
    },
    [loadInboxForTokens, loadSocialForTokens, transitionToResolvedSession],
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      if (socialMutationInFlightRef.current) return;
      socialMutationInFlightRef.current = true;
      const activeUserId = accountGateRef.current.currentUserId();
      const request = activeUserId ? accountGateRef.current.capture(activeUserId) : null;
      if (!request) {
        socialMutationInFlightRef.current = false;
        return;
      }
      setBusyInviteId(inviteId);
      try {
        const tokens = await requestCurrentExtensionSession();
        if (!accountGateRef.current.isCurrent(request)) return;
        if (tokens?.user.id !== request.userId) {
          transitionToResolvedSession(tokens);
          return;
        }
        await declineRoomInvite(tokens.accessToken, inviteId);
        if (!accountGateRef.current.isCurrent(request)) return;
        setAuthSession({ status: "ready", tokens, error: null });
        await Promise.all([loadSocialForTokens(tokens), loadInboxForTokens(tokens)]);
      } catch (error) {
        if (!accountGateRef.current.isCurrent(request)) return;
        setInboxState((current) =>
          accountErrorState(
            request.userId,
            current,
            error instanceof Error ? error.message : "Could not decline invite",
          ),
        );
      } finally {
        socialMutationInFlightRef.current = false;
        if (accountGateRef.current.isCurrent(request)) setBusyInviteId(null);
      }
    },
    [loadInboxForTokens, loadSocialForTokens, transitionToResolvedSession],
  );

  const runSocialAction = useCallback(
    async (
      key: PopupSocialActionKey,
      action: (accessToken: string) => Promise<unknown>,
      success: string,
      fallbackError: string,
    ): Promise<boolean> => {
      if (socialMutationInFlightRef.current) return false;
      socialMutationInFlightRef.current = true;
      const activeUserId = accountGateRef.current.currentUserId();
      const request = activeUserId ? accountGateRef.current.capture(activeUserId) : null;
      if (!request) {
        socialMutationInFlightRef.current = false;
        return false;
      }
      setBusySocialAction(key);
      setSocialNotice(null);
      try {
        const tokens = await requestCurrentExtensionSession();
        if (!accountGateRef.current.isCurrent(request)) {
          return false;
        }
        if (tokens?.user.id !== request.userId) {
          transitionToResolvedSession(tokens);
          return false;
        }

        setAuthSession({ status: "ready", tokens, error: null });
        await action(tokens.accessToken);
        if (!accountGateRef.current.isCurrent(request)) return false;
        const [socialRefreshed, inboxRefreshed] = await Promise.all([
          loadSocialForTokens(tokens),
          loadInboxForTokens(tokens),
        ]);
        if (!accountGateRef.current.isCurrent(request)) return false;
        if (!socialRefreshed || !inboxRefreshed) {
          setSocialNotice({
            actionKey: key,
            tone: "warning",
            text: `${success} Latest data could not be refreshed.`,
          });
          return true;
        }
        setSocialNotice({ actionKey: key, tone: "success", text: success });
        return true;
      } catch (error) {
        if (!accountGateRef.current.isCurrent(request)) return false;
        setSocialNotice({
          actionKey: key,
          tone: "error",
          text: error instanceof Error ? error.message : fallbackError,
        });
        return false;
      } finally {
        socialMutationInFlightRef.current = false;
        if (accountGateRef.current.isCurrent(request)) setBusySocialAction(null);
      }
    },
    [loadInboxForTokens, loadSocialForTokens, transitionToResolvedSession],
  );

  const createGroup = useCallback(
    async (name: string, clientRequestId: string) =>
      runSocialAction(
        "create-group",
        async (accessToken) => {
          await createFriendGroup(accessToken, { name, clientRequestId });
        },
        "Group created.",
        "Could not create group",
      ),
    [runSocialAction],
  );

  const addFriend = useCallback(
    async (userId: string) =>
      runSocialAction(
        `add-friend:${userId}`,
        async (accessToken) => {
          await sendFriendRequest(accessToken, userId);
        },
        "Friend request sent.",
        "Could not send friend request",
      ),
    [runSocialAction],
  );

  const acceptIncomingFriendRequest = useCallback(
    async (friendshipId: string) =>
      runSocialAction(
        `accept-friend:${friendshipId}`,
        async (accessToken) => {
          await acceptFriendRequest(accessToken, friendshipId);
        },
        "Friend request accepted.",
        "Could not accept friend request",
      ),
    [runSocialAction],
  );

  const declineIncomingFriendRequest = useCallback(
    async (friendshipId: string) =>
      runSocialAction(
        `decline-friend:${friendshipId}`,
        async (accessToken) => {
          await declineFriendRequest(accessToken, friendshipId);
        },
        "Friend request declined.",
        "Could not decline friend request",
      ),
    [runSocialAction],
  );

  useEffect(() => {
    void syncPopupData();
  }, [syncPopupData]);

  useEffect(() => {
    if (authSession.status !== "ready") return;
    const userId = authSession.tokens.user.id;
    if (consumedRouteIntentUserIdRef.current === userId) return;
    consumedRouteIntentUserIdRef.current = userId;
    void consumePopupRouteIntent(userId)
      .then((intent) => {
        if (intent?.tab === "inbox") setActiveTab("inbox");
      })
      .catch(() => undefined);
  }, [authSession]);

  useEffect(() => {
    if (!inboxState.data) return;
    void updateInboxBadge(inboxState.data.counts.unseen).catch(() => undefined);
  }, [inboxState.data]);

  useEffect(() => {
    const userId = accountUser?.id;
    if (!userId) return;
    const request = accountGateRef.current.capture(userId);
    if (!request) return;
    return subscribeToAccountInboxForUser(userId, (inbox) => {
      if (!accountGateRef.current.isCurrent(request)) return;
      setInboxState((current) => accountReadyState(userId,
        mergeAccountInboxResponses(current.data, inbox, true)));
    });
  }, [accountUser?.id]);

  useEffect(() => {
    if (
      activeTab !== "inbox" ||
      authSession.status !== "ready" ||
      inboxState.status !== "ready" ||
      inboxState.ownerUserId !== authSession.tokens.user.id
    ) {
      return;
    }

    const pending = pendingSeenInboxItemsRef.current;
    const unseenInstances = inboxState.data.items.filter((item) =>
      item.seenAt === null && !pending.has(accountInboxItemInstanceKey(item)));
    const unseenItems = unseenAccountInboxItems({ ...inboxState.data, items: unseenInstances });
    if (!unseenItems.length) return;
    const signature = `${authSession.tokens.user.id}:${unseenInstances
      .map(accountInboxItemInstanceKey)
      .join(",")}`;
    if (seenInboxSignatureRef.current === signature) return;
    seenInboxSignatureRef.current = signature;

    const request = accountGateRef.current.capture(authSession.tokens.user.id);
    if (!request) return;
    const isCurrent = () => accountGateRef.current.isCurrent(request);
    for (const item of unseenInstances) pending.add(accountInboxItemInstanceKey(item));
    void (async () => {
      try {
        const inbox = await markAccountInboxItemsSeen(authSession.tokens.accessToken, unseenItems);
        if (!isCurrent()) return;
        if (inbox.meta.ownerUserId !== request.userId) {
          throw new Error("Inbox response belongs to another account");
        }
        if (!isCurrent()) return;
        const cached = await publishAccountInboxForUser(request.userId, inbox, {
          isCurrent,
          reread: () => listAccountInbox(authSession.tokens.accessToken),
          seenItems: unseenInstances,
        });
        if (!cached || !isCurrent()) return;
        setInboxState((current) => accountReadyState(request.userId,
          mergeAccountInboxResponses(current.data, cached)));
      } catch (error) {
        if (!isCurrent()) return;
        seenInboxSignatureRef.current = null;
        logDebug("account.inbox", "mark seen failed", {
          error: error instanceof Error ? error.message : "Unknown inbox error",
        });
      } finally {
        for (const item of unseenInstances) pending.delete(accountInboxItemInstanceKey(item));
      }
    })();
  }, [activeTab, authSession, inboxState]);

  useEffect(() => {
    const handleAuthStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[AUTH_TOKENS_STORAGE_KEY]) {
        return;
      }

      const tokens = normalizeExtensionAuthTokens(changes[AUTH_TOKENS_STORAGE_KEY].newValue);
      if (
        !accountIdentityChanged(accountGateRef.current.currentUserId(), tokens?.user.id ?? null)
      ) {
        setAuthSession(
          tokens
            ? { status: "ready", tokens, error: null }
            : { status: "signed-out", tokens: null, error: null },
        );
        return;
      }

      transitionToResolvedSession(tokens);
    };

    chrome.storage.onChanged.addListener(handleAuthStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleAuthStorageChange);
    };
  }, [transitionToResolvedSession]);

  const authChecking = authSession.status === "loading";
  const openAccount = async (path = "/account") => {
    const tokens =
      authSession.status === "ready" &&
      accountGateRef.current.currentUserId() === authSession.tokens.user.id
        ? authSession.tokens
        : await syncPopupData({ interactive: true });
    if (!tokens) return;
    const request = accountGateRef.current.capture(tokens.user.id);
    if (!request || !accountGateRef.current.isCurrent(request)) return;
    await chrome.tabs.create({
      url: new URL(path, WEB_HTTP_BASE).toString(),
    });
  };

  const toggleSettings = async () => {
    const nextOpen = !settingsOpen;
    setSettingsOpen(nextOpen);
    setNotificationSettingsError(null);
    if (!nextOpen) return;
    setNotificationSettingsBusy(true);
    try {
      setNotificationStatus(await requestRoomInviteNotificationStatus());
    } catch (error) {
      setNotificationSettingsError(
        error instanceof Error ? error.message : "Could not load notification settings",
      );
    } finally {
      setNotificationSettingsBusy(false);
    }
  };

  const toggleRoomInviteNotifications = async () => {
    if (notificationSettingsBusy || !notificationStatus) return;
    setNotificationSettingsBusy(true);
    setNotificationSettingsError(null);
    try {
      if (notificationStatus.enabled) {
        setNotificationStatus(await setRoomInviteNotificationsEnabled(false));
      } else {
        const granted =
          notificationStatus.permissionGranted ||
          (await requestRoomInviteNotificationPermission());
        if (!granted) {
          throw new Error("Chrome notification permission was not granted");
        }
        setNotificationStatus(await setRoomInviteNotificationsEnabled(true));
      }
    } catch (error) {
      setNotificationSettingsError(
        error instanceof Error ? error.message : "Could not update notification settings",
      );
    } finally {
      setNotificationSettingsBusy(false);
    }
  };

  return (
    <main className="popup-shell">
      <style>{popupStyles}</style>
      <header className="popup-topbar">
        <div className="popup-profile">
          <button
            aria-label={
              accountUser ? "Open account dashboard" : authChecking ? "Checking account" : "Sign in"
            }
            className="popup-profile-button"
            type="button"
            disabled={authChecking}
            onClick={() => void openAccount()}
          >
            <span className="popup-profile-avatar" data-signed-in={Boolean(accountUser)}>
              {accountUser ? (
                <ProfileAvatar
                  avatarUrl={accountUser.avatarUrl}
                  displayName={accountUser.displayName}
                />
              ) : authChecking ? (
                <RefreshCw size={18} />
              ) : (
                <LogIn size={18} />
              )}
            </span>
          </button>
          <span className="popup-profile-copy">
            {accountUser ? (
              <PanelAccountTitle displayName={accountUser.displayName} plan={accountUser.plan} />
            ) : (
              <>
                <span className="popup-profile-state-title">
                  {authChecking ? "Checking account" : "Sign in"}
                </span>
                <span className="popup-profile-helper">
                  {authChecking ? "Loading your profile..." : "Sync progress and people"}
                </span>
              </>
            )}
          </span>
        </div>
        <div className="popup-header-actions">
          <button
            aria-label="Open settings"
            className="popup-command-button"
            type="button"
            aria-expanded={settingsOpen}
            onClick={() => void toggleSettings()}
          >
            <Settings size={21} strokeWidth={1.8} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <section className="popup-local-settings" aria-label="Extension settings">
          <div className="popup-local-settings-heading">
            <div>
              <strong>Extension settings</strong>
              <span>History and notifications</span>
            </div>
            <button
              aria-label="Close settings"
              className="popup-local-settings-close"
              type="button"
              onClick={() => setSettingsOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <PopupHistorySettings ownerUserId={accountUser?.id ?? null} />
          <h3 className="popup-settings-section-title">Notifications · This browser only</h3>
          <button
            className="popup-notification-setting"
            type="button"
            disabled={
              notificationSettingsBusy ||
              !notificationStatus?.supported ||
              !notificationStatus?.configured
            }
            data-enabled={notificationStatus?.enabled ?? false}
            onClick={() => void toggleRoomInviteNotifications()}
          >
            <span className="popup-notification-setting-icon">
              {notificationStatus?.enabled ? <Bell size={17} /> : <BellOff size={17} />}
            </span>
            <span className="popup-notification-setting-copy">
              <strong>Invitation notifications</strong>
              <span>
                {!notificationStatus
                  ? "Checking this browser..."
                  : !notificationStatus.configured
                    ? "Unavailable in this build"
                    : notificationStatus.enabled
                      ? "Chrome alerts are on"
                      : "Get room invites and friend requests"}
              </span>
            </span>
            <span className="popup-notification-switch" aria-hidden="true">
              <span />
            </span>
          </button>
          {notificationSettingsError ? (
            <p className="popup-local-settings-error">{notificationSettingsError}</p>
          ) : null}
        </section>
      ) : null}

      <PopupNavigation activeTab={activeTab} onSelect={setActiveTab} />

      {activeTab === "resources" ? (
        <PopupWatchHistoryPanel
          key={accountUser?.id ?? "signed-out"}
          ownerUserId={accountUser?.id ?? null}
          refreshSignal={historySession.revision}
        />
      ) : activeTab === "friends" ? (
        <PopupPeoplePanel
          actionNotice={peopleActionNotice}
          pendingActionKey={peoplePendingActionKey}
          onAddFriend={addFriend}
          onCreateGroup={createGroup}
          onOpenDashboard={() => void openAccount("/account/friends")}
          onRefresh={() => void syncPopupData()}
          onSignIn={() => void syncPopupData({ interactive: true })}
          state={peoplePresentationState}
        />
      ) : (
        <PopupInboxPanel
          actionNotice={socialNotice}
          busyFriendRequestActionKey={busySocialAction}
          busyInviteId={busyInviteId}
          model={inboxModel}
          onAcceptFriendRequest={(friendshipId) => void acceptIncomingFriendRequest(friendshipId)}
          onAcceptInvite={(inviteId) => void acceptInvite(inviteId)}
          onDeclineFriendRequest={(friendshipId) => void declineIncomingFriendRequest(friendshipId)}
          onDeclineInvite={(inviteId) => void declineInvite(inviteId)}
          onOpenDashboard={() => void openAccount("/account/invites")}
          onRefresh={() => void syncPopupData()}
          onSignIn={() => void syncPopupData({ interactive: true })}
          state={inboxState}
        />
      )}
    </main>
  );
}

export function PopupNavigation({
  activeTab,
  onSelect,
}: {
  activeTab: PopupTab;
  onSelect: (tab: PopupTab) => void;
}) {
  return (
    <div className="popup-tabs" role="tablist" aria-label="Popup sections">
      <PopupNavigationButton
        active={activeTab === "resources"}
        label="Watch"
        onClick={() => onSelect("resources")}
      />
      <PopupNavigationButton
        active={activeTab === "friends"}
        label="People"
        onClick={() => onSelect("friends")}
      />
      <PopupNavigationButton
        active={activeTab === "inbox"}
        label="Inbox"
        onClick={() => onSelect("inbox")}
      />
    </div>
  );
}

function PopupNavigationButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className="popup-tab"
      data-active={active}
      role="tab"
      type="button"
      onClick={onClick}
    >
      <span className="popup-tab-label">{label}</span>
    </button>
  );
}

export function PopupInboxPanel({
  actionNotice = null,
  busyFriendRequestActionKey,
  busyInviteId,
  model,
  onAcceptFriendRequest,
  onAcceptInvite,
  onDeclineFriendRequest,
  onDeclineInvite,
  onOpenDashboard,
  onRefresh,
  onSignIn,
  state,
}: {
  actionNotice?: PopupNotice | null;
  busyFriendRequestActionKey: string | null;
  busyInviteId: string | null;
  model: PopupInboxModel | null;
  onAcceptFriendRequest: (friendshipId: string) => void;
  onAcceptInvite: (inviteId: string) => void;
  onDeclineFriendRequest: (friendshipId: string) => void;
  onDeclineInvite: (inviteId: string) => void;
  onOpenDashboard: () => void;
  onRefresh: () => void;
  onSignIn: () => void;
  state: AccountInboxState;
}) {
  const pendingFriendRequests = model?.friendRequests ?? [];
  const pendingInvites = model?.activeRoomInvites ?? [];
  const missedInvites = model?.missedRoomInvites ?? [];
  const actionsDisabled = state.status !== "ready";
  const showsCachedData =
    Boolean(model) && (state.status === "loading" || state.status === "error");
  const inboxActionNotice =
    actionNotice && isFriendRequestActionKey(actionNotice.actionKey) ? actionNotice : null;

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
          <span>Sign in to view friend requests and room invites.</span>
          <button className="popup-primary-button" type="button" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      ) : null}

      {state.status === "error" && !state.data ? (
        <div className="popup-social-empty" data-tone="error">
          <span>{state.error}</span>
          <button className="popup-primary-button" type="button" onClick={onRefresh}>
            Retry
          </button>
        </div>
      ) : null}

      {state.status === "loading" && !state.data ? (
        <div className="popup-empty">Loading inbox...</div>
      ) : null}

      {showsCachedData ? (
        <div
          className="popup-people-status"
          data-state={state.status === "error" ? "error" : "stale"}
          role="status"
        >
          <span>
            {state.status === "error"
              ? `${state.error} Saved inbox data may be out of date.`
              : "Refreshing inbox. Saved data may be out of date."}
          </span>
          {state.status === "error" ? (
            <button className="popup-secondary-button" type="button" onClick={onRefresh}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div aria-live="polite" className="popup-social-notice-slot">
        {inboxActionNotice ? (
          <div className="popup-social-notice" data-tone={inboxActionNotice.tone} role="status">
            {inboxActionNotice.text}
          </div>
        ) : null}
      </div>

      {model ? (
        <div className="popup-inbox-sections">
          <PopupInboxSection count={pendingFriendRequests.length} label="Friend requests">
            {pendingFriendRequests.length ? (
              pendingFriendRequests.map((request) => (
                <FriendRequestInboxRow
                  actionsDisabled={actionsDisabled}
                  busyActionKey={busyFriendRequestActionKey}
                  key={request.friendshipId}
                  request={request}
                  onAccept={() => onAcceptFriendRequest(request.friendshipId)}
                  onDecline={() => onDeclineFriendRequest(request.friendshipId)}
                />
              ))
            ) : (
              <div className="popup-inbox-empty">No pending friend requests.</div>
            )}
          </PopupInboxSection>

          <PopupInboxSection count={pendingInvites.length} label="Room invites">
            {pendingInvites.length ? (
              pendingInvites.map((invite) => (
                <InviteInboxRow
                  actionsDisabled={actionsDisabled}
                  busy={busyInviteId === invite.inviteId}
                  invite={invite}
                  key={invite.inviteId}
                  onAccept={() => onAcceptInvite(invite.inviteId)}
                  onDecline={() => onDeclineInvite(invite.inviteId)}
                />
              ))
            ) : (
              <div className="popup-inbox-empty">No pending room invites.</div>
            )}
          </PopupInboxSection>

          <PopupInboxSection count={missedInvites.length} label="Missed">
            {missedInvites.length ? (
              missedInvites.map((invite) => (
                <MissedInviteInboxRow invite={invite} key={invite.inviteId} />
              ))
            ) : (
              <div className="popup-inbox-empty">No missed room invites.</div>
            )}
          </PopupInboxSection>
        </div>
      ) : null}

      <button className="popup-dashboard-button" type="button" onClick={onOpenDashboard}>
        Open dashboard
      </button>
    </section>
  );
}

function PopupInboxSection({
  children,
  count,
  label,
}: {
  children: ReactNode;
  count: number;
  label: string;
}) {
  return (
    <section className="popup-inbox-section" aria-label={label}>
      <div className="popup-inbox-heading">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="popup-inbox-list">{children}</div>
    </section>
  );
}

function FriendRequestInboxRow({
  actionsDisabled,
  busyActionKey,
  onAccept,
  onDecline,
  request,
}: {
  actionsDisabled: boolean;
  busyActionKey: string | null;
  onAccept: () => void;
  onDecline: () => void;
  request: PopupInboxFriendRequest;
}) {
  const acceptBusy = busyActionKey === `accept-friend:${request.friendshipId}`;
  const declineBusy = busyActionKey === `decline-friend:${request.friendshipId}`;
  const busy = acceptBusy || declineBusy;
  return (
    <div className="popup-inbox-row">
      <div className="popup-inbox-main">
        <ProfileAvatar
          avatarUrl={request.sender.avatarUrl}
          displayName={request.sender.displayName}
        />
        <span className="popup-social-main">
          <span>{request.sender.displayName}</span>
          <span>{request.sender.handle ? `@${request.sender.handle}` : "Wants to be friends"}</span>
        </span>
      </div>
      <div className="popup-inbox-actions">
        <button
          aria-label={`Accept friend request from ${request.sender.displayName}`}
          className="popup-primary-button"
          disabled={actionsDisabled || busy}
          type="button"
          onClick={onAccept}
        >
          {acceptBusy ? <RefreshCw size={13} /> : <Check size={13} />}
          Accept
        </button>
        <button
          aria-label={`Decline friend request from ${request.sender.displayName}`}
          className="popup-secondary-button"
          disabled={actionsDisabled || busy}
          type="button"
          onClick={onDecline}
        >
          {declineBusy ? <RefreshCw size={13} /> : <X size={13} />}
          Decline
        </button>
      </div>
    </div>
  );
}

function InviteInboxRow({
  actionsDisabled,
  busy,
  invite,
  onAccept,
  onDecline,
}: {
  actionsDisabled: boolean;
  busy: boolean;
  invite: PopupInboxInvite;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="popup-inbox-card">
      <div className="popup-inbox-main">
        <ProfileAvatar
          avatarUrl={invite.sender.avatarUrl}
          displayName={invite.sender.displayName}
        />
        <span className="popup-social-main">
          <span>{invite.roomTitle ?? "Watch room invite"}</span>
          <span>
            {invite.targetGroupName ? `${invite.targetGroupName} · ` : ""}
            From {invite.sender.displayName} · {formatInboxActivity(invite.activityAt)}
          </span>
        </span>
      </div>
      {invite.message ? <p className="popup-inbox-message">{invite.message}</p> : null}
      <div className="popup-inbox-actions">
        <button
          aria-label={`Join room invite from ${invite.sender.displayName}`}
          className="popup-primary-button"
          disabled={actionsDisabled || busy}
          type="button"
          onClick={onAccept}
        >
          <Check size={13} />
          Join
        </button>
        <button
          aria-label={`Decline room invite from ${invite.sender.displayName}`}
          className="popup-secondary-button"
          disabled={actionsDisabled || busy}
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

function MissedInviteInboxRow({ invite }: { invite: PopupInboxInvite }) {
  return (
    <div className="popup-inbox-card" data-state="missed">
      <div className="popup-inbox-main">
        <ProfileAvatar
          avatarUrl={invite.sender.avatarUrl}
          displayName={invite.sender.displayName}
        />
        <span className="popup-social-main">
          <span>{invite.roomTitle ?? "Missed invite"}</span>
          <span>
            Missed invite · From {invite.sender.displayName} ·{" "}
            {formatInboxActivity(invite.activityAt)}
          </span>
        </span>
      </div>
      {invite.message ? <p className="popup-inbox-message">{invite.message}</p> : null}
    </div>
  );
}

function isPopupPeopleActionKey(value: string | null): value is PopupPeopleActionKey {
  return value === "create-group" || Boolean(value?.startsWith("add-friend:"));
}

function isPopupPeopleActionNotice(
  notice: PopupNotice | null,
): notice is PopupNotice & PopupPeopleActionNotice {
  return Boolean(notice && isPopupPeopleActionKey(notice.actionKey));
}

function isFriendRequestActionKey(value: string): boolean {
  return value.startsWith("accept-friend:") || value.startsWith("decline-friend:");
}

function formatInboxActivity(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recently";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
