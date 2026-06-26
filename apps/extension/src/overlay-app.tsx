import {
  getSyncCorrection,
  normalizeRemotePlaybackState,
  type P2PSignal,
  type Participant,
  type PlaybackState,
  type ReactionEvent,
  type RoomCapabilities,
  type ServerEvent,
} from "@anidachi/protocol";
import { Mic, MicOff, SendHorizontal, SmilePlus, X } from "lucide-react";
import type {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent,
  SyntheticEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "wxt/utils/storage";
import { consumeAnidachiLaunchIntent } from "./anidachi-launch-intent";
import {
  ANIDACHI_BUILD_ID,
  COMPOSER_EMOJI_PACK,
  EMOJI_PALETTE,
  WEB_HTTP_BASE,
} from "./constants";
import { CurrentResourcePanel } from "./current-resource-panel";
import { loadCrunchyrollPosterArtwork } from "./crunchyroll-artwork";
import {
  clearDebugLog,
  getCompactDebugLogText,
  getDebugEntries,
  getDebugLogText,
  logDebug,
  playbackStateDebugSnapshot,
  roomEventDebugSnapshot,
  videoDebugSnapshot,
} from "./debug-log";
import {
  DEFAULT_GHOST_CAM_SIZE_STEP,
  GHOST_CAM_SIZE_MAX_STEP,
  GHOST_CAM_SIZE_MIN_STEP,
  GHOST_CAM_SIZE_STEPS,
  getGhostCamGapPx,
  getGhostCamSizeLabel,
  getGhostCamSizePx,
  normalizeGhostCamSizeStep,
  type GhostCamSizeStep,
} from "./ghost-cam-size";
import { useGhostCam, type GhostVideo, type LiveVoiceStatus } from "./ghost-cam";
import { getHotkeyAction } from "./hotkeys";
import type { IncomingP2PSignal, MediaTransportName } from "./media-types";
import { selectP2PMediaParticipants } from "./p2p-media";
import {
  createRoomInvite,
  listInviteTargets,
  type CreateRoomInviteInput,
  type FriendGroup,
  type FriendListItem,
  type InviteTargets,
} from "./social-client";
import {
  ANIDACHI_COMPOSER_OPEN_ATTR,
  ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT,
  ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
  isMessageComposerShortcutEvent,
} from "./message-composer-events";
import {
  HOLD_FIRE_SUPER_REACTION_EXPERIMENT,
  P2P_MEDIA_TRANSPORT_EXPERIMENT,
  normalizeExperimentFlag,
  normalizeMediaTransportExperiment,
} from "./experiments";
import {
  EXTENSION_CONTEXT_INVALIDATED_MESSAGE,
  authErrorMessage,
  createCurrentParticipant,
  isExtensionContextInvalidatedError,
  signInAndCreateParticipant,
  signOutAndClearParticipant,
  trySilentSignIn,
  type CurrentParticipantResult,
} from "./user-identity";
import { AUTH_TOKENS_KEY, AUTH_TOKENS_STORAGE_KEY } from "./auth-tokens";
import {
  getRemotePlayReadyTimeoutMs,
  isMediaSettling,
  type RemoteSeekAttempt,
  shouldDeferHostStateSeek,
  shouldPlayWithoutWaitingForMediaReady,
  shouldSeekForHostState,
  shouldSeekForRemoteCommand,
  shouldThrottleRemoteSeekAttempt,
  waitForMediaReady,
} from "./playback-control";
import {
  connectWebsiteRoom,
  createRoom,
  endRoom,
  isQuotaExhaustedError,
  isTerminalRoomJoinError,
  RoomClient,
  type RoomConnectionStatus,
  type RoomQuotaSummary,
} from "./room-client";
import { getRoomReconnectDelayMs } from "./room-reconnect";
import {
  clearLegacyRoomSessionStorage,
  clearPersistedRoomId,
  getPersistedRoomId,
  getPersistedRoomIdForUser,
  getPersistedRoomOwnerId,
  getRoomSessionNamespace,
  persistRoomId,
  type RoomSessionNamespace,
} from "./room-session-storage";
import { acquireRoomTabLock, releaseRoomTabLock } from "./room-tab-lock";
import { overlayStyles } from "./styles";
import { runCrunchyrollMainCommand, type PlayerEvent, type VideoAdapter } from "./video-adapter";
import { isSpeechRecognitionSupported, mapVoiceToEmoji, startVoiceRecognition } from "./voice";
import {
  createEmptyWatchProgressStore,
  loadWatchProgressStoreForUser,
  recordWatchProgressForUser,
  type WatchProgressEntry,
  type WatchProgressStore,
} from "./watch-progress";
import {
  reconcileWatchProgress,
  type WatchCheckpointKind,
} from "./watch-library-client";
import { getWatchProgressEntryForAdapter } from "./watch-progress-entry";

interface OverlayAppProps {
  adapter: VideoAdapter;
}

interface CatchUpState {
  expectedTime: number;
  drift: number;
}

interface LocalSeekBroadcast {
  queuedAt: number;
  targetTime: number;
  timeoutId: number;
}

interface PendingRemoteSeek {
  startedAt: number;
  targetTime: number;
}

interface PendingSourceNavigation {
  previousCurrentSrc: string;
  previousVideo: HTMLVideoElement;
  startedAt: number;
  targetFingerprint: string;
  targetUrl: string;
}

type FireChargePhase = "charging" | "ready";

interface FireChargeState {
  participantId: string;
  phase: FireChargePhase;
}

interface FireHoldState {
  cleanup: () => void;
  delayTimerId: number;
  participantId: string;
  readyTimerId: number;
  startedAt: number;
}

type MessageDisplayMode = "chat" | "bubble";
type ChatDisplayMode = "live" | "history";

interface LiveChatMessage {
  id: string;
  reaction: ReactionEvent;
}

interface PointerWakePoint {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

interface CrunchyrollPlayerChromeState {
  controlsVisible: boolean;
  camStackBottomPx: number;
  containerHeightPx: number;
  miniPanelRightPx: number;
  miniPanelTopPx: number;
  topBubbleRightPx: number;
  topBubbleTopPx: number;
}

const REMOTE_EVENT_SUPPRESSION_MS = 1800;
const REMOTE_COMMAND_DEDUPE_MS = 800;
const CRUNCHYROLL_REMOTE_SEEK_GUARD_MS = 15_000;
const CRUNCHYROLL_REMOTE_SEEK_GUARD_TOLERANCE_SECONDS = 4;
const CRUNCHYROLL_REMOTE_SEEK_HOST_TARGET_TOLERANCE_SECONDS = 8;
const CRUNCHYROLL_LOCAL_SEEK_SETTLING_DELAY_MS = 360;
const CRUNCHYROLL_LOCAL_SEEK_READY_DELAY_MS = 80;
const CRUNCHYROLL_LOCAL_SEEK_DUPLICATE_MS = 1200;
const CRUNCHYROLL_LOCAL_SEEK_TOLERANCE_SECONDS = 0.75;
const CRUNCHYROLL_LOCAL_PLAYBACK_SUPPRESSION_AFTER_SEEK_MS = 900;
const CRUNCHYROLL_SOURCE_NAVIGATION_GUARD_MS = 6000;
const GHOST_CAM_SIZE_STORAGE_KEY = "local:ghostCamSizeStep";
const MESSAGE_DISPLAY_MODE_STORAGE_KEY = "local:messageDisplayMode";
const CHAT_DISPLAY_MODE_STORAGE_KEY = "local:chatDisplayMode";
const MEDIA_TRANSPORT_STORAGE_KEY = P2P_MEDIA_TRANSPORT_EXPERIMENT.storageKey;
const DEFAULT_MESSAGE_DISPLAY_MODE: MessageDisplayMode = "chat";
const DEFAULT_CHAT_DISPLAY_MODE: ChatDisplayMode = "live";
const LIVE_CHAT_MESSAGE_TTL_MS = 9000;
const LIVE_CHAT_MAX_MESSAGES = 6;
const CHAT_HISTORY_MAX_MESSAGES = 80;
const MESSAGE_COMPOSER_SHIELD_RELEASE_BUFFER_MS = 180;
const WATCH_LIBRARY_REMOTE_RECONCILE_INTERVAL_MS = 60_000;
const SILENT_SIGN_IN_SUPPRESSION_AFTER_SIGN_OUT_MS = 15_000;
const LIVE_CHAT_NAME_COLORS = [
  "#c4a7ff",
  "#7dd3fc",
  "#f9a8d4",
  "#86efac",
  "#fcd34d",
  "#fca5a5",
] as const;
const FIRE_REACTION_EMOJI = HOLD_FIRE_SUPER_REACTION_EXPERIMENT.emoji;
const FIRE_SUPER_EFFECT = HOLD_FIRE_SUPER_REACTION_EXPERIMENT.effect;
const FIRE_SUPER_REACTION_MARKER = HOLD_FIRE_SUPER_REACTION_EXPERIMENT.transportMarker;
const FIRE_SUPER_DELAY_MS = HOLD_FIRE_SUPER_REACTION_EXPERIMENT.revealDelayMs;
const FIRE_SUPER_CHARGE_MS = HOLD_FIRE_SUPER_REACTION_EXPERIMENT.chargeMs;
const FIRE_SUPER_TOTAL_MS = FIRE_SUPER_DELAY_MS + FIRE_SUPER_CHARGE_MS;
const NUKE_SPARKS = Array.from({ length: 12 }, (_, index) => index);
const DEFAULT_CAM_STACK_BOTTOM_PX = 54;
const DEFAULT_TOP_BUBBLE_TOP_PX = 10;
const DEFAULT_TOP_BUBBLE_RIGHT_PX = 10;
const DEFAULT_MINI_PANEL_TOP_PX = 48;
const DEFAULT_MINI_PANEL_RIGHT_PX = 10;
const DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE: CrunchyrollPlayerChromeState = {
  controlsVisible: false,
  camStackBottomPx: DEFAULT_CAM_STACK_BOTTOM_PX,
  containerHeightPx: 0,
  miniPanelRightPx: DEFAULT_MINI_PANEL_RIGHT_PX,
  miniPanelTopPx: DEFAULT_MINI_PANEL_TOP_PX,
  topBubbleRightPx: DEFAULT_TOP_BUBBLE_RIGHT_PX,
  topBubbleTopPx: DEFAULT_TOP_BUBBLE_TOP_PX,
};

export function OverlayApp({ adapter }: OverlayAppProps) {
  const clientRef = useRef(new RoomClient());
  const suppressLocalEventsUntilRef = useRef(0);
  const remotePlaybackTokenRef = useRef(0);
  const pendingPlayWaitRef = useRef(false);
  const consumedLaunchIntentRef = useRef(false);
  const lastRemoteCommandRef = useRef<{ key: string; receivedAt: number } | null>(null);
  const lastRemoteSeekAttemptRef = useRef<RemoteSeekAttempt | null>(null);
  const pendingRemoteSeekRef = useRef<PendingRemoteSeek | null>(null);
  const pendingSourceNavigationRef = useRef<PendingSourceNavigation | null>(null);
  const pendingLocalSeekBroadcastRef = useRef<LocalSeekBroadcast | null>(null);
  const lastLocalSeekEventAtRef = useRef(0);
  const lastLocalSeekBroadcastRef = useRef<{ sentAt: number; targetTime: number } | null>(null);
  const stopVoiceRef = useRef<(() => void) | null>(null);
  const restoreLiveVoiceDuckingRef = useRef<(() => void) | null>(null);
  const restoreVoiceDuckingRef = useRef<(() => void) | null>(null);
  const pendingVoiceTextRef = useRef<string | null>(null);
  const voiceCaptureActiveRef = useRef(false);
  const voiceStoppingRef = useRef(false);
  const flameTimersRef = useRef<Record<string, number | undefined>>({});
  const fireHoldRef = useRef<FireHoldState | null>(null);
  const liveChatTimersRef = useRef<Record<string, number | undefined>>({});
  const handledP2PSignalIdsRef = useRef(new Set<string>());
  const lastSeenP2PServerSeqRef = useRef(0);
  const p2pSignalSequenceRef = useRef(0);
  const roomReconnectAttemptRef = useRef(0);
  const roomReconnectInFlightRef = useRef(false);
  const roomReconnectSuppressedRef = useRef(false);
  const roomReconnectTimerRef = useRef<number | null>(null);
  const messageComposerFormRef = useRef<HTMLFormElement | null>(null);
  const messageComposerInputRef = useRef<HTMLInputElement | null>(null);
  const messageComposerShieldRef = useRef<HTMLDivElement | null>(null);
  const messageComposerShieldReleaseTimerRef = useRef<number | null>(null);
  const messageComposerShieldReleasePointerRef = useRef<PointerWakePoint | null>(null);
  const authUserIdRef = useRef<string | null>(null);
  const authUserIdInitializedRef = useRef(false);
  const suppressSilentSignInUntilRef = useRef(0);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [authAuthenticated, setAuthAuthenticated] = useState(false);
  const [authAccessToken, setAuthAccessToken] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [extensionContextInvalidated, setExtensionContextInvalidated] = useState(false);
  const [roomSessionNamespace, setRoomSessionNamespace] = useState<RoomSessionNamespace | null>(
    null,
  );
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [roomShareableLink, setRoomShareableLink] = useState<string | null>(null);
  const [roomQuota, setRoomQuota] = useState<RoomQuotaSummary | null>(null);
  const [roomCapabilities, setRoomCapabilities] = useState<RoomCapabilities | null>(null);
  const [quotaDisplayTick, setQuotaDisplayTick] = useState(0);
  const quotaMeteredMsRef = useRef(0);
  const quotaTickAtRef = useRef<number | null>(null);
  const quotaEndTriggeredRef = useRef(false);
  const createRequestIdRef = useRef<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<RoomConnectionStatus>("idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const [messageComposerOpen, setMessageComposerOpen] = useState(false);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [inviteTargets, setInviteTargets] = useState<InviteTargets | null>(null);
  const [inviteTargetsLoading, setInviteTargetsLoading] = useState(false);
  const [inviteSendingTarget, setInviteSendingTarget] = useState<string | null>(null);
  const [inviteStatusMessage, setInviteStatusMessage] = useState<string | null>(null);
  const [messageComposerGuardActive, setMessageComposerGuardActive] = useState(false);
  const [messageComposerShieldActive, setMessageComposerShieldActive] = useState(false);
  const [messageComposerShieldReleasing, setMessageComposerShieldReleasing] = useState(false);
  const [messageComposerEmojiOpen, setMessageComposerEmojiOpen] = useState(false);
  const [messageComposerText, setMessageComposerText] = useState("");
  const [camsEnabled, setCamsEnabled] = useState(true);
  const [ghostCamSizeStep, setGhostCamSizeStep] = useState<GhostCamSizeStep>(
    DEFAULT_GHOST_CAM_SIZE_STEP,
  );
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [experimentalSuperReactionsEnabled, setExperimentalSuperReactionsEnabled] = useState(
    HOLD_FIRE_SUPER_REACTION_EXPERIMENT.defaultEnabled,
  );
  const [messageDisplayMode, setMessageDisplayMode] = useState<MessageDisplayMode>(
    DEFAULT_MESSAGE_DISPLAY_MODE,
  );
  const [chatDisplayMode, setChatDisplayMode] =
    useState<ChatDisplayMode>(DEFAULT_CHAT_DISPLAY_MODE);
  const [mediaTransport, setMediaTransport] = useState<MediaTransportName>(
    P2P_MEDIA_TRANSPORT_EXPERIMENT.defaultTransport,
  );
  const [socialVisible, setSocialVisible] = useState(true);
  const [crunchyrollPlayerChrome, setCrunchyrollPlayerChrome] =
    useState<CrunchyrollPlayerChromeState>(DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [liveChatMessages, setLiveChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatHistoryMessages, setChatHistoryMessages] = useState<LiveChatMessage[]>([]);
  const [incomingP2PSignals, setIncomingP2PSignals] = useState<IncomingP2PSignal[]>([]);
  const [roomSnapshotReady, setRoomSnapshotReady] = useState(false);
  const [fireCharge, setFireCharge] = useState<FireChargeState | null>(null);
  const [flamingParticipantIds, setFlamingParticipantIds] = useState<string[]>([]);
  const [catchUp, setCatchUp] = useState<CatchUpState | null>(null);
  const [liveVoiceTalking, setLiveVoiceTalking] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [debugEntriesCount, setDebugEntriesCount] = useState(() => getDebugEntries().length);
  const [watchProgressStore, setWatchProgressStore] = useState<WatchProgressStore>(() =>
    createEmptyWatchProgressStore(),
  );
  const [currentResourceEntry, setCurrentResourceEntry] = useState<WatchProgressEntry | null>(null);
  const crunchyrollPosterRequestsRef = useRef<Record<string, Promise<string | null> | undefined>>(
    {},
  );

  const participantRef = useRef<Participant | null>(null);
  const authAccessTokenRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const roomTokenRef = useRef<string | null>(null);
  const roomShareableLinkRef = useRef<string | null>(null);
  const statusRef = useRef<RoomConnectionStatus>("idle");
  const participantsRef = useRef<Participant[]>([]);
  const handleServerEventRef = useRef<(event: ServerEvent) => void>(() => undefined);
  const applyParticipantIdentityRef = useRef<
    (result: CurrentParticipantResult, reason: string, reconnectActiveRoom: boolean) => void
  >(() => undefined);

  useEffect(() => {
    participantRef.current = participant;
  }, [participant]);

  useEffect(() => {
    authAccessTokenRef.current = authAccessToken;
  }, [authAccessToken]);

  useEffect(() => {
    roomIdRef.current = roomId;
    if (!roomId) {
      setRoomCapabilities(null);
      setInvitePanelOpen(false);
      setInviteTargets(null);
      setInviteStatusMessage(null);
    }
    handledP2PSignalIdsRef.current.clear();
    lastSeenP2PServerSeqRef.current = 0;
    p2pSignalSequenceRef.current = 0;
    setRoomSnapshotReady(false);
    setIncomingP2PSignals([]);
  }, [roomId]);

  useEffect(() => {
    roomTokenRef.current = roomToken;
  }, [roomToken]);

  useEffect(() => {
    roomShareableLinkRef.current = roomShareableLink;
  }, [roomShareableLink]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    let cancelled = false;
    void getRoomSessionNamespace()
      .then((namespace) => {
        if (cancelled) {
          return;
        }

        clearLegacyRoomSessionStorage();
        clearLegacyParticipantSessionStorage();
        setRoomSessionNamespace(namespace);
        logDebug("overlay.room", "room session namespace ready", {
          installId: namespace.installId,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setExtensionContextInvalidated(isExtensionContextInvalidatedError(error));
        setAuthMessage(authErrorMessage(error, "Failed to initialize Anidachi room state"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetLocalRoomSession = useCallback((message?: string, openPanel = false) => {
    roomReconnectSuppressedRef.current = true;
    if (roomReconnectTimerRef.current !== null) {
      window.clearTimeout(roomReconnectTimerRef.current);
      roomReconnectTimerRef.current = null;
    }
    clientRef.current.close();
    releaseRoomTabLock();
    setRoomId(null);
    setParticipants([]);
    setRoomQuota(null);
    roomTokenRef.current = null;
    roomShareableLinkRef.current = null;
    setRoomToken(null);
    setRoomShareableLink(null);
    setRoomCapabilities(null);
    clearLegacyRoomSessionStorage();
    if (roomSessionNamespace) {
      clearPersistedRoomId(roomSessionNamespace);
    }
    clearRoomHash();
    if (message !== undefined) {
      setAuthMessage(message);
    }
    if (openPanel) {
      setPanelOpen(true);
    }
  }, [roomSessionNamespace]);

  const syncAuthUserScopedState = useCallback(
    (nextAuthUserId: string | null, reason: string) => {
      const previousAuthUserId = authUserIdRef.current;
      const wasInitialized = authUserIdInitializedRef.current;
      authUserIdInitializedRef.current = true;

      if (previousAuthUserId === nextAuthUserId) {
        return;
      }

      authUserIdRef.current = nextAuthUserId;
      void loadWatchProgressStoreForUser(nextAuthUserId).then(setWatchProgressStore);

      if (!wasInitialized || previousAuthUserId === null) {
        return;
      }

      logDebug("identity", "auth user changed; clearing local room session", {
        reason,
        previousAuthUserId,
        nextAuthUserId,
        activeRoomId: roomIdRef.current,
        persistedRoomId: roomSessionNamespace
          ? getPersistedRoomId(roomSessionNamespace)
          : null,
        persistedRoomOwnerId: roomSessionNamespace
          ? getPersistedRoomOwnerId(roomSessionNamespace)
          : null,
      });
      resetLocalRoomSession(undefined, false);
    },
    [resetLocalRoomSession, roomSessionNamespace],
  );

  const refreshRoomActionIdentity = useCallback(async (reason: string) => {
    const result = await createCurrentParticipant();
    syncAuthUserScopedState(result.tokens?.user.id ?? null, reason);
    authAccessTokenRef.current = result.tokens?.accessToken ?? null;
    participantRef.current = result.participant;
    setParticipant(result.participant);
    setAuthAuthenticated(result.authenticated);
    setAuthAccessToken(result.tokens?.accessToken ?? null);
    setExtensionContextInvalidated(Boolean(result.requiresPageReload));
    setAuthMessage(result.message ?? null);

    if (!result.authenticated) {
      roomTokenRef.current = null;
      roomShareableLinkRef.current = null;
      setRoomToken(null);
      setRoomShareableLink(null);
      setRoomCapabilities(null);
    }

    logDebug("identity", "room action session refreshed", {
      reason,
      authenticated: result.authenticated,
      requiresPageReload: Boolean(result.requiresPageReload),
      participantId: result.participant?.id ?? null,
      displayName: result.participant?.displayName ?? null,
    });

    return {
      accessToken: result.tokens?.accessToken ?? null,
      participant: result.participant,
    };
  }, []);

  const getFreshAuthAccessToken = useCallback(
    async (reason: string): Promise<string | null> => {
      const refreshed = await refreshRoomActionIdentity(reason);
      return refreshed.accessToken;
    },
    [refreshRoomActionIdentity],
  );

  const setMessageComposerDomGuard = useCallback(
    (active: boolean) => {
      if (active) {
        document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] = "true";
        adapter.container.dataset[ANIDACHI_COMPOSER_OPEN_ATTR] = "true";
        return;
      }

      delete document.documentElement.dataset[ANIDACHI_COMPOSER_OPEN_ATTR];
      delete adapter.container.dataset[ANIDACHI_COMPOSER_OPEN_ATTR];
    },
    [adapter.container],
  );

  const clearMessageComposerShieldReleaseTimer = useCallback(() => {
    if (messageComposerShieldReleaseTimerRef.current === null) {
      return;
    }

    window.clearTimeout(messageComposerShieldReleaseTimerRef.current);
    messageComposerShieldReleaseTimerRef.current = null;
  }, []);

  const deactivateMessageComposerGuard = useCallback(() => {
    clearMessageComposerShieldReleaseTimer();
    resetComposerShieldInlineStyles(messageComposerShieldRef.current);
    messageComposerShieldReleasePointerRef.current = null;
    setMessageComposerShieldActive(false);
    setMessageComposerShieldReleasing(false);
    setMessageComposerGuardActive(false);
    setMessageComposerDomGuard(false);
  }, [clearMessageComposerShieldReleaseTimer, setMessageComposerDomGuard]);

  const activateMessageComposerGuard = useCallback(() => {
    clearMessageComposerShieldReleaseTimer();
    resetComposerShieldInlineStyles(messageComposerShieldRef.current);
    messageComposerShieldReleasePointerRef.current = null;
    setMessageComposerShieldActive(true);
    setMessageComposerShieldReleasing(false);
    setMessageComposerGuardActive(true);
    setMessageComposerDomGuard(true);
  }, [clearMessageComposerShieldReleaseTimer, setMessageComposerDomGuard]);

  const releaseMessageComposerGuard = useCallback(() => {
    clearMessageComposerShieldReleaseTimer();
    resetComposerShieldInlineStyles(messageComposerShieldRef.current);
    messageComposerShieldReleasePointerRef.current = null;
    setMessageComposerShieldActive(true);
    setMessageComposerShieldReleasing(false);
    setMessageComposerGuardActive(true);
    setMessageComposerDomGuard(true);
  }, [clearMessageComposerShieldReleaseTimer, setMessageComposerDomGuard]);

  useEffect(() => {
    return () => {
      if (fireHoldRef.current) {
        fireHoldRef.current.cleanup();
        window.clearTimeout(fireHoldRef.current.delayTimerId);
        window.clearTimeout(fireHoldRef.current.readyTimerId);
        fireHoldRef.current = null;
      }
      for (const timerId of Object.values(flameTimersRef.current)) {
        if (timerId !== undefined) {
          window.clearTimeout(timerId);
        }
      }
      flameTimersRef.current = {};
      for (const timerId of Object.values(liveChatTimersRef.current)) {
        if (timerId !== undefined) {
          window.clearTimeout(timerId);
        }
      }
      liveChatTimersRef.current = {};
      clearMessageComposerShieldReleaseTimer();
      resetComposerShieldInlineStyles(messageComposerShieldRef.current);
      setMessageComposerDomGuard(false);
    };
  }, [clearMessageComposerShieldReleaseTimer, setMessageComposerDomGuard]);

  const currentParticipant = useMemo(
    () => participants.find((item) => item.id === participant?.id) ?? participant,
    [participant, participants],
  );
  const visibleParticipants = participants.length ? participants : participant ? [participant] : [];
  const participantCount = participants.length || (participant ? 1 : 0);
  const roomParticipantLimit = roomCapabilities?.maxParticipants ?? 4;
  const roomMediaSeatLimit = roomCapabilities?.maxMediaSeats ?? 4;
  const occupiedMediaSeatCount = visibleParticipants.filter((item) => item.cameraEnabled).length;
  const localHasMediaSeat = Boolean(
    currentParticipant &&
      visibleParticipants.find((item) => item.id === currentParticipant.id)?.cameraEnabled,
  );
  const localTryingMedia = Boolean(camsEnabled && currentParticipant && roomMediaSeatLimit > 0);
  const mediaParticipants = currentParticipant
    ? selectP2PMediaParticipants(visibleParticipants, currentParticipant.id, localTryingMedia)
    : [];
  const displayedCameraParticipants = mediaParticipants.length ? mediaParticipants : [];
  const liveMediaAvailable =
    roomMediaSeatLimit > 0 &&
    (localHasMediaSeat || occupiedMediaSeatCount < roomMediaSeatLimit);
  const mediaSeatText =
    roomMediaSeatLimit > 0
      ? `${Math.min(occupiedMediaSeatCount, roomMediaSeatLimit)}/${roomMediaSeatLimit} media seats`
      : "No live media";
  const participantLimitText = `${participantCount}/${roomParticipantLimit} people`;
  const isHost = currentParticipant?.role === "host";
  const isConnected = status === "connected";
  const p2pReady = Boolean(
    roomId && isConnected && roomSnapshotReady && roomMediaSeatLimit > 0,
  );
  const title = adapter.getTitle() ?? "HTML5 video";
  const messageComposerShieldVisible = messageComposerOpen || messageComposerShieldActive;
  const messageComposerShieldLatched = messageComposerShieldActive && !messageComposerOpen;
  const messageComposerShieldClassName = [
    "message-composer-shield",
    messageComposerShieldLatched ? "latched" : "",
    messageComposerShieldReleasing ? "releasing" : "",
  ]
    .filter(Boolean)
    .join(" ");
  // The free daily quota only burns while you host a room that a guest has
  // actually joined (mirrors the server's metering proxy in room-quota.ts), so
  // the live countdown ticks only under those conditions and freezes otherwise.
  const quotaMeteringActive =
    isConnected && isHost && participantCount > 1 && roomQuota !== null;
  const quotaRemainingSeconds = useMemo(() => {
    if (!roomQuota) {
      return null;
    }
    // quotaDisplayTick advances once per second while metering is active so the
    // countdown re-renders even though the elapsed time lives in a ref.
    return Math.max(0, Math.floor(roomQuota.remainingSeconds - quotaMeteredMsRef.current / 1000));
  }, [roomQuota, quotaDisplayTick]);
  const ghostCamSizePx = getGhostCamSizePx(ghostCamSizeStep);
  const ghostCamGapPx = getGhostCamGapPx(ghostCamSizeStep);
  const ghostCamSizeLabel = getGhostCamSizeLabel(ghostCamSizeStep);
  const isCrunchyroll = adapter.id === "crunchyroll";
  const camStackBottomPx = isCrunchyroll
    ? crunchyrollPlayerChrome.camStackBottomPx
    : DEFAULT_CAM_STACK_BOTTOM_PX;
  const liveChatBottomPx =
    camsEnabled && displayedCameraParticipants.length
      ? camStackBottomPx + ghostCamSizePx + Math.max(12, Math.round(ghostCamSizePx * 0.16))
      : Math.max(32, camStackBottomPx);
  const miniPanelMaxHeightPx = isCrunchyroll
    ? getCrunchyrollMiniPanelMaxHeightPx(crunchyrollPlayerChrome, camStackBottomPx, ghostCamSizePx)
    : null;
  const overlayCssVariables = {
    "--cam-bubble-gap": `${ghostCamGapPx}px`,
    "--cam-bubble-size": `${ghostCamSizePx}px`,
    "--cam-stack-bottom": `${camStackBottomPx}px`,
    "--live-chat-bottom": `${liveChatBottomPx}px`,
    "--mini-panel-max-height": miniPanelMaxHeightPx ? `${miniPanelMaxHeightPx}px` : undefined,
    "--mini-panel-right": `${
      isCrunchyroll ? crunchyrollPlayerChrome.miniPanelRightPx : DEFAULT_MINI_PANEL_RIGHT_PX
    }px`,
    "--mini-panel-top": `${
      isCrunchyroll ? crunchyrollPlayerChrome.miniPanelTopPx : DEFAULT_MINI_PANEL_TOP_PX
    }px`,
    "--top-bubble-right": `${
      isCrunchyroll ? crunchyrollPlayerChrome.topBubbleRightPx : DEFAULT_TOP_BUBBLE_RIGHT_PX
    }px`,
    "--top-bubble-top": `${
      isCrunchyroll ? crunchyrollPlayerChrome.topBubbleTopPx : DEFAULT_TOP_BUBBLE_TOP_PX
    }px`,
  } as CSSProperties;
  const overlayClassName = [
    "anidachi-overlay",
    isCrunchyroll ? "is-crunchyroll" : "",
    isCrunchyroll && crunchyrollPlayerChrome.controlsVisible ? "player-controls-visible" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const displayedChatMessages =
    chatDisplayMode === "history" ? chatHistoryMessages : liveChatMessages;

  useEffect(() => {
    if (!roomId || !roomSnapshotReady || !camsEnabled) {
      return;
    }

    if (roomMediaSeatLimit <= 0) {
      setCamsEnabled(false);
      return;
    }

    if (!localHasMediaSeat && occupiedMediaSeatCount >= roomMediaSeatLimit) {
      setCamsEnabled(false);
    }
  }, [
    camsEnabled,
    localHasMediaSeat,
    occupiedMediaSeatCount,
    roomId,
    roomMediaSeatLimit,
    roomSnapshotReady,
  ]);

  const setRoomStatus = useCallback(
    (nextStatus: RoomConnectionStatus) => {
      logDebug("overlay.status", nextStatus, {
        roomId: roomIdRef.current,
        participantId: participantRef.current?.id,
        video: videoDebugSnapshot(adapter.video),
      });
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      if (nextStatus === "connected") {
        roomReconnectAttemptRef.current = 0;
        if (roomReconnectTimerRef.current !== null) {
          window.clearTimeout(roomReconnectTimerRef.current);
          roomReconnectTimerRef.current = null;
        }
      }
    },
    [adapter],
  );

  useEffect(() => {
    const id = window.setInterval(() => setDebugEntriesCount(getDebugEntries().length), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadWatchProgressStoreForUser(authUserIdRef.current).then((store) => {
      if (!cancelled) {
        setWatchProgressStore(store);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void storage.getItem<number | string>(GHOST_CAM_SIZE_STORAGE_KEY).then((storedStep) => {
      if (!cancelled && storedStep !== null) {
        setGhostCamSizeStep(normalizeGhostCamSizeStep(storedStep));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void storage
      .getItem<boolean | string>(HOLD_FIRE_SUPER_REACTION_EXPERIMENT.storageKey)
      .then((storedFlag) => {
        if (!cancelled && storedFlag !== null) {
          setExperimentalSuperReactionsEnabled(
            normalizeExperimentFlag(storedFlag, HOLD_FIRE_SUPER_REACTION_EXPERIMENT.defaultEnabled),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void storage.getItem<MediaTransportName | string>(MEDIA_TRANSPORT_STORAGE_KEY).then((value) => {
      if (!cancelled && value !== null) {
        setMediaTransport(
          normalizeMediaTransportExperiment(value, P2P_MEDIA_TRANSPORT_EXPERIMENT.defaultTransport),
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void storage
      .getItem<MessageDisplayMode | string>(MESSAGE_DISPLAY_MODE_STORAGE_KEY)
      .then((storedMode) => {
        if (!cancelled && storedMode !== null) {
          setMessageDisplayMode(normalizeMessageDisplayMode(storedMode));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void storage.getItem<ChatDisplayMode | string>(CHAT_DISPLAY_MODE_STORAGE_KEY).then((mode) => {
      if (!cancelled && mode !== null) {
        setChatDisplayMode(normalizeChatDisplayMode(mode));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleGhostCamSizeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextStep = normalizeGhostCamSizeStep(event.currentTarget.value);
    setGhostCamSizeStep(nextStep);
    void storage.setItem(GHOST_CAM_SIZE_STORAGE_KEY, nextStep);
  }, []);

  const handleMessageDisplayModeChange = useCallback((nextMode: MessageDisplayMode) => {
    setMessageDisplayMode(nextMode);
    void storage.setItem(MESSAGE_DISPLAY_MODE_STORAGE_KEY, nextMode);
  }, []);

  const handleChatDisplayModeChange = useCallback((nextMode: ChatDisplayMode) => {
    setChatDisplayMode(nextMode);
    void storage.setItem(CHAT_DISPLAY_MODE_STORAGE_KEY, nextMode);
  }, []);

  useEffect(() => {
    if (adapter.id !== "crunchyroll") {
      setCrunchyrollPlayerChrome(DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE);
      return;
    }
    if (panelOpen) {
      return;
    }

    let disposed = false;
    let frameId = 0;

    const applyState = () => {
      frameId = 0;
      if (disposed) {
        return;
      }

      const nextState = getCrunchyrollPlayerChromeState(adapter.container);
      setCrunchyrollPlayerChrome((current) =>
        areCrunchyrollPlayerChromeStatesEqual(current, nextState) ? current : nextState,
      );
    };

    const scheduleApplyState = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(applyState);
    };

    scheduleApplyState();
    const intervalId = window.setInterval(scheduleApplyState, 250);
    const observer = new MutationObserver(scheduleApplyState);
    observer.observe(adapter.container, {
      attributeFilter: ["aria-hidden", "class", "data-testid", "style"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    adapter.container.addEventListener("mousemove", scheduleApplyState, true);
    adapter.container.addEventListener("pointermove", scheduleApplyState, true);
    adapter.container.addEventListener("pointerleave", scheduleApplyState, true);
    document.addEventListener("fullscreenchange", scheduleApplyState, true);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
      adapter.container.removeEventListener("mousemove", scheduleApplyState, true);
      adapter.container.removeEventListener("pointermove", scheduleApplyState, true);
      adapter.container.removeEventListener("pointerleave", scheduleApplyState, true);
      document.removeEventListener("fullscreenchange", scheduleApplyState, true);
    };
  }, [adapter, panelOpen]);

  useEffect(() => {
    setMessageComposerDomGuard(messageComposerOpen || messageComposerGuardActive);
  }, [messageComposerGuardActive, messageComposerOpen, setMessageComposerDomGuard]);

  useEffect(() => {
    if (!messageComposerOpen) {
      return;
    }

    const focusInput = () => {
      messageComposerInputRef.current?.focus({ preventScroll: true });
    };

    focusInput();
    const frameId = window.requestAnimationFrame(focusInput);
    const timeoutId = window.setTimeout(focusInput, 40);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [messageComposerOpen]);

  useEffect(() => {
    if (!messageComposerOpen && !messageComposerGuardActive) {
      return;
    }

    const blockComposerDeadZoneMovement = (event: MouseEvent | globalThis.PointerEvent) => {
      if (!isPointerInComposerDeadZone(event, adapter.container)) {
        return;
      }

      event.stopImmediatePropagation();
      event.stopPropagation();
    };

    window.addEventListener("mousemove", blockComposerDeadZoneMovement, true);
    window.addEventListener("pointermove", blockComposerDeadZoneMovement, true);

    return () => {
      window.removeEventListener("mousemove", blockComposerDeadZoneMovement, true);
      window.removeEventListener("pointermove", blockComposerDeadZoneMovement, true);
    };
  }, [adapter.container, messageComposerGuardActive, messageComposerOpen]);

  useEffect(() => {
    if (!messageComposerOpen) {
      return;
    }

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const form = messageComposerFormRef.current;
      if (!form) {
        return;
      }

      if (event.composedPath().includes(form)) {
        return;
      }

      setMessageComposerOpen(false);
      setMessageComposerEmojiOpen(false);
      setMessageComposerText("");
    };

    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [messageComposerOpen]);

  useEffect(() => {
    if (!roomId) {
      setMessageComposerOpen(false);
      setMessageComposerEmojiOpen(false);
      setMessageComposerText("");
    }
  }, [roomId]);

  const loadPosterArtwork = useCallback(
    (
      entry: WatchProgressEntry | null,
      getLatestEntry: () => WatchProgressEntry | null,
      isDisposed: () => boolean,
    ) => {
      if (
        entry?.provider !== "crunchyroll" ||
        (!entry.contentId && !entry.seriesId) ||
        entry.artworkUrl
      ) {
        return;
      }

      const requestId = entry.seriesId ?? entry.contentId;
      if (!requestId) {
        return;
      }

      const existingRequest = crunchyrollPosterRequestsRef.current[requestId];
      if (existingRequest) {
        return;
      }

      const request = loadCrunchyrollPosterArtwork({
        contentId: entry.contentId,
        seriesId: entry.seriesId,
      }).catch((error: unknown) => {
        logDebug("crunchyroll.artwork", "poster load failed", {
          contentId: entry.contentId,
          seriesId: entry.seriesId,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
      crunchyrollPosterRequestsRef.current[requestId] = request;

      void request.then((posterUrl) => {
        if (!posterUrl) {
          delete crunchyrollPosterRequestsRef.current[requestId];
          return;
        }

        if (isDisposed()) {
          return;
        }

        const latestEntry = getLatestEntry();
        if (!latestEntry || latestEntry.itemId !== entry.itemId) {
          return;
        }

        const enrichedEntry = { ...latestEntry, artworkUrl: posterUrl };
        setCurrentResourceEntry(enrichedEntry);
        void recordWatchProgressForUser(authUserIdRef.current, enrichedEntry).then(
          setWatchProgressStore,
        );
      });
    },
    [],
  );

  useEffect(() => {
    let disposed = false;
    let lastPersistedAt = 0;
    let lastRemoteReconcileAt = 0;
    const getEntry = () =>
      getWatchProgressEntryForAdapter({
        adapter,
        roomId: roomId ?? undefined,
        watchedWithCount: Math.max(1, participantCount),
      });
    const reconcileRemote = (
      entry: WatchProgressEntry,
      checkpointKind: WatchCheckpointKind,
      force: boolean,
    ) => {
      if (!authAccessTokenRef.current || entry.duration <= 0 || entry.currentTime <= 0) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastRemoteReconcileAt < WATCH_LIBRARY_REMOTE_RECONCILE_INTERVAL_MS) {
        return;
      }

      lastRemoteReconcileAt = now;
      void (async () => {
        const accessToken = await getFreshAuthAccessToken(
          `watch-library:${checkpointKind}`,
        );
        if (!accessToken) {
          return;
        }

        await reconcileWatchProgress(accessToken, [
          {
            ...entry,
            checkpointKind,
            observedAt: now,
          },
        ]);
      })().catch((error: unknown) => {
        logDebug("watch-library.reconcile", "remote reconcile failed", {
          checkpointKind,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    };
    const update = (
      persist: boolean,
      checkpointKind: WatchCheckpointKind = "local",
      forceRemote = false,
    ) => {
      const entry = getEntry();
      setCurrentResourceEntry(entry);
      loadPosterArtwork(entry, getEntry, () => disposed);

      if (!persist || !entry || entry.duration <= 0 || entry.currentTime <= 0) {
        return;
      }

      const now = Date.now();
      if (!forceRemote && now - lastPersistedAt < 2500) {
        return;
      }

      lastPersistedAt = now;
      void recordWatchProgressForUser(authUserIdRef.current, entry).then(setWatchProgressStore);
      reconcileRemote(entry, checkpointKind, forceRemote);
    };
    const updateDisplay = () => update(false);
    const persist = () => update(true, "local", false);
    const persistPause = () => update(true, "pause", true);
    const persistSeeked = () => update(true, "seeked", true);
    const persistEnded = () => update(true, "ended", true);
    const persistPagehide = () => update(true, "pagehide", true);

    update(true);
    const displayInterval = window.setInterval(updateDisplay, 1000);
    const persistInterval = window.setInterval(persist, 5000);
    adapter.video.addEventListener("pause", persistPause);
    adapter.video.addEventListener("seeked", persistSeeked);
    adapter.video.addEventListener("ended", persistEnded);
    window.addEventListener("pagehide", persistPagehide);

    return () => {
      disposed = true;
      window.clearInterval(displayInterval);
      window.clearInterval(persistInterval);
      adapter.video.removeEventListener("pause", persistPause);
      adapter.video.removeEventListener("seeked", persistSeeked);
      adapter.video.removeEventListener("ended", persistEnded);
      window.removeEventListener("pagehide", persistPagehide);
    };
  }, [adapter, getFreshAuthAccessToken, roomId, participantCount, loadPosterArtwork]);

  const sendCameraStatus = useCallback((enabled: boolean) => {
    const activeRoomId = roomIdRef.current;
    const activeParticipant = participantRef.current;
    if (!activeRoomId || !activeParticipant) {
      return;
    }

    clientRef.current.send({
      type: enabled ? "CAMERA_ON" : "CAMERA_OFF",
      roomId: activeRoomId,
      userId: activeParticipant.id,
    });
  }, []);

  const sendP2PSignal = useCallback((toUserId: string, signal: P2PSignal) => {
    const activeRoomId = roomIdRef.current;
    const activeParticipant = participantRef.current;
    if (!activeRoomId || !activeParticipant || toUserId === activeParticipant.id) {
      return;
    }

    clientRef.current.send({
      type: "P2P_SIGNAL",
      clientSignalId: createClientSignalId(),
      roomId: activeRoomId,
      fromUserId: activeParticipant.id,
      senderConnectionId: clientRef.current.senderConnectionId,
      toUserId,
      signal,
    });
  }, []);

  const handleGhostCamToggle = useCallback(() => {
    setCamsEnabled((current) => {
      const next = !current;
      if (!next) {
        return false;
      }

      if (roomIdRef.current && roomMediaSeatLimit <= 0) {
        setAuthMessage("Live media is not available in this room.");
        setPanelOpen(true);
        return false;
      }

      if (
        roomIdRef.current &&
        !localHasMediaSeat &&
        occupiedMediaSeatCount >= roomMediaSeatLimit
      ) {
        setAuthMessage(`All ${roomMediaSeatLimit} live media seats are already in use.`);
        setPanelOpen(true);
        return false;
      }

      return true;
    });
  }, [localHasMediaSeat, occupiedMediaSeatCount, roomMediaSeatLimit]);

  const ghostCamSession = useGhostCam({
    cameraEnabled: camsEnabled,
    connected: p2pReady,
    incomingP2PSignals,
    participants: visibleParticipants,
    roomId,
    roomToken,
    participant,
    onCameraStatus: sendCameraStatus,
    sendP2PSignal,
    transport: mediaTransport,
    voiceTalkActive: liveVoiceTalking,
  });
  const ghostVideos = ghostCamSession.videos;
  const liveVoiceActiveSpeakerIds = ghostCamSession.activeSpeakerIds;
  const remoteLiveVoiceActive = liveVoiceActiveSpeakerIds.some((id) => id !== participant?.id);
  const liveVoiceStatusText = getLiveVoiceStatusText(ghostCamSession.voiceStatus, liveVoiceTalking);

  const isCurrentHost = useCallback((list = participantsRef.current) => {
    const current = participantRef.current;
    return Boolean(current && list.find((item) => item.id === current.id)?.role === "host");
  }, []);

  const triggerFlameBurst = useCallback((participantId: string | undefined, durationMs = 3200) => {
    if (!participantId) {
      return;
    }

    const existingTimer = flameTimersRef.current[participantId];
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }

    setFlamingParticipantIds((current) =>
      current.includes(participantId) ? current : [...current, participantId],
    );
    flameTimersRef.current[participantId] = window.setTimeout(() => {
      delete flameTimersRef.current[participantId];
      setFlamingParticipantIds((current) => current.filter((id) => id !== participantId));
    }, durationMs);
  }, []);

  const enqueueLiveChatMessage = useCallback((reaction: ReactionEvent) => {
    const timerId = liveChatTimersRef.current[reaction.id];
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
    }

    setLiveChatMessages((current) =>
      [...current.filter((item) => item.id !== reaction.id), { id: reaction.id, reaction }].slice(
        -LIVE_CHAT_MAX_MESSAGES,
      ),
    );

    liveChatTimersRef.current[reaction.id] = window.setTimeout(() => {
      delete liveChatTimersRef.current[reaction.id];
      setLiveChatMessages((current) => current.filter((item) => item.id !== reaction.id));
    }, LIVE_CHAT_MESSAGE_TTL_MS);
  }, []);

  const recordChatHistoryMessage = useCallback((reaction: ReactionEvent) => {
    setChatHistoryMessages((current) =>
      [...current.filter((item) => item.id !== reaction.id), { id: reaction.id, reaction }].slice(
        -CHAT_HISTORY_MAX_MESSAGES,
      ),
    );
  }, []);

  const cancelPendingRemotePlayback = useCallback(
    (reason: string) => {
      remotePlaybackTokenRef.current += 1;
      pendingPlayWaitRef.current = false;
      logDebug("sync.remote", "cancel pending playback", {
        reason,
        token: remotePlaybackTokenRef.current,
        video: videoDebugSnapshot(adapter.video),
      });
    },
    [adapter, roomSessionNamespace],
  );

  const rememberPendingRemoteSeek = useCallback(
    (targetTime: number, reason: string) => {
      if (adapter.id !== "crunchyroll") {
        return;
      }

      pendingRemoteSeekRef.current = { startedAt: Date.now(), targetTime };
      logDebug("sync.remote", "remember pending Crunchyroll seek", {
        reason,
        targetTime,
        video: videoDebugSnapshot(adapter.video),
      });
    },
    [adapter],
  );

  const clearPendingRemoteSeekIfSettled = useCallback(
    (reason: string) => {
      const pending = pendingRemoteSeekRef.current;
      if (!pending || adapter.id !== "crunchyroll") {
        return;
      }

      const ageMs = Date.now() - pending.startedAt;
      const driftFromSeekTarget = adapter.getCurrentTime() - pending.targetTime;
      const isNearSeekTarget =
        Math.abs(driftFromSeekTarget) <= CRUNCHYROLL_REMOTE_SEEK_GUARD_TOLERANCE_SECONDS;
      if (
        (!isMediaSettling(adapter.video) && isNearSeekTarget) ||
        ageMs > CRUNCHYROLL_REMOTE_SEEK_GUARD_MS
      ) {
        pendingRemoteSeekRef.current = null;
        logDebug("sync.remote", "clear pending Crunchyroll seek", {
          reason,
          pending,
          ageMs,
          driftFromSeekTarget,
          video: videoDebugSnapshot(adapter.video),
        });
      }
    },
    [adapter],
  );

  const shouldHoldHostStateForPendingCrunchyrollSeek = useCallback(
    (state: PlaybackState) => {
      if (adapter.id !== "crunchyroll") {
        return false;
      }

      const pending = pendingRemoteSeekRef.current;
      if (!pending) {
        return false;
      }

      const ageMs = Date.now() - pending.startedAt;
      if (ageMs > CRUNCHYROLL_REMOTE_SEEK_GUARD_MS) {
        return false;
      }

      const expectedPendingTime = state.playing
        ? pending.targetTime + (ageMs / 1000) * (state.playbackRate || 1)
        : pending.targetTime;
      const remoteStateDistanceFromPending = Math.abs(state.hostTime - expectedPendingTime);
      if (remoteStateDistanceFromPending > CRUNCHYROLL_REMOTE_SEEK_HOST_TARGET_TOLERANCE_SECONDS) {
        pendingRemoteSeekRef.current = null;
        logDebug("sync.applyHostState", "released pending Crunchyroll seek for newer host target", {
          pending,
          ageMs,
          expectedPendingTime,
          remoteStateDistanceFromPending,
          state: playbackStateDebugSnapshot(state),
          video: videoDebugSnapshot(adapter.video),
        });
        return false;
      }

      const driftFromSeekTarget = adapter.getCurrentTime() - pending.targetTime;
      const isFreshSeekDispatch = ageMs < 500;
      const shouldHold =
        isFreshSeekDispatch ||
        isMediaSettling(adapter.video) ||
        Math.abs(driftFromSeekTarget) <= CRUNCHYROLL_REMOTE_SEEK_GUARD_TOLERANCE_SECONDS;
      if (shouldHold) {
        logDebug("sync.applyHostState", "held during pending Crunchyroll seek", {
          pending,
          ageMs,
          isFreshSeekDispatch,
          state: playbackStateDebugSnapshot(state),
          driftFromSeekTarget,
          video: videoDebugSnapshot(adapter.video),
        });
      }

      return shouldHold;
    },
    [adapter],
  );

  const playWhenReady = useCallback(
    async (reason: string) => {
      const settling = isMediaSettling(adapter.video);
      if (settling && pendingPlayWaitRef.current) {
        logDebug("sync.remote", "play wait already pending", {
          reason,
          token: remotePlaybackTokenRef.current,
          video: videoDebugSnapshot(adapter.video),
        });
        return;
      }

      const token = ++remotePlaybackTokenRef.current;
      const playImmediately = shouldPlayWithoutWaitingForMediaReady(adapter.id);
      logDebug("sync.remote", "play requested when ready", {
        reason,
        token,
        playImmediately,
        settling,
        video: videoDebugSnapshot(adapter.video),
      });

      if (playImmediately) {
        if (!adapter.video.paused && !isMediaSettling(adapter.video)) {
          logDebug("sync.remote", "play skipped because video is already playing", {
            reason,
            token,
            readyReason: "immediate",
            video: videoDebugSnapshot(adapter.video),
          });
          return;
        }

        suppressLocalEventsUntilRef.current = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;
        logDebug("sync.remote", "play requested immediately", {
          reason,
          token,
          video: videoDebugSnapshot(adapter.video),
        });
        await adapter.play().catch((error) => {
          logDebug("sync.remote", "play failed", {
            reason,
            token,
            readyReason: "immediate",
            error: error instanceof Error ? error.message : String(error),
            video: videoDebugSnapshot(adapter.video),
          });
        });
        return;
      }

      if (settling) {
        pendingPlayWaitRef.current = true;
      }

      const readyReason = await waitForMediaReady(
        adapter.video,
        getRemotePlayReadyTimeoutMs(adapter.id),
      );
      if (token === remotePlaybackTokenRef.current) {
        pendingPlayWaitRef.current = false;
      }
      if (token !== remotePlaybackTokenRef.current) {
        logDebug("sync.remote", "play skipped after newer command", {
          reason,
          token,
          activeToken: remotePlaybackTokenRef.current,
          readyReason,
          video: videoDebugSnapshot(adapter.video),
        });
        return;
      }

      if (
        adapter.id === "crunchyroll" &&
        readyReason === "timeout" &&
        isMediaSettling(adapter.video)
      ) {
        logDebug("sync.remote", "play skipped because Crunchyroll media is still settling", {
          reason,
          token,
          readyReason,
          video: videoDebugSnapshot(adapter.video),
        });
        return;
      }

      if (!adapter.video.paused) {
        logDebug("sync.remote", "play skipped because video is already playing", {
          reason,
          token,
          readyReason,
          video: videoDebugSnapshot(adapter.video),
        });
        return;
      }

      suppressLocalEventsUntilRef.current = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;
      await adapter.play().catch((error) => {
        logDebug("sync.remote", "play failed", {
          reason,
          token,
          readyReason,
          error: error instanceof Error ? error.message : String(error),
          video: videoDebugSnapshot(adapter.video),
        });
      });
    },
    [adapter],
  );

  const isDuplicateRemoteCommand = useCallback(
    (type: "PLAY" | "PAUSE" | "SEEK", byUserId: string, mediaTime: number) => {
      const now = Date.now();
      const key = `${type}:${byUserId}:${Math.round(mediaTime * 4) / 4}`;
      const last = lastRemoteCommandRef.current;
      if (last?.key === key && now - last.receivedAt < REMOTE_COMMAND_DEDUPE_MS) {
        logDebug("sync.remote", "ignored duplicate command", {
          type,
          byUserId,
          mediaTime,
          previousReceivedAt: last.receivedAt,
          now,
        });
        return true;
      }

      lastRemoteCommandRef.current = { key, receivedAt: now };
      return false;
    },
    [],
  );

  const seekFromRemote = useCallback(
    (targetTime: number, reason: string) => {
      const now = Date.now();
      if (
        shouldThrottleRemoteSeekAttempt(
          adapter.id,
          lastRemoteSeekAttemptRef.current,
          targetTime,
          now,
        )
      ) {
        logDebug("sync.remote", "throttled duplicate seek attempt", {
          reason,
          targetTime,
          previousAttempt: lastRemoteSeekAttemptRef.current,
          now,
          video: videoDebugSnapshot(adapter.video),
        });
        return false;
      }

      lastRemoteSeekAttemptRef.current = { attemptedAt: now, targetTime };
      rememberPendingRemoteSeek(targetTime, reason);
      adapter.seek(targetTime, { resumeIfPlaying: false });
      return true;
    },
    [adapter, rememberPendingRemoteSeek],
  );

  const shouldHoldHostStateForPendingSourceNavigation = useCallback(
    (state: PlaybackState) => {
      const pending = pendingSourceNavigationRef.current;
      if (!pending || adapter.id !== "crunchyroll") {
        return false;
      }

      const ageMs = Date.now() - pending.startedAt;
      if (state.videoFingerprint !== pending.targetFingerprint) {
        return false;
      }

      if (ageMs > CRUNCHYROLL_SOURCE_NAVIGATION_GUARD_MS) {
        pendingSourceNavigationRef.current = null;
        logDebug("sync.source", "released stale source navigation guard", {
          pending,
          ageMs,
          state: playbackStateDebugSnapshot(state),
          video: videoDebugSnapshot(adapter.video),
        });
        return false;
      }

      const currentFingerprint = adapter.getFingerprint();
      const stillOnPreviousMedia =
        adapter.video === pending.previousVideo &&
        adapter.video.currentSrc === pending.previousCurrentSrc;
      const shouldHold =
        currentFingerprint !== pending.targetFingerprint ||
        stillOnPreviousMedia ||
        isMediaSettling(adapter.video);

      if (shouldHold) {
        suppressLocalEventsUntilRef.current = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;
        logDebug("sync.source", "held host state during Crunchyroll source navigation", {
          pending,
          ageMs,
          currentFingerprint,
          stillOnPreviousMedia,
          state: playbackStateDebugSnapshot(state),
          video: videoDebugSnapshot(adapter.video),
        });
        return true;
      }

      pendingSourceNavigationRef.current = null;
      logDebug("sync.source", "source navigation guard cleared", {
        pending,
        ageMs,
        currentFingerprint,
        state: playbackStateDebugSnapshot(state),
        video: videoDebugSnapshot(adapter.video),
      });
      return false;
    },
    [adapter],
  );

  const navigateToRemoteSourceIfNeeded = useCallback(
    (state: PlaybackState) => {
      if (state.videoFingerprint === adapter.getFingerprint()) {
        return false;
      }

      if (adapter.id !== "crunchyroll" || !state.sourceUrl) {
        return false;
      }

      const activeParticipantId = participantRef.current?.id ?? null;
      const activeRoomId =
        roomIdRef.current ??
        getRoomIdFromHash() ??
        (roomSessionNamespace
          ? getPersistedRoomIdForUser(roomSessionNamespace, activeParticipantId)
          : null);
      const target = buildSourceUrlWithRoom(state.sourceUrl, activeRoomId);
      if (!target || isSameDocumentTarget(target)) {
        return false;
      }

      if (activeRoomId && activeParticipantId && roomSessionNamespace) {
        persistRoomId(roomSessionNamespace, activeRoomId, activeParticipantId);
      }

      pendingSourceNavigationRef.current = {
        previousCurrentSrc: adapter.video.currentSrc,
        previousVideo: adapter.video,
        startedAt: Date.now(),
        targetFingerprint: state.videoFingerprint,
        targetUrl: target.toString(),
      };

      logDebug("sync.source", "navigate to host source", {
        received: state.videoFingerprint,
        local: adapter.getFingerprint(),
        target: target.toString(),
        roomId: activeRoomId,
      });
      void navigateCrunchyrollToRemoteSource(target, state);
      return true;
    },
    [adapter, roomSessionNamespace],
  );

  const applyRemotePlay = useCallback(
    (byUserId: string, at: number) => {
      if (isDuplicateRemoteCommand("PLAY", byUserId, at)) {
        return;
      }

      suppressLocalEventsUntilRef.current = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;
      const drift = adapter.getCurrentTime() - at;
      const settling = isMediaSettling(adapter.video);
      if (shouldSeekForRemoteCommand(drift, settling)) {
        seekFromRemote(at, "remote-play");
      } else if (Math.abs(drift) > 1.25) {
        logDebug("sync.remote", "deferred play seek because media is settling", {
          at,
          drift,
          video: videoDebugSnapshot(adapter.video),
        });
      }

      setCatchUp(null);
      void playWhenReady("remote-play");
    },
    [adapter, isDuplicateRemoteCommand, playWhenReady, seekFromRemote],
  );

  const applyRemotePause = useCallback(
    (byUserId: string, at: number) => {
      if (isDuplicateRemoteCommand("PAUSE", byUserId, at)) {
        return;
      }

      cancelPendingRemotePlayback("remote-pause");
      suppressLocalEventsUntilRef.current = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;
      adapter.pause();

      const drift = adapter.getCurrentTime() - at;
      const settling = isMediaSettling(adapter.video);
      if (shouldSeekForRemoteCommand(drift, settling)) {
        seekFromRemote(at, "remote-pause");
      } else if (Math.abs(drift) > 1.25) {
        logDebug("sync.remote", "deferred pause seek because media is settling", {
          at,
          drift,
          video: videoDebugSnapshot(adapter.video),
        });
      }

      setCatchUp(null);
    },
    [adapter, cancelPendingRemotePlayback, isDuplicateRemoteCommand, seekFromRemote],
  );

  const applyRemoteSeek = useCallback(
    (byUserId: string, to: number) => {
      if (isDuplicateRemoteCommand("SEEK", byUserId, to)) {
        return;
      }

      cancelPendingRemotePlayback("remote-seek");
      suppressLocalEventsUntilRef.current = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;

      const drift = adapter.getCurrentTime() - to;
      if (!isMediaSettling(adapter.video) || Math.abs(drift) > 2) {
        seekFromRemote(to, "remote-seek");
      } else {
        logDebug("sync.remote", "ignored seek while media is already settling near target", {
          to,
          drift,
          video: videoDebugSnapshot(adapter.video),
        });
      }

      setCatchUp(null);
    },
    [adapter, cancelPendingRemotePlayback, isDuplicateRemoteCommand, seekFromRemote],
  );

  const applyHostState = useCallback(
    async (state: PlaybackState) => {
      if (shouldHoldHostStateForPendingSourceNavigation(state)) {
        return;
      }

      if (state.videoFingerprint !== adapter.getFingerprint()) {
        if (navigateToRemoteSourceIfNeeded(state)) {
          return;
        }

        logDebug("sync.applyHostState", "ignored fingerprint mismatch", {
          received: state.videoFingerprint,
          local: adapter.getFingerprint(),
          state: playbackStateDebugSnapshot(state),
        });
        return;
      }

      const remoteState = normalizeRemotePlaybackState(state);
      const correction = getSyncCorrection(adapter.getCurrentTime(), remoteState);
      const settling = isMediaSettling(adapter.video);
      clearPendingRemoteSeekIfSettled("host-state");
      if (shouldHoldHostStateForPendingCrunchyrollSeek(remoteState)) {
        suppressLocalEventsUntilRef.current = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;
        if (settling && remoteState.playing && adapter.video.paused) {
          void playWhenReady("host-state-pending-crunchyroll-seek");
        }
        return;
      }

      const shouldSeek = shouldSeekForHostState(correction.action, settling);
      const shouldDeferSeek = shouldDeferHostStateSeek(correction.action, settling);
      const shouldChangePlayback =
        (remoteState.playing && adapter.video.paused) ||
        (!remoteState.playing && !adapter.video.paused);

      if (shouldSeek || shouldChangePlayback) {
        suppressLocalEventsUntilRef.current = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;
      }

      logDebug("sync.applyHostState", "decision", {
        state: playbackStateDebugSnapshot(remoteState),
        correction,
        settling,
        shouldSeek,
        shouldDeferSeek,
        shouldChangePlayback,
        suppressUntil: suppressLocalEventsUntilRef.current,
        video: videoDebugSnapshot(adapter.video),
      });

      if (shouldDeferSeek) {
        logDebug("sync.applyHostState", "deferred seek because media is settling", {
          expectedTime: correction.expectedTime,
          drift: correction.drift,
          video: videoDebugSnapshot(adapter.video),
        });
        if (
          remoteState.playing &&
          (adapter.video.paused || shouldPlayWithoutWaitingForMediaReady(adapter.id))
        ) {
          void playWhenReady("host-state-settling");
        }
        return;
      }

      let didSeek = false;
      if (shouldSeek) {
        didSeek = seekFromRemote(correction.expectedTime, "host-state");
      }

      if (correction.action === "catch-up" && !didSeek) {
        setCatchUp({ expectedTime: correction.expectedTime, drift: correction.drift });
      } else {
        setCatchUp(null);
      }

      if (remoteState.playing) {
        if (
          didSeek ||
          adapter.video.paused ||
          (settling && shouldPlayWithoutWaitingForMediaReady(adapter.id))
        ) {
          void playWhenReady("host-state");
        }
      } else {
        cancelPendingRemotePlayback("host-state-pause");
        if (!adapter.video.paused) {
          adapter.pause();
        }
      }
    },
    [
      adapter,
      cancelPendingRemotePlayback,
      navigateToRemoteSourceIfNeeded,
      shouldHoldHostStateForPendingSourceNavigation,
      playWhenReady,
      seekFromRemote,
      clearPendingRemoteSeekIfSettled,
      shouldHoldHostStateForPendingCrunchyrollSeek,
    ],
  );

  // Terminally end the local room session without a reconnect loop: used for
  // server-terminal errors (ROOM_FULL / SESSION_TAKEN_OVER) and for graceful
  // free-quota expiry, so the overlay settles on a clear message instead of
  // jittering between connect attempts.
  const terminateRoomSession = useCallback((message: string) => {
    roomReconnectSuppressedRef.current = true;
    if (roomReconnectTimerRef.current !== null) {
      window.clearTimeout(roomReconnectTimerRef.current);
      roomReconnectTimerRef.current = null;
    }
    clientRef.current.close();
    releaseRoomTabLock();
    setRoomId(null);
    setParticipants([]);
    roomTokenRef.current = null;
    roomShareableLinkRef.current = null;
    setRoomToken(null);
    setRoomShareableLink(null);
    setRoomCapabilities(null);
    clearLegacyRoomSessionStorage();
    if (roomSessionNamespace) {
      clearPersistedRoomId(roomSessionNamespace);
    }
    clearRoomHash();
    setAuthMessage(message);
    setPanelOpen(true);
  }, [roomSessionNamespace]);

  const handleServerEvent = useCallback(
    (event: ServerEvent) => {
      logDebug("overlay.server", event.type, {
        event: roomEventDebugSnapshot(event),
        localParticipantId: participantRef.current?.id,
        isHost: isCurrentHost(),
        video: videoDebugSnapshot(adapter.video),
      });

      switch (event.type) {
        case "ROOM_SNAPSHOT":
          setParticipants(event.participants);
          if (event.capabilities) {
            setRoomCapabilities(event.capabilities);
          }
          setRoomSnapshotReady(true);
          if (event.hostState && !isCurrentHost(event.participants)) {
            void applyHostState(event.hostState);
          }
          return;
        case "PARTICIPANT_JOINED":
          setParticipants((current) => [
            ...current.filter((item) => item.id !== event.participant.id),
            event.participant,
          ]);
          return;
        case "PARTICIPANT_LEFT":
          setParticipants((current) => current.filter((item) => item.id !== event.participant.id));
          return;
        case "HOST_STATE":
          if (!isCurrentHost()) {
            void applyHostState(event.state);
          }
          return;
        case "PLAY":
          if (event.byUserId !== participantRef.current?.id) {
            applyRemotePlay(event.byUserId, event.at);
          }
          return;
        case "PAUSE":
          if (event.byUserId !== participantRef.current?.id) {
            applyRemotePause(event.byUserId, event.at);
          }
          return;
        case "SEEK":
          if (event.byUserId !== participantRef.current?.id) {
            applyRemoteSeek(event.byUserId, event.to);
          }
          return;
        case "P2P_SIGNAL": {
          if (
            event.toUserId !== participantRef.current?.id ||
            event.fromUserId === participantRef.current?.id
          ) {
            return;
          }

          if (event.serverSeq !== undefined) {
            lastSeenP2PServerSeqRef.current = Math.max(
              lastSeenP2PServerSeqRef.current,
              event.serverSeq,
            );
          }

          const dedupeKey = getIncomingP2PSignalDedupeKey(event);
          if (handledP2PSignalIdsRef.current.has(dedupeKey)) {
            logDebug("p2p.signal", "drop duplicate", {
              clientSignalId: event.clientSignalId,
              fromUserId: event.fromUserId,
              senderConnectionId: event.senderConnectionId,
              serverSeq: event.serverSeq,
            });
            return;
          }

          handledP2PSignalIdsRef.current.add(dedupeKey);
          // Bound the dedupe set so a long session can't grow it without limit
          // (it is otherwise cleared only when the room changes). Insertion
          // order is preserved, so dropping the oldest keys is safe — anything
          // that old is far beyond the 120-deep replay window below.
          pruneHandledP2PSignalIds(handledP2PSignalIdsRef.current);
          setIncomingP2PSignals((current) =>
            [
              ...current,
              toIncomingP2PSignal(event, ++p2pSignalSequenceRef.current),
            ].slice(-120),
          );
          return;
        }
        case "REACTION":
          if (!reactionsEnabled) {
            return;
          }
          if (
            event.reaction.effect === FIRE_SUPER_EFFECT ||
            event.reaction.emoji === FIRE_SUPER_REACTION_MARKER
          ) {
            if (experimentalSuperReactionsEnabled) {
              triggerFlameBurst(event.reaction.userId);
            }
            return;
          }
          if (event.reaction.text) {
            recordChatHistoryMessage(event.reaction);
            if (messageDisplayMode === "chat") {
              if (chatDisplayMode === "live") {
                enqueueLiveChatMessage(event.reaction);
              }
              return;
            }
          }
          setReactions((current) => [...current, event.reaction]);
          window.setTimeout(() => {
            setReactions((current) => current.filter((item) => item.id !== event.reaction.id));
          }, 2800);
          return;
        case "ERROR":
          console.warn("[Anidachi] Room error", event.code, event.message);
          if (event.code === "MEDIA_SEATS_FULL") {
            setCamsEnabled(false);
            setAuthMessage(event.message || "No live media seats are available in this room.");
            setPanelOpen(true);
            return;
          }
          if (event.code === "ROOM_FULL" || event.code === "SESSION_TAKEN_OVER") {
            // Terminal: stop reconnecting (the server closes the socket right
            // after this event) and surface the reason instead of looping.
            // SESSION_TAKEN_OVER also prevents a reconnect ping-pong between
            // two tabs/devices of the same user (one active session).
            const fallback =
              event.code === "ROOM_FULL"
                ? "This watch room is full (max 4 people)."
                : "This room was opened in another tab or device.";
            terminateRoomSession(event.message || fallback);
          }
          return;
      }
    },
    [
      adapter.video,
      applyHostState,
      applyRemotePause,
      applyRemotePlay,
      applyRemoteSeek,
      isCurrentHost,
      chatDisplayMode,
      enqueueLiveChatMessage,
      experimentalSuperReactionsEnabled,
      messageDisplayMode,
      recordChatHistoryMessage,
      reactionsEnabled,
      terminateRoomSession,
      triggerFlameBurst,
    ],
  );

  useEffect(() => {
    handleServerEventRef.current = handleServerEvent;
  }, [handleServerEvent]);

  const connectToRoomAsParticipant = useCallback(
    (nextRoomId: string, activeParticipant: Participant, nextRoomToken: string) => {
      roomReconnectSuppressedRef.current = false;
      if (roomReconnectTimerRef.current !== null) {
        window.clearTimeout(roomReconnectTimerRef.current);
        roomReconnectTimerRef.current = null;
      }

      const sameRoomReconnect = roomIdRef.current === nextRoomId;
      if (!sameRoomReconnect) {
        handledP2PSignalIdsRef.current.clear();
        lastSeenP2PServerSeqRef.current = 0;
        p2pSignalSequenceRef.current = 0;
        setIncomingP2PSignals([]);
      }

      setRoomSnapshotReady(false);
      setRoomId(nextRoomId);
      if (roomSessionNamespace) {
        persistRoomId(roomSessionNamespace, nextRoomId, activeParticipant.id);
      }
      ensureRoomHash(nextRoomId);
      logDebug("overlay.room", "connect requested", {
        roomId: nextRoomId,
        authenticated: true,
        participantId: activeParticipant.id,
        fingerprint: adapter.getFingerprint(),
        video: videoDebugSnapshot(adapter.video),
      });
      clientRef.current.connect({
        lastSeenP2PServerSeq: sameRoomReconnect ? lastSeenP2PServerSeqRef.current : 0,
        participantSessionId: getParticipantSessionId(roomSessionNamespace),
        roomId: nextRoomId,
        roomToken: nextRoomToken,
        participant: activeParticipant,
        videoFingerprint: adapter.getFingerprint(),
        onEvent: (event) => handleServerEventRef.current(event),
        onStatus: setRoomStatus,
      });
    },
    [adapter, roomSessionNamespace, setRoomStatus],
  );

  const connectToExistingWebsiteRoom = useCallback(
    async (nextRoomId: string, reason: string) => {
      const refreshed = await refreshRoomActionIdentity(`join:${reason}`);
      const activeParticipant = refreshed.participant;
      const activeAccessToken = refreshed.accessToken;
      if (!activeParticipant || !activeAccessToken) {
        setPanelOpen(true);
        setAuthMessage("Sign in to join Anidachi rooms.");
        logDebug("overlay.room", "join skipped without auth", {
          reason,
          roomId: nextRoomId,
          hasParticipant: Boolean(activeParticipant),
          hasAccessToken: Boolean(activeAccessToken),
        });
        return;
      }

      // One active tab per browser (Block 4.3): a second tab can't take the
      // room; a reconnect of the owning tab re-acquires instantly.
      if (!(await acquireRoomTabLock())) {
        setPanelOpen(true);
        setAuthMessage("This room is already open in another tab.");
        logDebug("overlay.room", "join blocked by tab lock", { roomId: nextRoomId, reason });
        return;
      }

      let connected: Awaited<ReturnType<typeof connectWebsiteRoom>>;
      try {
        connected = await connectWebsiteRoom(nextRoomId, activeAccessToken);
      } catch (error) {
        releaseRoomTabLock();
        throw error;
      }
      roomTokenRef.current = connected.roomToken;
      setRoomToken(connected.roomToken);
      setRoomCapabilities(connected.capabilities ?? null);
      setRoomQuota(connected.quota ?? null);
      const shareableLink = new URL(`/room/${encodeURIComponent(nextRoomId)}`, WEB_HTTP_BASE)
        .toString();
      roomShareableLinkRef.current = shareableLink;
      setRoomShareableLink(shareableLink);
      connectToRoomAsParticipant(nextRoomId, activeParticipant, connected.roomToken);
    },
    [connectToRoomAsParticipant, refreshRoomActionIdentity],
  );

  const clearRoomReconnectTimer = useCallback(() => {
    if (roomReconnectTimerRef.current === null) {
      return;
    }

    window.clearTimeout(roomReconnectTimerRef.current);
    roomReconnectTimerRef.current = null;
  }, []);

  const scheduleRoomReconnect = useCallback(
    (reason: string) => {
      if (roomReconnectSuppressedRef.current || roomReconnectTimerRef.current !== null) {
        return;
      }

      const activeRoomId = roomIdRef.current;
      if (
        !activeRoomId ||
        !participantRef.current ||
        !authAccessTokenRef.current ||
        statusRef.current === "connected" ||
        statusRef.current === "connecting"
      ) {
        return;
      }

      const attempt = Math.min(roomReconnectAttemptRef.current + 1, 8);
      roomReconnectAttemptRef.current = attempt;
      const delayMs = getRoomReconnectDelayMs(attempt);
      logDebug("overlay.room", "auto reconnect scheduled", {
        attempt,
        delayMs,
        reason,
        roomId: activeRoomId,
        status: statusRef.current,
      });

      roomReconnectTimerRef.current = window.setTimeout(() => {
        roomReconnectTimerRef.current = null;

        if (roomReconnectInFlightRef.current) {
          scheduleRoomReconnect(`${reason}:busy`);
          return;
        }

        const reconnectRoomId = roomIdRef.current;
        if (
          roomReconnectSuppressedRef.current ||
          !reconnectRoomId ||
          statusRef.current === "connected" ||
          statusRef.current === "connecting"
        ) {
          return;
        }

        roomReconnectInFlightRef.current = true;
        logDebug("overlay.room", "auto reconnect start", {
          attempt,
          reason,
          roomId: reconnectRoomId,
          lastSeenP2PServerSeq: lastSeenP2PServerSeqRef.current,
        });

        void connectToExistingWebsiteRoom(reconnectRoomId, `auto:${reason}`)
          .then(() => {
            roomReconnectAttemptRef.current = 0;
          })
          .catch((error) => {
            // Free quota ran out — the server will keep rejecting reconnects, so
            // end gracefully instead of looping (which made the panel jitter).
            if (isQuotaExhaustedError(error)) {
              logDebug("overlay.room", "auto reconnect blocked by quota", {
                attempt,
                reason,
                roomId: reconnectRoomId,
                resetAt: error.resetAt,
              });
              terminateRoomSession(quotaExhaustedMessage(error.resetAt));
              return;
            }

            if (isTerminalRoomJoinError(error)) {
              logDebug("overlay.room", "auto reconnect terminally rejected", {
                attempt,
                reason,
                roomId: reconnectRoomId,
                status: error.status,
                code: error.code,
              });
              terminateRoomSession(roomJoinUnavailableMessage(error));
              return;
            }

            const message = error instanceof Error ? error.message : "Room reconnect failed";
            logDebug("overlay.room", "auto reconnect failed", {
              attempt,
              message,
              reason,
              roomId: reconnectRoomId,
            });
            if (!roomReconnectSuppressedRef.current) {
              setAuthMessage("Connection lost. Reconnecting...");
              scheduleRoomReconnect(`${reason}:retry`);
            }
          })
          .finally(() => {
            roomReconnectInFlightRef.current = false;
          });
      }, delayMs);
    },
    [connectToExistingWebsiteRoom, terminateRoomSession],
  );

  useEffect(() => {
    if (status === "closed" || status === "error") {
      scheduleRoomReconnect(status);
    }
  }, [scheduleRoomReconnect, status]);

  useEffect(() => {
    function handleOnline(): void {
      scheduleRoomReconnect("online");
    }

    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        scheduleRoomReconnect("visible");
      }
    }

    // The page is unloading or being frozen into the back/forward cache. Close
    // the socket so the Worker removes this participant promptly (no ghost
    // lingering until the keepalive pong-timeout) instead of relying on the
    // browser to tear the socket down. A real navigation discards the page; a
    // bfcache freeze resumes via pageshow/visibility below.
    function handlePageHide(): void {
      if (roomIdRef.current) {
        clientRef.current.close();
      }
    }

    // Restored from the back/forward cache: the overlay state survived but the
    // socket did not — reconnect to the room.
    function handlePageShow(event: PageTransitionEvent): void {
      if (event.persisted && roomIdRef.current) {
        scheduleRoomReconnect("pageshow");
      }
    }

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [scheduleRoomReconnect]);

  useEffect(() => {
    return () => {
      roomReconnectSuppressedRef.current = true;
      clearRoomReconnectTimer();
    };
  }, [clearRoomReconnectTimer]);

  // Each fresh server quota snapshot is the source of truth — reset the locally
  // metered elapsed time so the live countdown re-anchors to it.
  useEffect(() => {
    quotaMeteredMsRef.current = 0;
    quotaTickAtRef.current = null;
    quotaEndTriggeredRef.current = false;
    setQuotaDisplayTick((tick) => tick + 1);
  }, [roomQuota]);

  // Live quota countdown: accrue metered wall-clock only while the session is
  // actually burning quota, so the displayed time decreases every second
  // instead of only refreshing on reconnect/reload.
  useEffect(() => {
    if (!quotaMeteringActive) {
      quotaTickAtRef.current = null;
      return;
    }

    quotaTickAtRef.current = Date.now();
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const last = quotaTickAtRef.current ?? now;
      quotaMeteredMsRef.current += now - last;
      quotaTickAtRef.current = now;
      setQuotaDisplayTick((tick) => tick + 1);
    }, 1000);

    return () => {
      const now = Date.now();
      const last = quotaTickAtRef.current;
      if (last !== null) {
        quotaMeteredMsRef.current += now - last;
      }
      quotaTickAtRef.current = null;
      window.clearInterval(intervalId);
    };
  }, [quotaMeteringActive]);

  // When the metered host's free time hits zero, end the session gracefully
  // (once) rather than letting the room token expire into a reconnect loop.
  useEffect(() => {
    if (!quotaMeteringActive || quotaRemainingSeconds === null || quotaRemainingSeconds > 0) {
      return;
    }
    if (quotaEndTriggeredRef.current) {
      return;
    }

    quotaEndTriggeredRef.current = true;
    logDebug("overlay.room", "free host quota exhausted; ending session", {
      resetAt: roomQuota?.resetAt ?? null,
    });
    terminateRoomSession(quotaExhaustedMessage(roomQuota?.resetAt));
  }, [quotaMeteringActive, quotaRemainingSeconds, roomQuota, terminateRoomSession]);

  const applyParticipantIdentity = useCallback(
    (result: CurrentParticipantResult, reason: string, reconnectActiveRoom: boolean) => {
      const activeRoomId = roomIdRef.current;
      syncAuthUserScopedState(result.tokens?.user.id ?? null, reason);
      authAccessTokenRef.current = result.tokens?.accessToken ?? null;
      participantRef.current = result.participant;
      setParticipant(result.participant);
      setAuthAuthenticated(result.authenticated);
      setAuthAccessToken(result.tokens?.accessToken ?? null);
      setExtensionContextInvalidated(Boolean(result.requiresPageReload));
      setAuthMessage(result.message ?? null);
      if (result.authenticated) {
        roomReconnectSuppressedRef.current = false;
      } else {
        roomReconnectSuppressedRef.current = true;
        clearRoomReconnectTimer();
        roomTokenRef.current = null;
        roomShareableLinkRef.current = null;
        setRoomToken(null);
        setRoomShareableLink(null);
        setRoomCapabilities(null);
      }
      logDebug("identity", "participant ready", {
        reason,
        authenticated: result.authenticated,
        requiresPageReload: Boolean(result.requiresPageReload),
        participantId: result.participant?.id ?? null,
        displayName: result.participant?.displayName ?? null,
      });

      if (reconnectActiveRoom && activeRoomId && result.participant) {
        scheduleRoomReconnect(`identity:${reason}`);
      }
    },
    [clearRoomReconnectTimer, scheduleRoomReconnect, syncAuthUserScopedState],
  );

  const handleSignIn = useCallback(async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    suppressSilentSignInUntilRef.current = 0;
    try {
      applyParticipantIdentity(await signInAndCreateParticipant(), "sign-in", true);
    } catch (error) {
      setExtensionContextInvalidated(isExtensionContextInvalidatedError(error));
      setAuthMessage(authErrorMessage(error, "Sign in failed"));
    } finally {
      setAuthBusy(false);
    }
  }, [applyParticipantIdentity]);

  const handleSignOut = useCallback(async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    suppressSilentSignInUntilRef.current =
      Date.now() + SILENT_SIGN_IN_SUPPRESSION_AFTER_SIGN_OUT_MS;
    try {
      roomReconnectSuppressedRef.current = true;
      clearRoomReconnectTimer();
      applyParticipantIdentity(await signOutAndClearParticipant(), "sign-out", false);
      clientRef.current.close();
      releaseRoomTabLock();
      setRoomId(null);
      setParticipants([]);
      setRoomQuota(null);
      setRoomCapabilities(null);
    } catch (error) {
      setExtensionContextInvalidated(isExtensionContextInvalidatedError(error));
      setAuthMessage(authErrorMessage(error, "Sign out failed"));
    } finally {
      setAuthBusy(false);
    }
  }, [applyParticipantIdentity, clearRoomReconnectTimer]);

  useEffect(() => {
    applyParticipantIdentityRef.current = applyParticipantIdentity;
  }, [applyParticipantIdentity]);

  useEffect(() => {
    let sequence = 0;
    let disposed = false;

    const refreshIdentityFromStorage = (reason: string) => {
      const currentSequence = ++sequence;
      void createCurrentParticipant().then((result) => {
        if (disposed || currentSequence !== sequence) {
          return;
        }

        applyParticipantIdentityRef.current(result, reason, true);
        setIdentityLoaded(true);
      });
    };

    const unwatch = storage.watch(AUTH_TOKENS_KEY, () => {
      refreshIdentityFromStorage("auth-storage");
    });
    const handleRawAuthStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[AUTH_TOKENS_STORAGE_KEY]) {
        return;
      }

      refreshIdentityFromStorage("auth-storage-raw");
    };
    const refreshFocusedIdentity = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      refreshIdentityFromStorage("window-focus");
    };
    const refreshVisibleIdentity = () => {
      if (document.visibilityState === "visible") {
        refreshIdentityFromStorage("visibility");
      }
    };
    chrome.storage?.onChanged?.addListener(handleRawAuthStorageChange);
    window.addEventListener("focus", refreshFocusedIdentity);
    document.addEventListener("visibilitychange", refreshVisibleIdentity);
    return () => {
      disposed = true;
      chrome.storage?.onChanged?.removeListener(handleRawAuthStorageChange);
      window.removeEventListener("focus", refreshFocusedIdentity);
      document.removeEventListener("visibilitychange", refreshVisibleIdentity);
      unwatch();
    };
  }, []);

  useEffect(() => {
    if (!panelOpen || !identityLoaded) {
      return;
    }

    let cancelled = false;
    void createCurrentParticipant().then(async (result) => {
      if (cancelled) {
        return;
      }

      applyParticipantIdentityRef.current(result, "panel-open", true);
      if (result.authenticated || result.requiresPageReload) {
        return;
      }
      if (Date.now() < suppressSilentSignInUntilRef.current) {
        logDebug("identity", "panel-open silent sign-in suppressed after explicit sign-out", {
          retryAfterMs: suppressSilentSignInUntilRef.current - Date.now(),
        });
        return;
      }

      const silent = await trySilentSignIn();
      if (cancelled || !silent?.authenticated) {
        return;
      }

      applyParticipantIdentityRef.current(silent, "panel-open-silent-sign-in", true);
    });

    return () => {
      cancelled = true;
    };
  }, [identityLoaded, panelOpen]);

  const createAndConnectRoom = useCallback(
    async (reason: string) => {
      const refreshed = await refreshRoomActionIdentity(`create:${reason}`);
      const activeParticipant = refreshed.participant;
      const activeAccessToken = refreshed.accessToken;
      if (!activeParticipant || !activeAccessToken) {
        setPanelOpen(true);
        setAuthMessage("Sign in to create Anidachi rooms.");
        logDebug("overlay.room", "create skipped without participant", { reason });
        return null;
      }

      // One active tab per browser (Block 4.3): don't open a second room from
      // another tab while one is already active here.
      if (!(await acquireRoomTabLock())) {
        setPanelOpen(true);
        setAuthMessage("A watch room is already open in another tab.");
        logDebug("overlay.room", "create blocked by tab lock", { reason });
        return null;
      }

      // Idempotency key survives retries of the same create attempt and is
      // cleared only on success, so a network retry reuses the same room.
      createRequestIdRef.current ??= crypto.randomUUID();
      let created: Awaited<ReturnType<typeof createRoom>>;
      try {
        created = await createRoom(activeAccessToken, {
          sourceUrl: buildCurrentSourceUrlForInvite(),
          videoFingerprint: adapter.getFingerprint(),
          title: adapter.getTitle() ?? document.title,
          clientRequestId: createRequestIdRef.current,
        });
      } catch (error) {
        releaseRoomTabLock();
        throw error;
      }
      createRequestIdRef.current = null;
      setRoomQuota(created.quota ?? null);
      setRoomCapabilities(created.capabilities ?? null);
      if (roomIdRef.current) {
        return null;
      }

      const nextRoomToken = created.roomToken;
      const nextShareableLink = created.shareableLink;
      roomTokenRef.current = nextRoomToken;
      roomShareableLinkRef.current = nextShareableLink;
      setRoomToken(nextRoomToken);
      setRoomShareableLink(nextShareableLink);
      logDebug("overlay.room", "created", {
        reason,
        roomId: created.roomId,
        reused: created.reused === true,
        authenticated: true,
        participantId: activeParticipant.id,
      });
      setRoomHash(created.roomId);
      connectToRoomAsParticipant(created.roomId, activeParticipant, nextRoomToken);
      return created;
    },
    [adapter, connectToRoomAsParticipant, refreshRoomActionIdentity],
  );

  useEffect(() => {
    let cancelled = false;
    void createCurrentParticipant({ fast: true }).then(async (result) => {
      if (cancelled) {
        return;
      }

      applyParticipantIdentityRef.current(result, "initial-load", false);
      setIdentityLoaded(true);

      // The guest may have just signed in on the website (cookie session) — for
      // example after opening a shared room link — without ever connecting the
      // extension. Pick that session up silently so the overlay reflects the
      // account (and auto-joins a pending invite) without a manual "Sign in"
      // click or a page reload.
      if (result.authenticated || result.requiresPageReload) {
        return;
      }
      if (Date.now() < suppressSilentSignInUntilRef.current) {
        logDebug("identity", "initial silent sign-in suppressed after explicit sign-out", {
          retryAfterMs: suppressSilentSignInUntilRef.current - Date.now(),
        });
        return;
      }

      const silent = await trySilentSignIn();
      if (cancelled || !silent?.authenticated) {
        return;
      }

      logDebug("identity", "silent website session adopted", {
        participantId: silent.participant?.id ?? null,
      });
      applyParticipantIdentityRef.current(silent, "silent-sign-in", true);
      setIdentityLoaded(true);
    });
    return () => {
      cancelled = true;
      clientRef.current.close();
      releaseRoomTabLock();
    };
  }, []);

  useEffect(() => {
    if (!identityLoaded || !roomSessionNamespace || roomId) {
      return;
    }

    const hashRoomId = getRoomIdFromHash();
    const persistedRoomId = getPersistedRoomIdForUser(
      roomSessionNamespace,
      participant?.id ?? null,
    );
    const initialRoomId = hashRoomId ?? persistedRoomId;
    if (initialRoomId) {
      if (!participant) {
        setAuthMessage("Sign in to join Anidachi rooms.");
        setPanelOpen(true);
        return;
      }

      void connectToExistingWebsiteRoom(initialRoomId, hashRoomId ? "hash" : "persisted").catch(
        (error) => {
          // Quota is exhausted — drop the stale room pointer so reloads stop
          // re-attempting a join that can only fail, and show why.
          if (isQuotaExhaustedError(error)) {
            logDebug("overlay.room", "initial join blocked by quota", {
              roomId: initialRoomId,
              resetAt: error.resetAt,
            });
            clearLegacyRoomSessionStorage();
            clearPersistedRoomId(roomSessionNamespace);
            clearRoomHash();
            setAuthMessage(quotaExhaustedMessage(error.resetAt));
            setPanelOpen(true);
            return;
          }

          if (isTerminalRoomJoinError(error)) {
            logDebug("overlay.room", "initial join terminally rejected", {
              roomId: initialRoomId,
              status: error.status,
              code: error.code,
            });
            clearLegacyRoomSessionStorage();
            clearPersistedRoomId(roomSessionNamespace);
            clearRoomHash();
            releaseRoomTabLock();
            setAuthMessage(roomJoinUnavailableMessage(error));
            setPanelOpen(true);
            return;
          }

          const message = error instanceof Error ? error.message : "Failed to join room";
          logDebug("overlay.room", "initial join failed", { roomId: initialRoomId, message });
          setAuthMessage(message);
          setPanelOpen(true);
        },
      );
      setPanelOpen(shouldOpenPanelForInitialRoom(hashRoomId, persistedRoomId));
    }
  }, [connectToExistingWebsiteRoom, identityLoaded, participant, roomId, roomSessionNamespace]);

  useEffect(() => {
    if (!participant || !roomSessionNamespace || consumedLaunchIntentRef.current) {
      return;
    }

    const intent = consumeAnidachiLaunchIntent();
    if (!intent) {
      return;
    }

    consumedLaunchIntentRef.current = true;
    setPanelOpen(true);
    logDebug("overlay.launch", "consumed launch intent", {
      autoCreateRoom: intent.autoCreateRoom,
      source: intent.source,
      video: videoDebugSnapshot(adapter.video),
    });

    const activeRoomId =
      roomIdRef.current ??
      getRoomIdFromHash() ??
      getPersistedRoomIdForUser(roomSessionNamespace, participant.id);
    if (!intent.autoCreateRoom || activeRoomId) {
      return;
    }

    void createAndConnectRoom("launch-intent").catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to create room";
      logDebug("overlay.room", "launch create failed", { message });
      setAuthMessage(message);
    });
  }, [adapter.video, createAndConnectRoom, participant, roomSessionNamespace]);

  const sendHostState = useCallback(
    (allowController = false, stateOverride?: Partial<PlaybackState>) => {
      const activeRoomId = roomIdRef.current;
      if (!activeRoomId || (!isCurrentHost() && !allowController)) {
        logDebug("sync.hostState", "skipped", {
          hasRoom: Boolean(activeRoomId),
          isCurrentHost: isCurrentHost(),
          allowController,
          participantId: participantRef.current?.id,
        });
        return;
      }

      if (!allowController && Date.now() < suppressLocalEventsUntilRef.current) {
        logDebug("sync.hostState", "skipped during remote suppression", {
          suppressUntil: suppressLocalEventsUntilRef.current,
          now: Date.now(),
          video: videoDebugSnapshot(adapter.video),
        });
        return;
      }

      if (!allowController && isMediaSettling(adapter.video)) {
        logDebug("sync.hostState", "skipped while media is settling", {
          video: videoDebugSnapshot(adapter.video),
        });
        return;
      }

      const state = stateOverride
        ? {
            ...adapter.getState(),
            ...stateOverride,
          }
        : adapter.getState();
      logDebug("sync.hostState", "send", {
        roomId: activeRoomId,
        allowController,
        state: playbackStateDebugSnapshot(state),
      });
      clientRef.current.send({
        type: "HOST_STATE",
        roomId: activeRoomId,
        state,
      });
    },
    [adapter, isCurrentHost],
  );

  const sendLocalControlEvent = useCallback(
    (event: PlayerEvent, stateOverride?: Partial<PlaybackState>) => {
      const activeRoomId = roomIdRef.current;
      const activeParticipant = participantRef.current;
      if (!activeRoomId || !activeParticipant) {
        logDebug("adapter.event", "control send skipped without room", {
          event,
          hasRoom: Boolean(activeRoomId),
          hasParticipant: Boolean(activeParticipant),
          video: videoDebugSnapshot(adapter.video),
        });
        return false;
      }

      if (event.type === "play") {
        clientRef.current.send({
          type: "PLAY",
          roomId: activeRoomId,
          byUserId: activeParticipant.id,
          at: event.time,
        });
      } else if (event.type === "pause") {
        clientRef.current.send({
          type: "PAUSE",
          roomId: activeRoomId,
          byUserId: activeParticipant.id,
          at: event.time,
        });
      } else if (event.type === "seek") {
        clientRef.current.send({
          type: "SEEK",
          roomId: activeRoomId,
          byUserId: activeParticipant.id,
          to: event.time,
        });
      } else {
        return false;
      }

      sendHostState(true, stateOverride);
      return true;
    },
    [adapter.video, sendHostState],
  );

  const flushPendingCrunchyrollLocalSeek = useCallback(
    (reason: string) => {
      const pending = pendingLocalSeekBroadcastRef.current;
      if (!pending) {
        return false;
      }

      window.clearTimeout(pending.timeoutId);
      pendingLocalSeekBroadcastRef.current = null;

      const now = Date.now();
      const previous = lastLocalSeekBroadcastRef.current;
      if (
        previous &&
        now - previous.sentAt < CRUNCHYROLL_LOCAL_SEEK_DUPLICATE_MS &&
        Math.abs(previous.targetTime - pending.targetTime) <=
          CRUNCHYROLL_LOCAL_SEEK_TOLERANCE_SECONDS
      ) {
        logDebug("adapter.event", "ignored duplicate Crunchyroll local seek broadcast", {
          reason,
          pending,
          previous,
          video: videoDebugSnapshot(adapter.video),
        });
        return false;
      }

      lastLocalSeekBroadcastRef.current = { sentAt: now, targetTime: pending.targetTime };
      const currentTime = adapter.getCurrentTime();
      const hostTime =
        Number.isFinite(currentTime) &&
        Math.abs(currentTime - pending.targetTime) <= CRUNCHYROLL_LOCAL_SEEK_TOLERANCE_SECONDS
          ? currentTime
          : pending.targetTime;
      const playing = !adapter.video.paused;

      logDebug("adapter.event", "flush Crunchyroll local seek broadcast", {
        reason,
        pending,
        hostTime,
        playing,
        video: videoDebugSnapshot(adapter.video),
      });

      return sendLocalControlEvent(
        { type: "seek", time: pending.targetTime },
        {
          hostTime,
          playing,
          updatedAt: now,
        },
      );
    },
    [adapter, sendLocalControlEvent],
  );

  const queueCrunchyrollLocalSeekBroadcast = useCallback(
    (targetTime: number, reason: string) => {
      const now = Date.now();
      lastLocalSeekEventAtRef.current = now;

      const previous = pendingLocalSeekBroadcastRef.current;
      if (previous) {
        window.clearTimeout(previous.timeoutId);
      }

      const delay = isMediaSettling(adapter.video)
        ? CRUNCHYROLL_LOCAL_SEEK_SETTLING_DELAY_MS
        : CRUNCHYROLL_LOCAL_SEEK_READY_DELAY_MS;
      const timeoutId = window.setTimeout(() => {
        flushPendingCrunchyrollLocalSeek("timer");
      }, delay);

      pendingLocalSeekBroadcastRef.current = {
        queuedAt: now,
        targetTime,
        timeoutId,
      };

      logDebug("adapter.event", "queue Crunchyroll local seek broadcast", {
        reason,
        delay,
        targetTime,
        video: videoDebugSnapshot(adapter.video),
      });
    },
    [adapter.video, flushPendingCrunchyrollLocalSeek],
  );

  useEffect(() => {
    return () => {
      const pending = pendingLocalSeekBroadcastRef.current;
      if (pending) {
        window.clearTimeout(pending.timeoutId);
        pendingLocalSeekBroadcastRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = adapter.subscribe((event) => {
      if (Date.now() < suppressLocalEventsUntilRef.current) {
        logDebug("adapter.event", "suppressed local event", {
          event,
          suppressUntil: suppressLocalEventsUntilRef.current,
          now: Date.now(),
          video: videoDebugSnapshot(adapter.video),
        });
        return;
      }

      if (event.type === "timeupdate" && adapter.video.paused) {
        logDebug("adapter.event", "ignored paused timeupdate", {
          event,
          video: videoDebugSnapshot(adapter.video),
        });
        return;
      }

      logDebug("adapter.event", "local event", {
        event,
        roomId: roomIdRef.current,
        participantId: participantRef.current?.id,
        video: videoDebugSnapshot(adapter.video),
      });

      if (adapter.id === "crunchyroll" && event.type === "seek") {
        queueCrunchyrollLocalSeekBroadcast(event.time, "adapter-seek");
        return;
      }

      if (adapter.id === "crunchyroll" && (event.type === "play" || event.type === "pause")) {
        const now = Date.now();
        const pendingSeek = Boolean(pendingLocalSeekBroadcastRef.current);
        const mediaSettling = isMediaSettling(adapter.video);
        const nearSeek =
          now - lastLocalSeekEventAtRef.current <
          CRUNCHYROLL_LOCAL_PLAYBACK_SUPPRESSION_AFTER_SEEK_MS;
        if (pendingSeek || mediaSettling || nearSeek) {
          logDebug("adapter.event", "coalesced Crunchyroll playback event during seek", {
            event,
            pendingSeek,
            mediaSettling,
            nearSeek,
            lastLocalSeekEventAt: lastLocalSeekEventAtRef.current,
            video: videoDebugSnapshot(adapter.video),
          });
          return;
        }
      }

      sendLocalControlEvent(event);
    });

    return unsubscribe;
  }, [adapter, queueCrunchyrollLocalSeekBroadcast, sendLocalControlEvent]);

  useEffect(() => {
    if (!isHost || !roomId) {
      return;
    }

    const id = window.setInterval(sendHostState, 1500);
    return () => window.clearInterval(id);
  }, [isHost, roomId, sendHostState]);

  const handleCreateRoom = async () => {
    if (extensionContextInvalidated) {
      setAuthMessage(EXTENSION_CONTEXT_INVALIDATED_MESSAGE);
      return;
    }

    if (!participant) {
      logDebug("overlay.room", "create skipped without participant");
      return;
    }

    try {
      await createAndConnectRoom("manual");
    } catch (error) {
      if (isQuotaExhaustedError(error)) {
        logDebug("overlay.room", "create blocked by quota", { resetAt: error.resetAt });
        setAuthMessage(quotaExhaustedMessage(error.resetAt));
        return;
      }

      const message = authErrorMessage(error, "Failed to create room");
      logDebug("overlay.room", "manual create failed", { message });
      setExtensionContextInvalidated(isExtensionContextInvalidatedError(error));
      setAuthMessage(message);
    }
  };

  const handleEndRoom = async () => {
    const activeRoomId = roomIdRef.current;
    const accessToken = await getFreshAuthAccessToken("end-room");
    if (!activeRoomId || !isHost || !accessToken) {
      return;
    }

    try {
      roomReconnectSuppressedRef.current = true;
      clearRoomReconnectTimer();
      await endRoom(activeRoomId, accessToken);
      clientRef.current.close();
      releaseRoomTabLock();
      setRoomId(null);
      setParticipants([]);
      setRoomQuota(null);
      setRoomCapabilities(null);
      roomTokenRef.current = null;
      roomShareableLinkRef.current = null;
      setRoomToken(null);
      setRoomShareableLink(null);
      clearLegacyRoomSessionStorage();
      if (roomSessionNamespace) {
        clearPersistedRoomId(roomSessionNamespace);
      }
      clearRoomHash();
      setAuthMessage("Watch room ended.");
      logDebug("overlay.room", "ended by host", { roomId: activeRoomId });
    } catch (error) {
      roomReconnectSuppressedRef.current = false;
      const message = error instanceof Error ? error.message : "Failed to end room";
      logDebug("overlay.room", "end failed", { roomId: activeRoomId, message });
      setAuthMessage(message);
    }
  };

  const reloadPage = useCallback(() => {
    window.location.reload();
  }, []);

  const copyInvite = async () => {
    if (!roomId) {
      logDebug("overlay.invite", "copy skipped without room");
      return;
    }

    const invite = roomShareableLinkRef.current ?? buildInviteUrl(roomId);
    await navigator.clipboard.writeText(invite).catch(() => fallbackCopy(invite));
    logDebug("overlay.invite", "copied", { roomId, invite });
  };

  const loadInviteTargetsForRoom = useCallback(async () => {
    const accessToken = await getFreshAuthAccessToken("invite-targets");
    if (!accessToken) {
      setPanelOpen(true);
      setInviteStatusMessage("Sign in to invite friends.");
      return;
    }

    setInviteTargetsLoading(true);
    setInviteStatusMessage(null);
    try {
      const targets = await listInviteTargets(accessToken);
      setInviteTargets(targets);
      setInvitePanelOpen(true);
      logDebug("overlay.invite", "targets loaded", {
        friendCount: targets.friends.length,
        groupCount: targets.groups.length,
      });
    } catch (error) {
      const message = authErrorMessage(error, "Failed to load invite targets");
      setInviteStatusMessage(message);
      logDebug("overlay.invite", "targets failed", { message });
    } finally {
      setInviteTargetsLoading(false);
    }
  }, [getFreshAuthAccessToken]);

  const toggleInvitePanel = useCallback(async () => {
    if (invitePanelOpen) {
      setInvitePanelOpen(false);
      return;
    }

    await loadInviteTargetsForRoom();
  }, [invitePanelOpen, loadInviteTargetsForRoom]);

  const sendInviteToTarget = useCallback(
    async (
      targetKey: string,
      label: string,
      input: Pick<CreateRoomInviteInput, "recipientUserIds" | "groupId">,
    ) => {
      const activeRoomId = roomIdRef.current;
      const accessToken = await getFreshAuthAccessToken("send-invite");
      if (!activeRoomId || !accessToken) {
        setInviteStatusMessage("Create a room and sign in before inviting friends.");
        return;
      }

      setInviteSendingTarget(targetKey);
      setInviteStatusMessage(null);
      try {
        await createRoomInvite(accessToken, { roomId: activeRoomId, ...input });
        setInviteStatusMessage(`Invite sent to ${label}.`);
        logDebug("overlay.invite", "sent", {
          roomId: activeRoomId,
          targetKey,
          label,
        });
      } catch (error) {
        const message = authErrorMessage(error, "Failed to send invite");
        setInviteStatusMessage(message);
        logDebug("overlay.invite", "send failed", {
          roomId: activeRoomId,
          targetKey,
          message,
        });
      } finally {
        setInviteSendingTarget(null);
      }
    },
    [getFreshAuthAccessToken],
  );

  const sendDirectInvite = useCallback(
    (friend: FriendListItem) =>
      sendInviteToTarget(`friend:${friend.user.userId}`, friend.user.displayName, {
        recipientUserIds: [friend.user.userId],
      }),
    [sendInviteToTarget],
  );

  const sendGroupInvite = useCallback(
    (group: FriendGroup) =>
      sendInviteToTarget(`group:${group.id}`, group.name, {
        groupId: group.id,
      }),
    [sendInviteToTarget],
  );

  const copyDebugLog = async (mode: "compact" | "full" = "compact") => {
    logDebug("debug", "copy requested", {
      mode,
      entries: getDebugEntries().length,
      video: videoDebugSnapshot(adapter.video),
    });
    const text = mode === "compact" ? getCompactDebugLogText() : getDebugLogText();
    await navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    setDebugEntriesCount(getDebugEntries().length);
  };

  const clearDebug = () => {
    clearDebugLog();
    setDebugEntriesCount(getDebugEntries().length);
  };

  const sendReaction = useCallback(
    (emoji: string, text?: string, effect?: ReactionEvent["effect"]) => {
      if (!roomId || !participant) {
        logDebug("reaction", "send skipped", {
          hasRoom: Boolean(roomId),
          hasParticipant: Boolean(participant),
          emoji,
          effect,
          text,
        });
        return;
      }

      const reaction: ReactionEvent = {
        id: crypto.randomUUID(),
        userId: participant.id,
        roomId,
        ...(emoji ? { emoji } : {}),
        ...(effect ? { effect } : {}),
        ...(text ? { text } : {}),
        videoTime: adapter.getCurrentTime(),
        createdAt: Date.now(),
      };

      logDebug("reaction", "send", {
        emoji,
        effect,
        text,
        videoTime: reaction.videoTime,
        userId: participant.id,
      });
      if (effect === FIRE_SUPER_EFFECT) {
        triggerFlameBurst(participant.id);
      }
      clientRef.current.send({ type: "REACTION", roomId, reaction });
    },
    [adapter, participant, roomId, triggerFlameBurst],
  );

  const cancelFireHold = useCallback((reason: string) => {
    const hold = fireHoldRef.current;
    if (!hold) {
      return;
    }

    window.clearTimeout(hold.delayTimerId);
    window.clearTimeout(hold.readyTimerId);
    hold.cleanup();
    fireHoldRef.current = null;
    setFireCharge(null);
    logDebug("reaction.fire", "hold cancelled", {
      reason,
      participantId: hold.participantId,
      heldMs: Date.now() - hold.startedAt,
    });
  }, []);

  const finishFireHold = useCallback(
    (reason: string) => {
      const hold = fireHoldRef.current;
      if (!hold) {
        return;
      }

      const heldMs = Date.now() - hold.startedAt;
      window.clearTimeout(hold.delayTimerId);
      window.clearTimeout(hold.readyTimerId);
      hold.cleanup();
      fireHoldRef.current = null;
      setFireCharge(null);

      if (heldMs < FIRE_SUPER_DELAY_MS) {
        logDebug("reaction.fire", "short fire reaction released", {
          reason,
          participantId: hold.participantId,
          heldMs,
        });
        sendReaction(FIRE_REACTION_EMOJI);
        return;
      }

      if (heldMs < FIRE_SUPER_TOTAL_MS) {
        logDebug("reaction.fire", "hold released before charged", {
          reason,
          participantId: hold.participantId,
          heldMs,
        });
        return;
      }

      logDebug("reaction.fire", "super reaction released", {
        reason,
        participantId: hold.participantId,
        heldMs,
      });
      sendReaction(FIRE_SUPER_REACTION_MARKER, undefined, FIRE_SUPER_EFFECT);
    },
    [sendReaction],
  );

  const beginFireHold = useCallback(
    (source: "hotkey" | "pointer", cleanup: () => void = () => undefined) => {
      if (!roomId || !participant) {
        logDebug("reaction.fire", "hold skipped", {
          hasRoom: Boolean(roomId),
          hasParticipant: Boolean(participant),
          source,
        });
        return false;
      }
      if (!experimentalSuperReactionsEnabled) {
        logDebug("reaction.fire", "hold skipped because experiment is disabled", { source });
        return false;
      }

      cancelFireHold("restart");

      const participantId = participant.id;
      const startedAt = Date.now();
      const delayTimerId = window.setTimeout(() => {
        setFireCharge({ participantId, phase: "charging" });
      }, FIRE_SUPER_DELAY_MS);
      const readyTimerId = window.setTimeout(() => {
        setFireCharge({ participantId, phase: "ready" });
      }, FIRE_SUPER_TOTAL_MS);

      fireHoldRef.current = {
        cleanup,
        delayTimerId,
        participantId,
        readyTimerId,
        startedAt,
      };
      logDebug("reaction.fire", "hold started", { participantId, source });
      return true;
    },
    [cancelFireHold, experimentalSuperReactionsEnabled, participant, roomId],
  );

  const startFireHold = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const finish = () => finishFireHold("pointer-up");
      const cancel = () => cancelFireHold("pointer-cancel");
      const cancelBlur = () => cancelFireHold("window-blur");
      const cleanup = () => {
        window.removeEventListener("pointerup", finish, true);
        window.removeEventListener("pointercancel", cancel, true);
        window.removeEventListener("blur", cancelBlur);
      };

      const started = beginFireHold("pointer", cleanup);
      if (!started) {
        return;
      }

      window.addEventListener("pointerup", finish, true);
      window.addEventListener("pointercancel", cancel, true);
      window.addEventListener("blur", cancelBlur);
    },
    [beginFireHold, cancelFireHold, finishFireHold],
  );

  const restoreVoiceDucking = useCallback(() => {
    restoreVoiceDuckingRef.current?.();
    restoreVoiceDuckingRef.current = null;
  }, []);

  useEffect(() => {
    restoreLiveVoiceDuckingRef.current?.();
    restoreLiveVoiceDuckingRef.current = null;

    if (liveVoiceTalking) {
      restoreLiveVoiceDuckingRef.current = adapter.duckVolume(0.42);
      return () => {
        restoreLiveVoiceDuckingRef.current?.();
        restoreLiveVoiceDuckingRef.current = null;
      };
    }

    if (remoteLiveVoiceActive) {
      restoreLiveVoiceDuckingRef.current = adapter.duckVolume(0.68);
      return () => {
        restoreLiveVoiceDuckingRef.current?.();
        restoreLiveVoiceDuckingRef.current = null;
      };
    }

    return undefined;
  }, [adapter, liveVoiceTalking, remoteLiveVoiceActive]);

  const startLiveVoiceTalk = useCallback(() => {
    if (!roomId) {
      return;
    }

    setLiveVoiceTalking(true);
    void ghostCamSession.startVoiceTalk();
  }, [ghostCamSession.startVoiceTalk, roomId]);

  const stopLiveVoiceTalk = useCallback(() => {
    setLiveVoiceTalking(false);
    void ghostCamSession.stopVoiceTalk();
  }, [ghostCamSession.stopVoiceTalk]);

  const unlockLiveVoicePlayback = useCallback(() => {
    void ghostCamSession.unlockAudio();
  }, [ghostCamSession.unlockAudio]);

  const flushVoiceReaction = useCallback(() => {
    const text = pendingVoiceTextRef.current?.trim();
    pendingVoiceTextRef.current = null;

    if (!text) {
      return;
    }

    const emoji = mapVoiceToEmoji(text);
    sendReaction(emoji ?? "", text);
    setVoiceMessage(text);
  }, [sendReaction]);

  const cleanupVoiceCapture = useCallback(() => {
    restoreVoiceDucking();
    stopVoiceRef.current = null;
    voiceCaptureActiveRef.current = false;
    voiceStoppingRef.current = false;
    setVoiceListening(false);
  }, [restoreVoiceDucking]);

  const startVoiceCapture = useCallback(() => {
    if (voiceCaptureActiveRef.current || !roomId || !isSpeechRecognitionSupported()) {
      return;
    }

    pendingVoiceTextRef.current = null;
    voiceCaptureActiveRef.current = true;
    voiceStoppingRef.current = false;
    restoreVoiceDuckingRef.current = adapter.duckVolume();
    setVoiceMessage(null);
    setVoiceListening(true);

    stopVoiceRef.current = startVoiceRecognition({
      onText: (text) => {
        pendingVoiceTextRef.current = text;
        setVoiceMessage(text);

        if (voiceStoppingRef.current) {
          flushVoiceReaction();
        }
      },
      onError: setVoiceMessage,
      onEnd: () => {
        if (voiceStoppingRef.current) {
          flushVoiceReaction();
        }

        cleanupVoiceCapture();
      },
    });
  }, [adapter, cleanupVoiceCapture, flushVoiceReaction, roomId]);

  const stopVoiceCapture = useCallback(
    (send = true) => {
      if (!voiceCaptureActiveRef.current && !pendingVoiceTextRef.current) {
        return;
      }

      voiceStoppingRef.current = send;
      restoreVoiceDucking();

      if (send && pendingVoiceTextRef.current) {
        flushVoiceReaction();
      }

      const stop = stopVoiceRef.current;
      stopVoiceRef.current = null;

      if (stop) {
        stop();
      } else {
        cleanupVoiceCapture();
      }
    },
    [cleanupVoiceCapture, flushVoiceReaction, restoreVoiceDucking],
  );

  const toggleVoice = () => {
    if (voiceListening) {
      stopVoiceCapture(true);
      return;
    }

    startVoiceCapture();
  };

  const openMessageComposer = useCallback(() => {
    activateMessageComposerGuard();

    if (!roomId) {
      deactivateMessageComposerGuard();
      return;
    }

    setPanelOpen(false);
    setMessageComposerOpen(true);
    setMessageComposerEmojiOpen(false);
    window.requestAnimationFrame(() => {
      messageComposerInputRef.current?.focus({ preventScroll: true });
    });
  }, [activateMessageComposerGuard, deactivateMessageComposerGuard, roomId]);

  const closeMessageComposer = useCallback(() => {
    setMessageComposerOpen(false);
    setMessageComposerEmojiOpen(false);
    setMessageComposerText("");
    releaseMessageComposerGuard();
  }, [releaseMessageComposerGuard]);

  const insertComposerEmoji = useCallback(
    (emoji: string) => {
      const input = messageComposerInputRef.current;
      const selectionStart = input?.selectionStart ?? messageComposerText.length;
      const selectionEnd = input?.selectionEnd ?? selectionStart;
      const before = messageComposerText.slice(0, selectionStart);
      const after = messageComposerText.slice(selectionEnd);
      const prefix = before && !/\s$/.test(before) ? " " : "";
      const suffix = after && !/^\s/.test(after) ? " " : "";
      const insertion = `${prefix}${emoji}${suffix}`;
      const nextText = `${before}${insertion}${after}`.slice(0, 140);
      const nextCaret = Math.min(before.length + insertion.length, nextText.length);

      setMessageComposerText(nextText);
      window.requestAnimationFrame(() => {
        const nextInput = messageComposerInputRef.current;
        nextInput?.focus({ preventScroll: true });
        nextInput?.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [messageComposerText],
  );

  const submitMessageComposer = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
      }
      const text = messageComposerText.trim();
      if (!text || !roomId) {
        return;
      }

      sendReaction("", text);
      setMessageComposerText("");
      setMessageComposerOpen(false);
      setMessageComposerEmojiOpen(false);
      releaseMessageComposerGuard();
    },
    [messageComposerText, releaseMessageComposerGuard, roomId, sendReaction],
  );

  const handleMessageComposerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      if (event.key === "Escape" && !isFullscreenActive()) {
        event.preventDefault();
        closeMessageComposer();
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitMessageComposer();
      }
    },
    [closeMessageComposer, submitMessageComposer],
  );

  const handleMessageComposerShieldReleaseIntent = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      stopNativeEvent(event);

      if (messageComposerOpen) {
        return;
      }

      const shield = event.currentTarget;
      shield.style.cursor = "default";
      messageComposerShieldReleasePointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
      };

      if (messageComposerShieldReleaseTimerRef.current !== null) {
        return;
      }

      setMessageComposerShieldReleasing(true);
      setMessageComposerGuardActive(false);
      setMessageComposerDomGuard(false);
      messageComposerShieldReleaseTimerRef.current = window.setTimeout(() => {
        messageComposerShieldReleaseTimerRef.current = null;
        const wakePoint = messageComposerShieldReleasePointerRef.current;
        const activeShield = messageComposerShieldRef.current;
        if (wakePoint) {
          wakePlayerAfterComposerShieldRelease(wakePoint, activeShield);
        }
        deactivateMessageComposerGuard();
      }, MESSAGE_COMPOSER_SHIELD_RELEASE_BUFFER_MS);
    },
    [deactivateMessageComposerGuard, messageComposerOpen, setMessageComposerDomGuard],
  );

  useEffect(() => {
    const handleShortcut = () => {
      if (messageComposerOpen) {
        closeMessageComposer();
        return;
      }

      openMessageComposer();
    };

    window.addEventListener(ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT, handleShortcut);

    return () => {
      window.removeEventListener(ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT, handleShortcut);
    };
  }, [closeMessageComposer, messageComposerOpen, openMessageComposer]);

  useEffect(() => {
    if (!messageComposerOpen) {
      return;
    }

    const handleSubmit = () => submitMessageComposer();

    window.addEventListener(ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT, handleSubmit);

    return () => {
      window.removeEventListener(ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT, handleSubmit);
    };
  }, [messageComposerOpen, submitMessageComposer]);

  useEffect(() => {
    const state = () => ({
      experimentalSuperReactionsEnabled,
      panelOpen,
      reactionsEnabled,
      roomActive: Boolean(roomId),
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (messageComposerOpen && isEscapeKey(event) && !isFullscreenActive()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeMessageComposer();
        return;
      }

      if (messageComposerOpen && isMessageComposerShortcut(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeMessageComposer();
        return;
      }

      if (isMessageComposerShortcut(event) && !isKeyboardEditableTarget(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openMessageComposer();
        return;
      }

      const action = getHotkeyAction(event, state());
      if (!action) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (action.type === "fire-start") {
        beginFireHold("hotkey");
      } else if (action.type === "voice-start") {
        startLiveVoiceTalk();
      } else if (action.type === "reaction") {
        sendReaction(action.emoji);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (messageComposerOpen && isEscapeKey(event) && !isFullscreenActive()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const action = getHotkeyAction(event, state());
      if (!action || (action.type !== "voice-stop" && action.type !== "fire-stop")) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      if (action.type === "fire-stop") {
        finishFireHold("hotkey-up");
      } else {
        stopLiveVoiceTalk();
      }
    };

    const handleBlur = () => {
      cancelFireHold("window-blur");
      stopLiveVoiceTalk();
      stopVoiceCapture(true);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleBlur);
    };
  }, [
    beginFireHold,
    cancelFireHold,
    closeMessageComposer,
    experimentalSuperReactionsEnabled,
    finishFireHold,
    messageComposerOpen,
    openMessageComposer,
    panelOpen,
    reactionsEnabled,
    roomId,
    sendReaction,
    startLiveVoiceTalk,
    stopLiveVoiceTalk,
    stopVoiceCapture,
  ]);

  useEffect(
    () => () => {
      stopLiveVoiceTalk();
      stopVoiceCapture(false);
    },
    [stopLiveVoiceTalk, stopVoiceCapture],
  );

  return (
    <div
      className={overlayClassName}
      onPointerDownCapture={unlockLiveVoicePlayback}
      style={overlayCssVariables}
    >
      <style>{overlayStyles}</style>
      <button className="top-bubble" type="button" onClick={() => setPanelOpen((value) => !value)}>
        <span className="brand-dot">A</span>
        <span className={`sync-dot ${isConnected ? "connected" : catchUp ? "warning" : ""}`} />
        <span className="bubble-count">{participantCount}</span>
      </button>

      {panelOpen ? (
        <section className="mini-panel" aria-label="Anidachi controls">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Anidachi</h2>
              <div className="panel-subtitle">
                {roomId
                  ? `${title} · ${status}`
                  : identityLoaded
                    ? "Sign in to create a watch room"
                    : "Checking account..."}
              </div>
            </div>
            <button className="icon-button" type="button" onClick={() => setPanelOpen(false)}>
              <X size={15} />
            </button>
          </div>

          <div className="panel-actions">
            <button
              className="button primary"
              type="button"
              onClick={handleCreateRoom}
              disabled={!participant || extensionContextInvalidated}
            >
              {roomId ? "New room" : "Create room"}
            </button>
            <button className="button" type="button" onClick={copyInvite} disabled={!roomId}>
              Copy invite
            </button>
            <button
              className="button"
              type="button"
              onClick={toggleInvitePanel}
              disabled={!roomId || !authAuthenticated || inviteTargetsLoading}
            >
              {inviteTargetsLoading ? "Loading" : "Invite"}
            </button>
            <button
              className="button"
              type="button"
              onClick={() => sendHostState(true)}
              disabled={!roomId || !isHost}
            >
              Sync now
            </button>
            {roomId && isHost ? (
              <button className="button" type="button" onClick={handleEndRoom}>
                End room
              </button>
            ) : null}
          </div>
          {roomQuota ? (
            <div className="quota-note">
              Free watch-party time today: {formatQuotaCountdown(quotaRemainingSeconds)} left
            </div>
          ) : null}
          {roomId ? (
            <div className="quota-note">
              Room capacity: {participantLimitText} · {mediaSeatText}
            </div>
          ) : null}
          {invitePanelOpen ? (
            <div className="invite-panel">
              <div className="invite-panel-header">
                <strong>Friends & groups</strong>
                <button className="button compact" type="button" onClick={loadInviteTargetsForRoom}>
                  Refresh
                </button>
              </div>
              {inviteStatusMessage ? <div className="footnote">{inviteStatusMessage}</div> : null}
              {inviteTargets && inviteTargets.groups.length ? (
                <>
                  <div className="section-title compact">Groups</div>
                  {inviteTargets.groups.map((group) => (
                    <div className="participant-row" key={group.id}>
                      <div className="participant-main">
                        <span className="mini-avatar">{initials(group.name)}</span>
                        <span className="participant-name">{group.name}</span>
                      </div>
                      <button
                        className="button compact"
                        disabled={inviteSendingTarget !== null || group.members.length === 0}
                        onClick={() => sendGroupInvite(group)}
                        type="button"
                      >
                        {inviteSendingTarget === `group:${group.id}` ? "Sending" : "Invite"}
                      </button>
                    </div>
                  ))}
                </>
              ) : null}
              {inviteTargets && inviteTargets.friends.length ? (
                <>
                  <div className="section-title compact">Friends</div>
                  {inviteTargets.friends.map((friend) => (
                    <div className="participant-row" key={friend.user.userId}>
                      <div className="participant-main">
                        <span className="mini-avatar">{initials(friend.user.displayName)}</span>
                        <span className="participant-name">{friend.user.displayName}</span>
                      </div>
                      <button
                        className="button compact"
                        disabled={inviteSendingTarget !== null}
                        onClick={() => sendDirectInvite(friend)}
                        type="button"
                      >
                        {inviteSendingTarget === `friend:${friend.user.userId}` ? "Sending" : "Invite"}
                      </button>
                    </div>
                  ))}
                </>
              ) : null}
              {inviteTargets &&
              !inviteTargets.friends.length &&
              !inviteTargets.groups.length &&
              !inviteTargetsLoading ? (
                <div className="footnote">
                  No friends or groups yet. Copy invite still works for one-off watching.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="auth-card">
            <span className="mini-avatar">{initials(participant?.displayName ?? (identityLoaded ? "AN" : "..."))}</span>
            <div className="auth-copy">
              <strong>{participant?.displayName ?? (identityLoaded ? "Not signed in" : "Checking account")}</strong>
              <span>{authAuthenticated ? "Signed in" : identityLoaded ? "Sign in required" : "Please wait"}</span>
            </div>
            <button
              className="button"
              type="button"
              onClick={authAuthenticated ? handleSignOut : handleSignIn}
              disabled={authBusy || !identityLoaded || extensionContextInvalidated}
            >
              {authBusy || !identityLoaded ? "Wait" : authAuthenticated ? "Sign out" : "Sign in"}
            </button>
          </div>
          {authMessage ? (
            <div className="auth-notice">
              <span>{authMessage}</span>
              {extensionContextInvalidated ? (
                <button className="button compact" type="button" onClick={reloadPage}>
                  Reload page
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="section-title">Reactions</div>
          <div className="emoji-row">
            {EMOJI_PALETTE.map((emoji) => (
              <button
                className="icon-button"
                type="button"
                key={emoji}
                onClick={(event) => {
                  if (emoji === FIRE_REACTION_EMOJI && experimentalSuperReactionsEnabled) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }

                  sendReaction(emoji);
                }}
                onPointerDown={
                  emoji === FIRE_REACTION_EMOJI && experimentalSuperReactionsEnabled
                    ? (event) => startFireHold(event)
                    : undefined
                }
                disabled={!roomId}
              >
                {emoji}
              </button>
            ))}
            <button
              className="button"
              type="button"
              disabled={!roomId || !isSpeechRecognitionSupported()}
              onClick={toggleVoice}
              title="Speech reaction"
            >
              {voiceListening ? <MicOff size={14} /> : <Mic size={14} />}
              Dictate
            </button>
          </div>
          {voiceMessage ? <div className="footnote">{voiceMessage}</div> : null}

          <div className="section-title">Audio</div>
          <div className={`live-voice-status ${liveVoiceTalking ? "talking" : ""}`}>
            <span className="live-voice-label">
              <Mic size={13} />
              Push to talk
            </span>
            <span>{liveVoiceStatusText}</span>
          </div>
          {roomId && !liveMediaAvailable ? (
            <div className="footnote">
              {roomMediaSeatLimit <= 0
                ? "Live media is not included in this room."
                : "All live media seats are in use. Sync, chat, and reactions still work."}
            </div>
          ) : null}
          {ghostCamSession.voiceMessage ? (
            <div className="footnote">{ghostCamSession.voiceMessage}</div>
          ) : null}

          <div className="section-title">Participants</div>
          {(participants.length ? participants : participant ? [participant] : []).map((item) => (
            <div className="participant-row" key={item.id}>
              <div className="participant-main">
                <span className="mini-avatar">{initials(item.displayName)}</span>
                <span className="participant-name">{item.displayName}</span>
              </div>
              <span className="participant-status">
                {item.role}
                {item.cameraEnabled ? " · media" : ""}
                {liveVoiceActiveSpeakerIds.includes(item.id) ? " · voice" : ""}
              </span>
            </div>
          ))}

          <CurrentResourcePanel entry={currentResourceEntry} store={watchProgressStore} />

          <div className="section-title">Settings</div>
          <div className="toggle-list">
            <button
              className="toggle"
              type="button"
              onClick={handleGhostCamToggle}
            >
              <span>Ghost Cam</span>
              <span>
                {roomId && roomMediaSeatLimit <= 0
                  ? "No seats"
                  : roomId && !localHasMediaSeat && occupiedMediaSeatCount >= roomMediaSeatLimit
                    ? "Full"
                    : camsEnabled
                      ? "On"
                      : "Off"}
              </span>
            </button>
            <div className="size-control">
              <div className="size-control-header">
                <span>Cam size</span>
                <strong>{ghostCamSizeLabel}</strong>
              </div>
              <input
                aria-label="Ghost Cam bubble size"
                className="size-slider"
                max={GHOST_CAM_SIZE_MAX_STEP}
                min={GHOST_CAM_SIZE_MIN_STEP}
                onChange={handleGhostCamSizeChange}
                step={1}
                type="range"
                value={ghostCamSizeStep}
              />
              <div className="size-ticks" aria-hidden="true">
                {GHOST_CAM_SIZE_STEPS.map((step) => (
                  <span key={step.step}>{step.label}</span>
                ))}
              </div>
            </div>
            <button
              className="toggle"
              type="button"
              onClick={() => setReactionsEnabled((value) => !value)}
            >
              <span>Reactions</span>
              <span>{reactionsEnabled ? "On" : "Off"}</span>
            </button>
            <div className="mode-control">
              <span>Messages</span>
              <fieldset className="segmented-control">
                <legend className="sr-only">Message display mode</legend>
                <button
                  className={messageDisplayMode === "chat" ? "selected" : ""}
                  type="button"
                  onClick={() => handleMessageDisplayModeChange("chat")}
                >
                  Chat
                </button>
                <button
                  className={messageDisplayMode === "bubble" ? "selected" : ""}
                  type="button"
                  onClick={() => handleMessageDisplayModeChange("bubble")}
                >
                  Bubbles
                </button>
              </fieldset>
            </div>
            {messageDisplayMode === "chat" ? (
              <div className="mode-control">
                <span>Chat mode</span>
                <fieldset className="segmented-control">
                  <legend className="sr-only">Chat display mode</legend>
                  <button
                    className={chatDisplayMode === "live" ? "selected" : ""}
                    type="button"
                    onClick={() => handleChatDisplayModeChange("live")}
                  >
                    Live
                  </button>
                  <button
                    className={chatDisplayMode === "history" ? "selected" : ""}
                    type="button"
                    onClick={() => handleChatDisplayModeChange("history")}
                  >
                    History
                  </button>
                </fieldset>
              </div>
            ) : null}
            <button
              className="toggle"
              type="button"
              onClick={() => setSocialVisible((value) => !value)}
            >
              <span>Overlay</span>
              <span>{socialVisible ? "Visible" : "Hidden"}</span>
            </button>
          </div>

          <div className="section-title">Debug</div>
          <div className="debug-box">
            <div className="debug-line">
              <span>Build</span>
              <strong>{ANIDACHI_BUILD_ID}</strong>
            </div>
            <div className="debug-line">
              <span>Adapter</span>
              <strong>{adapter.id}</strong>
            </div>
            <div className="debug-line">
              <span>Media</span>
              <strong>{mediaTransport}</strong>
            </div>
            <div className="debug-line">
              <span>Seats</span>
              <strong>{mediaSeatText}</strong>
            </div>
            <div className="debug-line">
              <span>Logs</span>
              <strong>{debugEntriesCount}</strong>
            </div>
            <div className="debug-actions">
              <button className="button" type="button" onClick={() => copyDebugLog("compact")}>
                Copy compact
              </button>
              <button className="button" type="button" onClick={() => copyDebugLog("full")}>
                Copy full
              </button>
              <button className="button" type="button" onClick={clearDebug}>
                Clear
              </button>
            </div>
          </div>

          <div className="footnote">
            Debug logging is temporarily always on. Media transport is an internal experiment.
          </div>
        </section>
      ) : null}

      {messageComposerShieldVisible && roomId ? (
        <div
          ref={messageComposerShieldRef}
          aria-hidden="true"
          className={messageComposerShieldClassName}
          onClick={stopNativeEvent}
          onMouseDown={stopNativeEvent}
          onMouseUp={stopNativeEvent}
          onPointerDown={handleMessageComposerShieldReleaseIntent}
          onPointerMove={handleMessageComposerShieldReleaseIntent}
          onPointerOver={stopNativeEvent}
          onPointerUp={stopNativeEvent}
        />
      ) : null}

      {messageComposerOpen && roomId ? (
        <form
          className="message-composer"
          onClick={stopNativeEvent}
          onKeyDown={stopNativeEvent}
          onMouseDown={stopNativeEvent}
          onMouseMove={stopNativeEvent}
          onMouseUp={stopNativeEvent}
          onPointerDown={stopNativeEvent}
          onPointerMove={stopNativeEvent}
          onPointerOver={stopNativeEvent}
          onPointerUp={stopNativeEvent}
          onSubmit={submitMessageComposer}
          ref={messageComposerFormRef}
        >
          <div className="message-composer-emoji">
            <button
              aria-expanded={messageComposerEmojiOpen}
              aria-label="Choose emoji"
              className="message-composer-emoji-button"
              onClick={() => setMessageComposerEmojiOpen((value) => !value)}
              type="button"
            >
              <SmilePlus size={17} strokeWidth={2.2} />
            </button>
            {messageComposerEmojiOpen ? (
              <div className="message-composer-emoji-popover">
                {COMPOSER_EMOJI_PACK.map((emoji) => (
                  <button key={emoji} onClick={() => insertComposerEmoji(emoji)} type="button">
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <input
            aria-label="Anidachi message"
            maxLength={140}
            onChange={(event) => setMessageComposerText(event.currentTarget.value)}
            onKeyDown={handleMessageComposerKeyDown}
            onKeyUp={stopNativeEvent}
            placeholder="Type a quick reaction"
            ref={messageComposerInputRef}
            type="text"
            value={messageComposerText}
          />
          <button
            aria-label="Send message"
            className="message-composer-send"
            disabled={!messageComposerText.trim()}
            type="submit"
          >
            <SendHorizontal size={15} />
          </button>
        </form>
      ) : null}

      {socialVisible ? (
        <>
          {camsEnabled && displayedCameraParticipants.length ? (
            <div className="cam-stack">
              {displayedCameraParticipants.map((item) => (
                <CameraBubble
                  key={item.id}
                  participant={item}
                  video={ghostVideos.find((video) => video.participantId === item.id)}
                  active={item.id === participant?.id}
                  fireChargePhase={fireCharge?.participantId === item.id ? fireCharge.phase : null}
                  flaming={flamingParticipantIds.includes(item.id)}
                  speaking={liveVoiceActiveSpeakerIds.includes(item.id)}
                />
              ))}
            </div>
          ) : null}

          {messageDisplayMode === "chat" && !panelOpen && displayedChatMessages.length ? (
            <LiveChatColumn
              mode={chatDisplayMode}
              messages={displayedChatMessages}
              participants={participants}
              fallbackParticipantId={participant?.id}
            />
          ) : null}

          {reactions.map((reaction) => (
            <ReactionPop
              key={reaction.id}
              reaction={reaction}
              participants={participants}
              bubbleGapPx={ghostCamGapPx}
              camStackBottomPx={camStackBottomPx}
              bubbleSizePx={ghostCamSizePx}
              fallbackParticipantId={participant?.id}
            />
          ))}

          {catchUp ? (
            <div className="catch-up">
              {Math.abs(catchUp.drift).toFixed(1)}s out of sync
              <button
                className="button primary"
                type="button"
                onClick={() => {
                  logDebug("sync.catchup", "clicked", {
                    expectedTime: catchUp.expectedTime,
                    drift: catchUp.drift,
                    video: videoDebugSnapshot(adapter.video),
                  });
                  adapter.seek(catchUp.expectedTime, { resumeIfPlaying: false });
                  setCatchUp(null);
                }}
              >
                Catch up
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function CameraBubble({
  participant,
  video,
  active,
  fireChargePhase,
  flaming,
  speaking,
}: {
  participant: Participant;
  video: GhostVideo | undefined;
  active: boolean;
  fireChargePhase: FireChargePhase | null;
  flaming: boolean;
  speaking: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (!video) {
      ref.current.replaceChildren();
      return;
    }

    ref.current.replaceChildren(video.element);
  }, [video]);

  return (
    <div
      className={`cam-bubble ${active ? "active" : ""} ${flaming ? "flame-active" : ""} ${
        speaking ? "speaking" : ""
      }`}
      title={participant.displayName}
    >
      <div className="cam-media" ref={ref} />
      {!video ? <div className="fallback-face">{initials(participant.displayName)}</div> : null}
      {flaming ? (
        <svg aria-hidden="true" className="nuke-burst" focusable="false" viewBox="0 0 120 150">
          <g className="nuke-shockwave">
            <ellipse cx="60" cy="116" rx="18" ry="5" />
          </g>
          <g className="nuke-fireball">
            <circle className="nuke-fireball-halo" cx="60" cy="112" r="29" />
            <circle className="nuke-fireball-core" cx="60" cy="112" r="17" />
            <circle className="nuke-fireball-white" cx="55" cy="106" r="7" />
          </g>
          <g className="nuke-stem">
            <path
              className="nuke-stem-smoke"
              d="M55 126 C48 111 51 96 57 84 C62 72 62 61 58 49 C68 61 70 76 65 89 C61 101 66 114 73 128 Z"
            />
            <ellipse className="nuke-stem-glow" cx="61" cy="101" rx="8" ry="26" />
          </g>
          <g className="nuke-cap">
            <ellipse className="nuke-cap-shadow" cx="60" cy="69" rx="36" ry="21" />
            <circle className="nuke-cap-puff puff-left" cx="34" cy="62" r="16" />
            <circle className="nuke-cap-puff puff-mid-left" cx="49" cy="52" r="19" />
            <circle className="nuke-cap-puff puff-mid-right" cx="70" cy="51" r="21" />
            <circle className="nuke-cap-puff puff-right" cx="89" cy="64" r="17" />
            <ellipse className="nuke-cap-core" cx="61" cy="68" rx="33" ry="17" />
            <ellipse className="nuke-cap-ring" cx="61" cy="76" rx="29" ry="8" />
          </g>
          <g className="nuke-sparks">
            {NUKE_SPARKS.map((spark) => (
              <circle
                className={`nuke-spark spark-${spark}`}
                cx="60"
                cy="114"
                key={spark}
                r="1.8"
              />
            ))}
          </g>
        </svg>
      ) : null}
      {fireChargePhase ? (
        <svg
          aria-hidden="true"
          className={`super-ring ${fireChargePhase}`}
          focusable="false"
          viewBox="0 0 100 100"
        >
          <circle className="super-ring-track" cx="50" cy="50" r="46" pathLength={100} />
          <circle className="super-ring-progress" cx="50" cy="50" r="46" pathLength={100} />
        </svg>
      ) : null}
      {video && !speaking ? <span className="live-dot" /> : null}
      {speaking ? (
        <span className="mic-dot" aria-hidden="true">
          <Mic size={10} strokeWidth={2.5} />
        </span>
      ) : null}
    </div>
  );
}

function LiveChatColumn({
  mode,
  messages,
  participants,
  fallbackParticipantId,
}: {
  mode: ChatDisplayMode;
  messages: LiveChatMessage[];
  participants: Participant[];
  fallbackParticipantId?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const visibleMessages =
    mode === "history"
      ? messages.slice(-CHAT_HISTORY_MAX_MESSAGES)
      : messages.slice(-LIVE_CHAT_MAX_MESSAGES);
  const hasGhostRow = mode === "live" && visibleMessages.length >= LIVE_CHAT_MAX_MESSAGES;

  useEffect(() => {
    if (mode !== "history") {
      return;
    }

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 70 || messages.length <= 1) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages.length, mode]);

  return (
    <div
      className={`live-chat-column ${mode}`}
      aria-live="polite"
      onMouseMove={stopNativeEvent}
      onPointerDown={stopNativeEvent}
      onPointerMove={stopNativeEvent}
      onPointerOver={stopNativeEvent}
      onPointerUp={stopNativeEvent}
      ref={scrollRef}
      role="log"
    >
      {visibleMessages.map((message, index) => {
        const participant = participants.find((item) => item.id === message.reaction.userId);
        const isFallback = message.reaction.userId === fallbackParticipantId && !participant;
        const displayName = participant?.displayName ?? (isFallback ? "You" : "Friend");
        const isGhost = hasGhostRow && index === 0;
        const style = {
          "--chat-name-color": getLiveChatNameColor(message.reaction.userId),
        } as CSSProperties;

        return (
          <div
            className={`live-chat-message ${isGhost ? "ghost" : ""}`}
            key={message.id}
            style={style}
          >
            <span className="live-chat-name">{displayName}</span>
            <span className="live-chat-text">{message.reaction.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReactionPop({
  reaction,
  participants,
  bubbleGapPx,
  camStackBottomPx,
  bubbleSizePx,
  fallbackParticipantId,
}: {
  reaction: ReactionEvent;
  participants: Participant[];
  bubbleGapPx: number;
  camStackBottomPx: number;
  bubbleSizePx: number;
  fallbackParticipantId?: string;
}) {
  const index = Math.max(
    0,
    participants.findIndex((item) => item.id === reaction.userId),
  );
  const reactionRight = Math.max(8, 10 + index * (bubbleSizePx + bubbleGapPx));
  const reactionBottom = Math.max(84, camStackBottomPx + bubbleSizePx + 6);
  const participant = participants.find((item) => item.id === reaction.userId);
  const isFallback = reaction.userId === fallbackParticipantId && !participant;
  const displayName = participant?.displayName ?? (isFallback ? "You" : "Friend");

  if (reaction.effect === FIRE_SUPER_EFFECT || reaction.emoji === FIRE_SUPER_REACTION_MARKER) {
    return null;
  }

  const style = {
    "--reaction-bottom": `${reactionBottom}px`,
    "--reaction-right": `${reactionRight}px`,
  } as CSSProperties;

  return (
    <div
      className="reaction-pop"
      onMouseMove={stopNativeEvent}
      onPointerDown={stopNativeEvent}
      onPointerMove={stopNativeEvent}
      onPointerOver={stopNativeEvent}
      onPointerUp={stopNativeEvent}
      role="status"
      style={style}
    >
      {reaction.emoji ? <span>{reaction.emoji}</span> : null}
      {reaction.text ? (
        <span className="reaction-text">
          <span className="reaction-author">{displayName}</span>
          <span className="reaction-message">{reaction.text}</span>
        </span>
      ) : null}
    </div>
  );
}

function getLiveChatNameColor(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }

  return LIVE_CHAT_NAME_COLORS[hash % LIVE_CHAT_NAME_COLORS.length];
}

type P2PSignalServerEvent = Extract<ServerEvent, { type: "P2P_SIGNAL" }>;

function createClientSignalId(): string {
  return `p2p-signal-${crypto.randomUUID()}`;
}

function getIncomingP2PSignalDedupeKey(event: P2PSignalServerEvent): string {
  return `${event.fromUserId}:${event.senderConnectionId}:${event.clientSignalId}`;
}

const HANDLED_P2P_SIGNAL_ID_CAP = 600;

/** Keeps the P2P-signal dedupe set bounded within a long-lived room session. */
function pruneHandledP2PSignalIds(handled: Set<string>): void {
  if (handled.size <= HANDLED_P2P_SIGNAL_ID_CAP) {
    return;
  }

  const overflow = handled.size - HANDLED_P2P_SIGNAL_ID_CAP;
  let removed = 0;
  for (const key of handled) {
    handled.delete(key);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
}

function toIncomingP2PSignal(
  event: P2PSignalServerEvent,
  sequence: number,
): IncomingP2PSignal {
  const incoming: IncomingP2PSignal = {
    clientSignalId: event.clientSignalId,
    fromUserId: event.fromUserId,
    senderConnectionId: event.senderConnectionId,
    sequence,
    signal: event.signal,
  };

  if (event.roomGeneration !== undefined) {
    incoming.roomGeneration = event.roomGeneration;
  }
  if (event.serverSeq !== undefined) {
    incoming.serverSeq = event.serverSeq;
  }
  if (event.sourceGeneration !== undefined) {
    incoming.sourceGeneration = event.sourceGeneration;
  }

  return incoming;
}

function normalizeMessageDisplayMode(value: unknown): MessageDisplayMode {
  return value === "bubble" ? "bubble" : DEFAULT_MESSAGE_DISPLAY_MODE;
}

function normalizeChatDisplayMode(value: unknown): ChatDisplayMode {
  return value === "history" ? "history" : DEFAULT_CHAT_DISPLAY_MODE;
}

function isMessageComposerShortcut(event: KeyboardEvent): boolean {
  return event.type === "keydown" && isMessageComposerShortcutEvent(event);
}

function isEscapeKey(event: KeyboardEvent): boolean {
  return event.key === "Escape" || event.key === "Esc";
}

function isFullscreenActive(): boolean {
  return Boolean(document.fullscreenElement);
}

function isKeyboardEditableTarget(event: KeyboardEvent): boolean {
  const path = event.composedPath();
  return path.some((target) => target instanceof HTMLElement && isKeyboardEditableElement(target));
}

function isKeyboardEditableElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable ||
    element.getAttribute("role") === "textbox"
  );
}

function getRoomIdFromHash(): string | null {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  return params.get("anidachiRoom");
}

const PARTICIPANT_SESSION_STORAGE_KEY = "anidachi:participant-session-id";

/**
 * Stable id for this tab's room session. Persisted in sessionStorage so a
 * reload of the same tab keeps the same id (the Worker treats it as a
 * reconnect), while a different tab/device gets a different id (a takeover).
 */
function getParticipantSessionId(namespace: RoomSessionNamespace | null): string {
  const storageKey = namespace
    ? `${namespace.prefix}:participant-session-id`
    : PARTICIPANT_SESSION_STORAGE_KEY;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }

    const generated = `session-${crypto.randomUUID()}`;
    sessionStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    // sessionStorage may be unavailable; fall back to a per-call id.
    return `session-${crypto.randomUUID()}`;
  }
}

function clearLegacyParticipantSessionStorage(): void {
  try {
    sessionStorage.removeItem(PARTICIPANT_SESSION_STORAGE_KEY);
  } catch {
    // sessionStorage may be unavailable on some embedded pages.
  }
}

function clearRoomHash(): void {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (!params.has("anidachiRoom")) {
    return;
  }

  params.delete("anidachiRoom");
  const hash = params.toString();
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}${hash ? `#${hash}` : ""}`,
  );
}

function quotaExhaustedMessage(resetAt: string | undefined): string {
  if (resetAt) {
    const reset = new Date(resetAt);
    if (!Number.isNaN(reset.getTime())) {
      const label = reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `Daily free watch-party time is used up. It resets at ${label}.`;
    }
  }

  return "Daily free watch-party time is used up. It resets at midnight UTC.";
}

function roomJoinUnavailableMessage(error: { status?: number }): string {
  if (error.status === 404) {
    return "This watch room is no longer available.";
  }

  return "This watch room is not available for this account.";
}

function formatQuotaCountdown(remainingSeconds: number | null): string {
  const total = Math.max(0, Math.floor(remainingSeconds ?? 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function shouldOpenPanelForInitialRoom(hashRoomId: string | null, persistedRoomId: string | null) {
  return Boolean(hashRoomId && hashRoomId !== persistedRoomId);
}

function ensureRoomHash(roomId: string): void {
  if (getRoomIdFromHash() !== roomId) {
    setRoomHash(roomId);
  }
}

function setRoomHash(roomId: string): void {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  params.set("anidachiRoom", roomId);
  history.replaceState(null, "", `${location.pathname}${location.search}#${params.toString()}`);
}

function buildInviteUrl(roomId: string): string {
  const url = new URL(location.href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  params.set("anidachiRoom", roomId);
  url.hash = params.toString();
  return url.toString();
}

function buildCurrentSourceUrlForInvite(): string {
  const url = new URL(location.href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  params.delete("anidachiRoom");
  url.hash = params.toString();
  return url.toString();
}

function buildSourceUrlWithRoom(sourceUrl: string, roomId: string | null): URL | null {
  let url: URL;
  try {
    url = new URL(sourceUrl, location.href);
  } catch {
    return null;
  }

  if (!url.hostname.endsWith("crunchyroll.com")) {
    return null;
  }

  if (roomId) {
    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    params.set("anidachiRoom", roomId);
    url.hash = params.toString();
  }

  return url;
}

function isSameDocumentTarget(target: URL): boolean {
  const current = new URL(location.href);
  return (
    current.origin === target.origin &&
    current.pathname === target.pathname &&
    current.search === target.search
  );
}

async function navigateCrunchyrollToRemoteSource(target: URL, state: PlaybackState): Promise<void> {
  const targetUrl = target.toString();
  const result = await runCrunchyrollMainCommand("navigate", { url: targetUrl });
  logDebug("sync.source", "Crunchyroll seamless navigation result", {
    result,
    state: playbackStateDebugSnapshot(state),
    target: targetUrl,
  });

  if (result.ok || isSameDocumentTarget(target)) {
    return;
  }

  logDebug("sync.source", "Crunchyroll hard navigation fallback", {
    currentUrl: location.href,
    error: result.error,
    target: targetUrl,
  });
  location.assign(targetUrl);
}

function fallbackCopy(text: string): void {
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getCrunchyrollPlayerChromeState(container: HTMLElement): CrunchyrollPlayerChromeState {
  const containerRect = container.getBoundingClientRect();
  if (!isUsableRect(containerRect)) {
    return DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE;
  }

  const controlRects = getCrunchyrollControlRects(container, containerRect, true);
  const layoutControlRects = getCrunchyrollControlRects(container, containerRect, false);
  const timelineRect = getVisibleElementRect(
    container.querySelector<HTMLElement>("[data-testid='timeline-controls-container']"),
    container,
    containerRect,
    true,
  );
  const controlsVisible = Boolean(timelineRect) || controlRects.length > 0;
  const topControlRects = getCrunchyrollTopControlRects(
    layoutControlRects.length ? layoutControlRects : controlRects,
    containerRect,
  );
  const topPosition = getCrunchyrollTopBubblePosition(
    containerRect,
    topControlRects,
    topControlRects.length > 0,
  );

  return {
    controlsVisible,
    camStackBottomPx: controlsVisible
      ? getCrunchyrollCamStackBottom(containerRect, timelineRect, controlRects)
      : DEFAULT_CAM_STACK_BOTTOM_PX,
    containerHeightPx: Math.round(containerRect.height),
    ...topPosition,
  };
}

function getCrunchyrollControlRects(
  container: HTMLElement,
  containerRect: DOMRect,
  respectOpacity: boolean,
): DOMRect[] {
  const controls = Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "[data-testid='player-controls-root']",
        "[data-testid='timeline-controls-container']",
        "[data-testid='settings-button']",
        "[data-testid='fullscreen-button']",
        "[data-testid='playback-speed-button']",
        "[data-testid='audio-subtitle-button']",
        "[data-testid='play-pause-button']",
        "[data-testid='timestamp']",
        "[data-testid*='player' i]",
        "[data-testid*='control' i]",
        "[data-testid*='settings' i]",
        "[data-testid*='fullscreen' i]",
        "button",
        "[role='button']",
        "[role='slider']",
        "input[type='range']",
      ].join(", "),
    ),
  );

  return controls
    .map((element) => getVisibleElementRect(element, container, containerRect, respectOpacity))
    .filter((rect): rect is DOMRect => Boolean(rect))
    .filter((rect) => !isLikelyWholePlayerControlRoot(rect, containerRect));
}

function getCrunchyrollTopControlRects(controlRects: DOMRect[], containerRect: DOMRect): DOMRect[] {
  const topZoneBottom = containerRect.top + Math.min(150, Math.max(96, containerRect.height * 0.2));
  const rightZoneStart =
    containerRect.right - Math.min(360, Math.max(180, containerRect.width * 0.4));

  return controlRects.filter(
    (rect) =>
      rect.top < topZoneBottom &&
      rect.bottom > containerRect.top &&
      rect.right > rightZoneStart &&
      rect.width >= 18 &&
      rect.width <= 104 &&
      rect.height >= 18 &&
      rect.height <= 104,
  );
}

function getCrunchyrollTopBubblePosition(
  containerRect: DOMRect,
  topControlRects: DOMRect[],
  controlsVisible: boolean,
): Pick<
  CrunchyrollPlayerChromeState,
  "miniPanelRightPx" | "miniPanelTopPx" | "topBubbleRightPx" | "topBubbleTopPx"
> {
  if (!controlsVisible || topControlRects.length === 0) {
    return {
      miniPanelRightPx: DEFAULT_MINI_PANEL_RIGHT_PX,
      miniPanelTopPx: DEFAULT_MINI_PANEL_TOP_PX,
      topBubbleRightPx: DEFAULT_TOP_BUBBLE_RIGHT_PX,
      topBubbleTopPx: DEFAULT_TOP_BUBBLE_TOP_PX,
    };
  }

  const margin = 10;
  const bubbleHeight = 30;
  const firstControl = [...topControlRects].sort((a, b) => a.top - b.top)[0];
  const firstCenterY = rectCenterY(firstControl);
  const rowRects = topControlRects.filter(
    (rect) => Math.abs(rectCenterY(rect) - firstCenterY) <= 34,
  );
  const rowTop = Math.min(...rowRects.map((rect) => rect.top));
  const rowBottom = Math.max(...rowRects.map((rect) => rect.bottom));
  const topBubbleTopPx = Math.round(
    clampNumber(
      rowTop - containerRect.top + (rowBottom - rowTop - bubbleHeight) / 2,
      margin,
      Math.max(margin, containerRect.height - bubbleHeight - margin),
    ),
  );
  const topBubbleRightPx = margin;

  return {
    miniPanelRightPx: margin,
    miniPanelTopPx: Math.round(
      clampNumber(
        topBubbleTopPx + bubbleHeight + 8,
        DEFAULT_MINI_PANEL_TOP_PX,
        Math.max(DEFAULT_MINI_PANEL_TOP_PX, containerRect.height - 80),
      ),
    ),
    topBubbleRightPx,
    topBubbleTopPx,
  };
}

function getCrunchyrollCamStackBottom(
  containerRect: DOMRect,
  timelineRect: DOMRect | null,
  controlRects: DOMRect[],
): number {
  const lowerZoneTop =
    containerRect.bottom - Math.min(260, Math.max(120, containerRect.height * 0.28));
  const lowerControlRects = [timelineRect, ...controlRects].filter((rect): rect is DOMRect => {
    if (!rect) {
      return false;
    }

    return (
      rect.top >= lowerZoneTop &&
      rect.bottom <= containerRect.bottom + 4 &&
      rect.width >= 18 &&
      rect.height >= 6
    );
  });

  if (lowerControlRects.length === 0) {
    return 126;
  }

  const firstControlTop = Math.min(...lowerControlRects.map((rect) => rect.top));
  const bottomPx = containerRect.bottom - firstControlTop + 18;
  return Math.round(clampNumber(bottomPx, 96, Math.min(220, containerRect.height - 72)));
}

function getVisibleElementRect(
  element: HTMLElement | null,
  boundary: HTMLElement,
  boundaryRect: DOMRect,
  respectOpacity: boolean,
): DOMRect | null {
  if (!element || !isElementVisuallyAvailable(element, boundary, respectOpacity)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (!isUsableRect(rect) || !rectIntersects(rect, boundaryRect)) {
    return null;
  }

  return rect;
}

function isPointerInComposerDeadZone(
  event: MouseEvent | globalThis.PointerEvent,
  container: HTMLElement,
): boolean {
  const rect = container.getBoundingClientRect();
  if (!isUsableRect(rect)) {
    return false;
  }

  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    return false;
  }

  const deadZoneHeight = clampNumber(rect.height * 0.36, 220, 420);
  return event.clientY >= rect.bottom - deadZoneHeight;
}

function resetComposerShieldInlineStyles(shield: HTMLDivElement | null) {
  if (!shield) {
    return;
  }

  shield.style.cursor = "";
  shield.style.pointerEvents = "";
}

function wakePlayerAfterComposerShieldRelease(point: PointerWakePoint, shield: HTMLElement | null) {
  const previousPointerEvents = shield?.style.pointerEvents ?? "";
  if (shield) {
    shield.style.pointerEvents = "none";
  }

  const target = document.elementFromPoint(point.clientX, point.clientY);
  if (shield) {
    shield.style.pointerEvents = previousPointerEvents;
  }

  if (!target) {
    return;
  }

  const eventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: point.clientX,
    clientY: point.clientY,
    composed: true,
    screenX: point.screenX,
    screenY: point.screenY,
    view: window,
  };

  if (typeof globalThis.PointerEvent === "function") {
    target.dispatchEvent(
      new globalThis.PointerEvent("pointermove", {
        ...eventInit,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  }

  target.dispatchEvent(new MouseEvent("mousemove", eventInit));
}

function getLiveVoiceStatusText(status: LiveVoiceStatus, talking: boolean): string {
  if (talking || status === "talking") {
    return "Talking";
  }

  if (status === "connecting") {
    return "Connecting";
  }

  if (status === "error") {
    return "Mic blocked";
  }

  return "Hold V";
}

function stopNativeEvent(event: SyntheticEvent<HTMLElement>) {
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
}

function isElementVisuallyAvailable(
  element: HTMLElement,
  boundary: HTMLElement,
  respectOpacity: boolean,
): boolean {
  let current: HTMLElement | null = element;
  let opacity = 1;

  while (current) {
    const style = getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    ) {
      return false;
    }

    const nextOpacity = Number.parseFloat(style.opacity || "1");
    if (Number.isFinite(nextOpacity)) {
      opacity *= nextOpacity;
    }

    if (current === boundary || (respectOpacity && opacity <= 0.04)) {
      break;
    }

    current = current.parentElement;
  }

  return !respectOpacity || opacity > 0.04;
}

function isUsableRect(rect: DOMRect): boolean {
  return (
    Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 1 && rect.height > 1
  );
}

function rectIntersects(rect: DOMRect, boundary: DOMRect): boolean {
  return (
    rect.right > boundary.left &&
    rect.left < boundary.right &&
    rect.bottom > boundary.top &&
    rect.top < boundary.bottom
  );
}

function isLikelyWholePlayerControlRoot(rect: DOMRect, boundary: DOMRect): boolean {
  return (
    rect.width >= boundary.width * 0.84 &&
    rect.height >= boundary.height * 0.62 &&
    rect.top <= boundary.top + 24
  );
}

function rectCenterY(rect: DOMRect): number {
  return rect.top + rect.height / 2;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function getCrunchyrollMiniPanelMaxHeightPx(
  playerChrome: CrunchyrollPlayerChromeState,
  camStackBottomPx: number,
  ghostCamSizePx: number,
): number | null {
  if (playerChrome.containerHeightPx <= 0) {
    return null;
  }

  const avatarReserveBottomPx = camStackBottomPx + ghostCamSizePx + 18;
  const availableHeight =
    playerChrome.containerHeightPx - playerChrome.miniPanelTopPx - avatarReserveBottomPx;
  const hardMaxHeight = Math.max(96, playerChrome.containerHeightPx - 64);
  return Math.round(Math.min(Math.max(96, availableHeight), hardMaxHeight));
}

function areCrunchyrollPlayerChromeStatesEqual(
  left: CrunchyrollPlayerChromeState,
  right: CrunchyrollPlayerChromeState,
): boolean {
  return (
    left.controlsVisible === right.controlsVisible &&
    left.camStackBottomPx === right.camStackBottomPx &&
    left.containerHeightPx === right.containerHeightPx &&
    left.miniPanelRightPx === right.miniPanelRightPx &&
    left.miniPanelTopPx === right.miniPanelTopPx &&
    left.topBubbleRightPx === right.topBubbleRightPx &&
    left.topBubbleTopPx === right.topBubbleTopPx
  );
}
