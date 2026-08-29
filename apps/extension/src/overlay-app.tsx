import type {
	ActiveRoomConflictResponse,
	ClientEvent,
	P2PSignal,
	Participant,
	PlaybackState,
	ReactionEvent,
	RoomCapabilities,
	RoomUsageSummary,
	ServerEvent,
	WatchSourceDescriptor,
} from "@anidachi/protocol";
import {
	Check,
	CircleHelp,
	Copy,
	LogOut,
	Mic,
	RefreshCw,
	SendHorizontal,
	Settings2,
	SmilePlus,
	UserPlus,
} from "lucide-react";
import type {
	CSSProperties,
	FormEvent,
	PointerEvent,
	KeyboardEvent as ReactKeyboardEvent,
	MouseEvent as ReactMouseEvent,
	WheelEvent as ReactWheelEvent,
	SyntheticEvent,
} from "react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { storage } from "wxt/utils/storage";
import { useActiveAdapterPlayback } from "./active-adapter-playback";
import { AnidachiLogoMark } from "./anidachi-logo-mark";
import { AUTH_TOKENS_KEY, type AuthenticatedUser } from "./auth-tokens";
import { ANIDACHI_BUILD_ID, COMPOSER_EMOJI_PACK } from "./constants";
import { CurrentResourcePanel } from "./current-resource-panel";
import {
	clearDebugLog,
	getCompactDebugLogText,
	getDebugEntries,
	getDebugLogText,
	logDebug,
	playerOverlayGeometryDebugSnapshot,
	roomEventDebugSnapshot,
	videoDebugSnapshot,
} from "./debug-log";
import {
	clearDiagnosticsFromPage,
	type DiagnosticMode,
	saveDiagnosticsFromPage,
} from "./diagnostic-log";
import {
	HOLD_FIRE_SUPER_REACTION_EXPERIMENT,
	normalizeExperimentFlag,
} from "./experiments";
import { type GhostVideo, useGhostCam } from "./ghost-cam";
import {
	getHotkeyAction,
	isPushToTalkReleaseEvent,
	shouldCaptureReactionShortcutEvent,
	shouldStopVoiceTalkOnWindowBlur,
} from "./hotkeys";
import { attachAndPlayVideoElement } from "./media-element-playback";
import type {
	IncomingP2PSignal,
	RoomSendDisposition,
	SignalingTransportReady,
} from "./media-types";
import {
	ANIDACHI_COMPOSER_OPEN_ATTR,
	ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT,
	ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
	isMessageComposerShortcutEvent,
} from "./message-composer-events";
import {
	isWithinOverlayHotkeyBoundary,
	overlayHotkeyBoundaryProps,
	overlayInteractionBoundaryProps,
} from "./overlay-interaction-boundary";
import { InterfaceSettingsPanel } from "./overlay-interface-settings";
import {
	getOverlayChromePlacement,
	shouldShowCameraStack,
} from "./overlay-layout";
import { OverlayLayoutEditor } from "./overlay-layout-editor";
import {
	type OverlayLayoutContext,
	resolveOverlayLayout,
} from "./overlay-layout-engine";
import { OverlayLayoutGhostPreview } from "./overlay-layout-ghost-preview";
import {
	getDefaultOverlayLayoutDefinition,
	normalizeOverlayLayoutDefinition,
	OVERLAY_LAYOUT_MAX_MESSAGES,
	OVERLAY_LAYOUT_STORAGE_KEY_V2,
	OVERLAY_LAYOUT_STORAGE_VERSION,
	type OverlayLayoutDefinition,
	parseOverlayLayoutPreferencesV2,
} from "./overlay-layout-model";
import {
	createOverlayLayoutRuntimeContext,
	getCameraInteractionCorridor,
	getOverlayLayoutCameraSlotCount,
	getOverlayLayoutRuntimeStyles,
	getRoomRailBottomInsetPx,
	getRoomRailRuntimeStyles,
	mergeMaximumPlayerOverlayInsets,
} from "./overlay-layout-runtime";
import {
	DEFAULT_LOCAL_CAMERA_ENABLED,
	getCameraEnabledForRoomConnection,
	getP2PMediaSessionState,
} from "./overlay-media-session";
import {
	shouldDismissOverlayPanel,
	waitForOverlayPaint,
} from "./overlay-panel-interaction";
import {
	ACTIVE_ROOM_CONFLICT_MESSAGE,
	copyRoomInviteText,
	getPrimaryRoomActionKind,
	getPrimaryRoomActionLabel,
	isInviteCopiedFeedback,
	ROOM_ACTION_FEEDBACK_DURATION_MS,
	ROOM_END_CONFIRMATION_DURATION_MS,
	type RoomActionFeedback,
	shouldConfirmRoomEnd,
} from "./overlay-room-action-feedback";
import {
	PanelCameraControl,
	RoomPeopleSection,
} from "./overlay-room-media-controls";
import { RoomRail } from "./overlay-room-rail";
import { useOverlayUnmountCleanup } from "./overlay-unmount-cleanup";
import { VoiceSettingsPanel } from "./overlay-voice-controls";
import {
	createVoiceSessionState,
	getVoiceIndicatorParticipantIds,
	isVoiceSessionPublishing,
	reduceVoiceSession,
	shouldResetPersistedOpenMicAfterMediaSeatLoss,
} from "./overlay-voice-session";
import { PanelAccountTitle } from "./panel-account-title";
import { ParticipantAudioContourControl } from "./participant-audio-controls";
import { PlaybackSyncController } from "./playback-sync-controller";
import {
	isTrustedOverlayActionEvent,
	type PrivilegedOverlayContext,
	requestPrivilegedOverlayAction,
	requestQuotaRoomEnd,
} from "./privileged-overlay-intent";
import {
	REACTION_IDENTITY_CUE_DURATION_MS,
	REACTION_VISIBLE_DURATION_MS,
	ReactionPop,
} from "./reaction-pop";
import { ReactionShortcutEditor } from "./reaction-shortcut-editor";
import {
	parseReactionsEnabled,
	REACTIONS_ENABLED_STORAGE_KEY,
} from "./reaction-shortcuts";
import {
	connectWebsiteRoom,
	createRoom,
	isActiveRoomConflictError,
	isQuotaExhaustedError,
	isTerminalRoomJoinError,
	ROOM_FULL_CLOSE_CODE,
	ROOM_SESSION_TAKEN_OVER_CLOSE_CODE,
	RoomClient,
	type RoomConnectionStatus,
	type RoomQuotaSummary,
} from "./room-client";
import {
	mergeRoomInviteTargetStatus,
	type RoomInviteTargetStatus,
	roomInviteGroupStatus,
	roomInviteTargetStatuses,
	roomInviteTargetStatusLabel,
} from "./room-invite-target-status";
import {
	applyRoomUsageSnapshot,
	roomQuotaRemainingSeconds,
} from "./room-quota-display";
import {
	selectVoiceRailParticipants,
	shouldRenderRoomRail,
} from "./room-rail-intent";
import { getRoomReconnectDelayMs } from "./room-reconnect";
import {
	clearRoomSession,
	discardPreparedRoomSession,
	migrateLegacyRoomSession,
	prepareRoomSession,
	type RoomSessionRecord,
	updateRoomSessionCameraEnabled,
	updateRoomSessionVoiceMode,
} from "./room-session-storage";
import { acquireRoomTabLock, releaseRoomTabLock } from "./room-tab-lock";
import { buildRoomShareableUrl } from "./room-url";
import {
	DEFAULT_SETTINGS_PANEL_CATEGORY,
	SETTINGS_PANEL_CATEGORIES,
	type SettingsPanelCategory,
} from "./settings-panel-navigation";
import { adoptWebsiteSessionWithRetry } from "./silent-session-adoption";
import {
	type CreateRoomInviteInput,
	createRoomInvite,
	type FriendGroup,
	type FriendListItem,
	type InviteTargets,
	listInviteTargets,
	listRoomInvites,
} from "./social-client";
import type { HistoryObservation } from "./source-adapters/core/history-policy";
import {
	arePlayerOverlayGeometriesEqual,
	normalizePlayerOverlayGeometry,
	type PlayerOverlayGeometry,
	type PlayerOverlayInsets,
} from "./source-adapters/core/overlay-geometry";
import { ensureSourceForProvider } from "./source-adapters/core/source-navigation";
import type {
	SourceProvider,
	VideoAdapter,
} from "./source-adapters/core/types";
import { getDefinitionForProvider } from "./source-adapters/registry";
import { overlayStyles } from "./styles";
import { useTopBubbleReveal } from "./top-bubble-reveal";
import { useInterfacePreferences } from "./use-interface-preferences";
import { useReactionShortcuts } from "./use-reaction-shortcuts";
import {
	authErrorMessage,
	type CurrentParticipantResult,
	createCurrentParticipant,
	EXTENSION_CONTEXT_INVALIDATED_MESSAGE,
	isExtensionContextInvalidatedError,
	signInAndCreateParticipant,
	trySilentSignIn,
} from "./user-identity";
import {
	getDefaultParticipantAudioPreference,
	getDefaultVoiceAudioPreferences,
	type ParticipantAudioPreference,
	parseVoiceAudioPreferences,
	resolveVoiceAudioPreferencesForListener,
	updateParticipantAudioPreference,
	type VoiceAudioPreferences,
	voiceAudioPreferencesStorageKeyForUser,
} from "./voice-audio-preferences";
import {
	createWatchHistoryContentReconnectMessage,
	parseWatchHistoryBootstrapData,
	requestWatchHistory,
	type WatchHistoryCaptureResult,
} from "./watch-history-client";
import {
	createWatchHistoryController,
	type WatchHistoryController,
} from "./watch-history-controller";
import { bindWatchHistoryPlaybackListeners } from "./watch-history-listeners";
import { bindWatchHistoryPreferenceListener } from "./watch-history-preference-listener";
import {
	resolveWatchHistoryRuntimeGate,
	shouldRefreshWatchHistoryAuthority,
} from "./watch-history-runtime-policy";

interface OverlayAppProps {
	adapter: VideoAdapter;
	adapterActive?: boolean;
}

interface CatchUpState {
	expectedTime: number;
	drift: number;
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

type ChatDisplayMode = "live" | "history";

interface SettingsRailDragState {
	dragging: boolean;
	pointerId: number;
	startScrollLeft: number;
	startX: number;
	startY: number;
}

interface LiveChatMessage {
	id: string;
	reaction: ReactionEvent;
}

interface VisibleReaction {
	laneIndex: number;
	reaction: ReactionEvent;
}

interface PointerWakePoint {
	clientX: number;
	clientY: number;
	screenX: number;
	screenY: number;
}

interface OverlayViewportSize {
	width: number;
	height: number;
}

type InviteNoticeTone = "error" | "info" | "success";

interface InvitePanelNotice {
	readonly message: string;
	readonly tone: InviteNoticeTone;
}

const CHAT_DISPLAY_MODE_STORAGE_KEY = "local:chatDisplayMode";
const DEFAULT_CHAT_DISPLAY_MODE: ChatDisplayMode = "live";
const LIVE_CHAT_MESSAGE_TTL_MS = 9000;
const LIVE_CHAT_MAX_MESSAGES = OVERLAY_LAYOUT_MAX_MESSAGES;
const CHAT_HISTORY_MAX_MESSAGES = 80;
const SETTINGS_RAIL_DRAG_THRESHOLD_PX = 9;
const SETTINGS_RAIL_HORIZONTAL_INTENT_RATIO = 1.2;
const MESSAGE_COMPOSER_SHIELD_RELEASE_BUFFER_MS = 180;
const SILENT_SIGN_IN_SUPPRESSION_AFTER_SIGN_OUT_MS = 15_000;
const SIGN_OUT_CONFIRMATION_DURATION_MS = ROOM_END_CONFIRMATION_DURATION_MS;
export const TRANSIENT_PANEL_NOTICE_DURATION_MS = 3000;
const INVITE_NOTICE_DURATION_MS: Readonly<Record<InviteNoticeTone, number>> = {
	error: 4500,
	info: 3000,
	success: 3000,
};
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
const FIRE_SUPER_REACTION_MARKER =
	HOLD_FIRE_SUPER_REACTION_EXPERIMENT.transportMarker;
const FIRE_SUPER_DELAY_MS = HOLD_FIRE_SUPER_REACTION_EXPERIMENT.revealDelayMs;
const FIRE_SUPER_CHARGE_MS = HOLD_FIRE_SUPER_REACTION_EXPERIMENT.chargeMs;
const FIRE_SUPER_TOTAL_MS = FIRE_SUPER_DELAY_MS + FIRE_SUPER_CHARGE_MS;
const NUKE_SPARKS = Array.from({ length: 12 }, (_, index) => index);

export function usePlayerOverlayGeometry(
	adapter: VideoAdapter,
	adapterActive = true,
): PlayerOverlayGeometry {
	const [geometry, setGeometry] = useState(() =>
		normalizePlayerOverlayGeometry(adapter.getOverlayGeometry()),
	);
	const geometryRef = useRef(geometry);
	const geometryEffectStartedRef = useRef(false);

	useEffect(() => {
		let disposed = false;
		let unsubscribed = false;
		const isInitialEffect = !geometryEffectStartedRef.current;
		geometryEffectStartedRef.current = true;

		const applyGeometry = (
			candidate: PlayerOverlayGeometry,
			shouldLog = true,
		) => {
			if (disposed) {
				return;
			}

			const normalized = normalizePlayerOverlayGeometry(candidate);
			if (arePlayerOverlayGeometriesEqual(geometryRef.current, normalized)) {
				return;
			}

			geometryRef.current = normalized;
			setGeometry(normalized);
			if (shouldLog) {
				logDebug(
					"overlay.geometry",
					"changed",
					playerOverlayGeometryDebugSnapshot(adapter.id, normalized),
				);
			}
		};

		applyGeometry(adapter.getOverlayGeometry(), !isInitialEffect);
		if (!adapterActive) {
			return () => {
				disposed = true;
			};
		}

		const unsubscribe = adapter.subscribeOverlayGeometry(applyGeometry);
		return () => {
			disposed = true;
			if (unsubscribed) {
				return;
			}
			unsubscribed = true;
			unsubscribe();
		};
	}, [adapter, adapterActive]);

	return geometry;
}

export async function runOverlayPrivilegedAction(
	event: { nativeEvent?: { isTrusted?: unknown } },
	action: "sign-out" | "end-room",
	context: PrivilegedOverlayContext,
	afterApproval: () => Promise<void> | void,
): Promise<void> {
	await requestPrivilegedOverlayAction(event, action, context);
	await afterApproval();
}

export function OverlayApp({ adapter, adapterActive = true }: OverlayAppProps) {
	const quickReactionsHelpId = useId();
	const clientRef = useRef(new RoomClient());
	const adapterActiveRef = useRef(adapterActive);
	adapterActiveRef.current = adapterActive;
	const flameTimersRef = useRef<Record<string, number | undefined>>({});
	const fireHoldRef = useRef<FireHoldState | null>(null);
	const liveChatTimersRef = useRef<Record<string, number | undefined>>({});
	const reactionIdentityCueTimersRef = useRef(new Map<string, number>());
	const reactionLaneCounterByParticipantRef = useRef(new Map<string, number>());
	const reactionVisibleTimersRef = useRef(new Map<string, number>());
	const handledP2PSignalIdsRef = useRef(new Set<string>());
	const lastSeenP2PServerSeqRef = useRef(0);
	const p2pSignalSequenceRef = useRef(0);
	const connectionGenerationRef = useRef(0);
	const roomGenerationRef = useRef(0);
	const sourceGenerationRef = useRef(0);
	const roomSourceProviderRef = useRef<SourceProvider | null>(null);
	const roomReconnectAttemptRef = useRef(0);
	const roomReconnectInFlightRef = useRef(false);
	const roomReconnectSuppressedRef = useRef(false);
	const roomReconnectTimerRef = useRef<number | null>(null);
	const messageComposerFormRef = useRef<HTMLFormElement | null>(null);
	const messageComposerInputRef = useRef<HTMLInputElement | null>(null);
	const messageComposerShieldRef = useRef<HTMLDivElement | null>(null);
	const miniPanelRef = useRef<HTMLElement | null>(null);
	const overlayRootRef = useRef<HTMLDivElement | null>(null);
	const topBubbleRef = useRef<HTMLButtonElement | null>(null);
	const roomActionFeedbackTimerRef = useRef<number | null>(null);
	const transientPanelNoticeTimerRef = useRef<number | null>(null);
	const inviteNoticeTimerRef = useRef<number | null>(null);
	const roomEndConfirmationTimerRef = useRef<number | null>(null);
	const signOutConfirmationTimerRef = useRef<number | null>(null);
	const messageComposerShieldReleaseTimerRef = useRef<number | null>(null);
	const messageComposerShieldReleasePointerRef =
		useRef<PointerWakePoint | null>(null);
	const authUserIdRef = useRef<string | null>(null);
	const authUserIdInitializedRef = useRef(false);
	const suppressSilentSignInUntilRef = useRef(0);
	const [participant, setParticipant] = useState<Participant | null>(null);
	const [identityLoaded, setIdentityLoaded] = useState(false);
	const [authAuthenticated, setAuthAuthenticated] = useState(false);
	const [authAccessToken, setAuthAccessToken] = useState<string | null>(null);
	const [accountUser, setAccountUser] = useState<AuthenticatedUser | null>(
		null,
	);
	const [loadedVoiceAudioPreferences, setLoadedVoiceAudioPreferences] =
		useState<{
			listenerUserId: string | null;
			preferences: VoiceAudioPreferences;
		}>(() => ({
			listenerUserId: null,
			preferences: getDefaultVoiceAudioPreferences(),
		}));
	const loadedVoiceAudioPreferencesRef = useRef(loadedVoiceAudioPreferences);
	const pendingVoiceAudioPreferencesWriteRef = useRef<{
		key: `local:${string}`;
		preferences: VoiceAudioPreferences;
	} | null>(null);
	const voiceAudioPreferencesWriteTimerRef = useRef<number | null>(null);
	const [authBusy, setAuthBusy] = useState(false);
	const [authMessage, setAuthMessage] = useState<string | null>(null);
	const [transientPanelNotice, setTransientPanelNotice] = useState<
		string | null
	>(null);
	const [activeRoomConflict, setActiveRoomConflict] = useState<
		ActiveRoomConflictResponse["activeRoom"] | null
	>(null);
	const [extensionContextInvalidated, setExtensionContextInvalidated] =
		useState(false);
	const [storedRoomSession, setStoredRoomSession] =
		useState<RoomSessionRecord | null>(null);
	const [roomSessionLoadedForUserId, setRoomSessionLoadedForUserId] = useState<
		string | null | undefined
	>(undefined);
	const [roomId, setRoomId] = useState<string | null>(null);
	const [privilegedRoomAuthority, setPrivilegedRoomAuthority] =
		useState<PrivilegedOverlayContext | null>(null);
	const [roomToken, setRoomToken] = useState<string | null>(null);
	const [roomShareableLink, setRoomShareableLink] = useState<string | null>(
		null,
	);
	const [roomQuota, setRoomQuota] = useState<RoomQuotaSummary | null>(null);
	const [roomUsage, setRoomUsage] = useState<RoomUsageSummary | null>(null);
	const roomQuotaRef = useRef<RoomQuotaSummary | null>(null);
	const roomUsageRef = useRef<RoomUsageSummary | null>(null);
	const [roomCapabilities, setRoomCapabilities] =
		useState<RoomCapabilities | null>(null);
	const [quotaDisplayTick, setQuotaDisplayTick] = useState(0);
	const quotaMeteredMsRef = useRef(0);
	const quotaTickAtRef = useRef<number | null>(null);
	const quotaEndTriggeredRef = useRef(false);
	const createRequestIdRef = useRef<string | null>(null);
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [status, setStatus] = useState<RoomConnectionStatus>("idle");
	const [panelOpen, setPanelOpen] = useState(false);
	const [messageComposerOpen, setMessageComposerOpen] = useState(false);
	const [roomCreatePending, setRoomCreatePending] = useState(false);
	const [roomEndConfirmationPending, setRoomEndConfirmationPending] =
		useState(false);
	const [signOutConfirmationPending, setSignOutConfirmationPending] =
		useState(false);
	const [roomEndPending, setRoomEndPending] = useState(false);
	const [roomLeavePending, setRoomLeavePending] = useState(false);
	const [roomActionFeedback, setRoomActionFeedback] =
		useState<RoomActionFeedback | null>(null);
	const [settingsPanelCategory, setSettingsPanelCategory] =
		useState<SettingsPanelCategory>(DEFAULT_SETTINGS_PANEL_CATEGORY);
	const [settingsRailDragging, setSettingsRailDragging] = useState(false);
	const [settingsRailOverflow, setSettingsRailOverflow] = useState({
		left: false,
		right: false,
	});
	const [appliedOverlayLayout, setAppliedOverlayLayout] =
		useState<OverlayLayoutDefinition>(() =>
			getDefaultOverlayLayoutDefinition(),
		);
	const [previewOverlayLayout, setPreviewOverlayLayout] =
		useState<OverlayLayoutDefinition | null>(null);
	const [overlayViewportSize, setOverlayViewportSize] =
		useState<OverlayViewportSize>(() => ({
			height: 0,
			width: 0,
		}));
	const [invitePanelOpen, setInvitePanelOpen] = useState(false);
	const [inviteTargets, setInviteTargets] = useState<InviteTargets | null>(
		null,
	);
	const [inviteTargetsLoading, setInviteTargetsLoading] = useState(false);
	const [inviteSendingTarget, setInviteSendingTarget] = useState<string | null>(
		null,
	);
	const [inviteNotice, setInviteNotice] = useState<InvitePanelNotice | null>(
		null,
	);
	const [inviteTargetStatuses, setInviteTargetStatuses] = useState<
		ReadonlyMap<string, RoomInviteTargetStatus>
	>(() => new Map());
	const inviteActionIdsRef = useRef(new Map<string, string>());
	const inviteStatusRequestEpochRef = useRef(0);
	const inviteStatusMembershipRef = useRef({
		roomId: null as string | null,
		participantCount: 0,
	});
	const [messageComposerGuardActive, setMessageComposerGuardActive] =
		useState(false);
	const [messageComposerShieldActive, setMessageComposerShieldActive] =
		useState(false);
	const [messageComposerShieldReleasing, setMessageComposerShieldReleasing] =
		useState(false);
	const [messageComposerEmojiOpen, setMessageComposerEmojiOpen] =
		useState(false);
	const [messageComposerText, setMessageComposerText] = useState("");
	const [camsEnabled, setCamsEnabled] = useState(DEFAULT_LOCAL_CAMERA_ENABLED);
	const [reactionsEnabled, setReactionsEnabled] = useState(true);
	const reactionsPreferenceRevisionRef = useRef(0);
	const [
		experimentalSuperReactionsEnabled,
		setExperimentalSuperReactionsEnabled,
	] = useState(HOLD_FIRE_SUPER_REACTION_EXPERIMENT.defaultEnabled);
	const [chatDisplayMode, setChatDisplayMode] = useState<ChatDisplayMode>(
		DEFAULT_CHAT_DISPLAY_MODE,
	);
	const socialVisible = true;
	const playerOverlayGeometry = usePlayerOverlayGeometry(
		adapter,
		adapterActive,
	);
	const [maximumObservedPlayerSafeInsets, setMaximumObservedPlayerSafeInsets] =
		useState<PlayerOverlayInsets>(() => ({
			bottomPx: 0,
			leftPx: 0,
			rightPx: 0,
			topPx: 0,
		}));
	const cameraInteractionPlayerSafeInsets =
		playerOverlayGeometry.controlsVisible
			? mergeMaximumPlayerOverlayInsets(
					maximumObservedPlayerSafeInsets,
					playerOverlayGeometry.safeInsets,
				)
			: maximumObservedPlayerSafeInsets;
	useEffect(() => {
		if (!playerOverlayGeometry.controlsVisible) {
			return;
		}

		setMaximumObservedPlayerSafeInsets((current) => {
			const next = mergeMaximumPlayerOverlayInsets(
				current,
				playerOverlayGeometry.safeInsets,
			);
			return next.bottomPx === current.bottomPx &&
				next.leftPx === current.leftPx &&
				next.rightPx === current.rightPx &&
				next.topPx === current.topPx
				? current
				: next;
		});
	}, [
		playerOverlayGeometry.controlsVisible,
		playerOverlayGeometry.safeInsets.bottomPx,
		playerOverlayGeometry.safeInsets.leftPx,
		playerOverlayGeometry.safeInsets.rightPx,
		playerOverlayGeometry.safeInsets.topPx,
	]);
	const [reactions, setReactions] = useState<VisibleReaction[]>([]);
	const [reactionCueParticipantIds, setReactionCueParticipantIds] = useState<
		ReadonlySet<string>
	>(() => new Set());
	const [liveChatMessages, setLiveChatMessages] = useState<LiveChatMessage[]>(
		[],
	);
	const [chatHistoryMessages, setChatHistoryMessages] = useState<
		LiveChatMessage[]
	>([]);
	const [incomingP2PSignals, setIncomingP2PSignals] = useState<
		IncomingP2PSignal[]
	>([]);
	const [roomGeneration, setRoomGeneration] = useState(0);
	const [sourceGeneration, setSourceGeneration] = useState(0);
	const [roomSourceProvider, setRoomSourceProvider] =
		useState<SourceProvider | null>(null);
	const [roomSnapshotReady, setRoomSnapshotReady] = useState(false);
	const [signalingTransportReady, setSignalingTransportReady] =
		useState<SignalingTransportReady | null>(null);
	const [fireCharge, setFireCharge] = useState<FireChargeState | null>(null);
	const [flamingParticipantIds, setFlamingParticipantIds] = useState<string[]>(
		[],
	);
	const [catchUp, setCatchUp] = useState<CatchUpState | null>(null);
	const [playbackSyncNotice, setPlaybackSyncNotice] = useState<string | null>(
		null,
	);
	const [resumeSyncRequired, setResumeSyncRequired] = useState(false);
	const playbackSyncControllerRef = useRef<PlaybackSyncController | null>(null);
	if (!playbackSyncControllerRef.current) {
		playbackSyncControllerRef.current = new PlaybackSyncController({
			ensureRemoteSource: (source, context) =>
				ensureSourceForProvider(source, context, getDefinitionForProvider),
			onStatus: (syncStatus) => {
				if (syncStatus.kind === "out-of-sync") {
					setResumeSyncRequired(false);
					setPlaybackSyncNotice(null);
					setCatchUp({
						drift: syncStatus.drift,
						expectedTime: syncStatus.expectedTime,
					});
					return;
				}
				setCatchUp(null);
				if (syncStatus.kind === "waiting-for-host-ad") {
					setPlaybackSyncNotice("Ad playing · room paused");
				} else if (syncStatus.kind === "watching-local-ad") {
					setPlaybackSyncNotice("Ad playing · sync will resume automatically");
				} else if (syncStatus.kind === "buffering") {
					setPlaybackSyncNotice("Buffering · room paused");
				} else if (syncStatus.kind === "resume-required") {
					setPlaybackSyncNotice("Playback needs your permission");
					setResumeSyncRequired(true);
				} else if (syncStatus.kind === "unsupported-media") {
					setPlaybackSyncNotice("This video cannot be synchronized");
				} else if (syncStatus.kind === "synced") {
					setPlaybackSyncNotice(null);
					setResumeSyncRequired(false);
				}
			},
			transport: {
				send: (event) => clientRef.current.send(event),
			},
		});
	}
	const playbackSyncController = playbackSyncControllerRef.current;
	const [voiceSession, dispatchVoiceSession] = useReducer(
		reduceVoiceSession,
		createVoiceSessionState({
			listenerScope: null,
			localHasMediaSeat: false,
			mode: "push-to-talk",
			roomId: null,
		}),
	);
	const interfacePreferences = useInterfacePreferences();
	const reactionShortcuts = useReactionShortcuts();
	const openMicLauncherVisible =
		voiceSession.mode === "open-mic" && isVoiceSessionPublishing(voiceSession);
	const topBubbleReveal = useTopBubbleReveal({
		bubbleRef: topBubbleRef,
		forceVisible: openMicLauncherVisible,
		mode: interfacePreferences.preferences.mainControlVisibility,
		overlayRef: overlayRootRef,
		panelOpen,
	});
	const [debugEntriesCount, setDebugEntriesCount] = useState(
		() => getDebugEntries().length,
	);
	const [diagnosticStatus, setDiagnosticStatus] = useState<string | null>(null);
	const [currentResourceEntry, setCurrentResourceEntry] =
		useState<HistoryObservation | null>(null);
	const watchHistoryControllerRef = useRef<WatchHistoryController | null>(null);
	const watchHistoryRoomSuppressedRef = useRef(true);
	const watchHistoryAuthContextRef = useRef<{
		ownerUserId: string | null;
		accessToken: string | null;
	} | null>(null);

	const participantRef = useRef<Participant | null>(null);
	const settingsCategoryScrollRef = useRef<HTMLDivElement | null>(null);
	const settingsCategoryButtonRefs = useRef<
		Partial<Record<SettingsPanelCategory, HTMLButtonElement | null>>
	>({});
	const settingsRailDragRef = useRef<SettingsRailDragState | null>(null);
	const settingsRailSuppressClickRef = useRef(false);
	const authAccessTokenRef = useRef<string | null>(null);
	const storedRoomSessionRef = useRef<RoomSessionRecord | null>(null);
	const hydratedVoiceParticipantSessionRef = useRef<string | null>(null);
	const hydratingVoiceModeRef = useRef<"open-mic" | "push-to-talk" | null>(
		null,
	);
	const voiceModePersistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
	const cameraEnabledPersistenceQueueRef = useRef<Promise<void>>(
		Promise.resolve(),
	);
	const roomIdRef = useRef<string | null>(null);
	const roomJoinSequenceRef = useRef(0);
	const roomJoinInFlightRef = useRef<{
		promise: Promise<void>;
		roomId: string;
		sequence: number;
	} | null>(null);
	const pushToTalkHeldRef = useRef(false);
	const microphonePublicationRef = useRef<string | null>(null);
	const roomTokenRef = useRef<string | null>(null);
	const roomShareableLinkRef = useRef<string | null>(null);
	const statusRef = useRef<RoomConnectionStatus>("idle");
	const participantsRef = useRef<Participant[]>([]);
	const handleServerEventRef = useRef<(event: ServerEvent) => void>(
		() => undefined,
	);
	const applyParticipantIdentityRef = useRef<
		(
			result: CurrentParticipantResult,
			reason: string,
			reconnectActiveRoom: boolean,
		) => void
	>(() => undefined);

	const clearRoomActionFeedback = useCallback(() => {
		if (roomActionFeedbackTimerRef.current !== null) {
			window.clearTimeout(roomActionFeedbackTimerRef.current);
			roomActionFeedbackTimerRef.current = null;
		}
		setRoomActionFeedback(null);
	}, []);

	const showRoomActionFeedback = useCallback((feedback: RoomActionFeedback) => {
		if (roomActionFeedbackTimerRef.current !== null) {
			window.clearTimeout(roomActionFeedbackTimerRef.current);
		}
		setRoomActionFeedback(feedback);
		roomActionFeedbackTimerRef.current = window.setTimeout(() => {
			roomActionFeedbackTimerRef.current = null;
			setRoomActionFeedback(null);
		}, ROOM_ACTION_FEEDBACK_DURATION_MS);
	}, []);

	const clearTransientPanelNotice = useCallback(() => {
		if (transientPanelNoticeTimerRef.current !== null) {
			window.clearTimeout(transientPanelNoticeTimerRef.current);
			transientPanelNoticeTimerRef.current = null;
		}
		setTransientPanelNotice(null);
	}, []);

	const showTransientPanelNotice = useCallback((message: string) => {
		if (transientPanelNoticeTimerRef.current !== null) {
			window.clearTimeout(transientPanelNoticeTimerRef.current);
		}
		setTransientPanelNotice(message);
		transientPanelNoticeTimerRef.current = window.setTimeout(() => {
			transientPanelNoticeTimerRef.current = null;
			setTransientPanelNotice(null);
		}, TRANSIENT_PANEL_NOTICE_DURATION_MS);
	}, []);

	const clearInviteNotice = useCallback(() => {
		if (inviteNoticeTimerRef.current !== null) {
			window.clearTimeout(inviteNoticeTimerRef.current);
			inviteNoticeTimerRef.current = null;
		}
		setInviteNotice(null);
	}, []);

	const showInviteNotice = useCallback(
		(message: string, tone: InviteNoticeTone) => {
			if (inviteNoticeTimerRef.current !== null) {
				window.clearTimeout(inviteNoticeTimerRef.current);
			}
			setInviteNotice({ message, tone });
			inviteNoticeTimerRef.current = window.setTimeout(() => {
				inviteNoticeTimerRef.current = null;
				setInviteNotice(null);
			}, INVITE_NOTICE_DURATION_MS[tone]);
		},
		[],
	);

	const clearRoomEndConfirmation = useCallback(() => {
		if (roomEndConfirmationTimerRef.current !== null) {
			window.clearTimeout(roomEndConfirmationTimerRef.current);
			roomEndConfirmationTimerRef.current = null;
		}
		setRoomEndConfirmationPending(false);
	}, []);

	const clearSignOutConfirmation = useCallback(() => {
		if (signOutConfirmationTimerRef.current !== null) {
			window.clearTimeout(signOutConfirmationTimerRef.current);
			signOutConfirmationTimerRef.current = null;
		}
		setSignOutConfirmationPending(false);
	}, []);

	useEffect(
		() => () => {
			if (roomActionFeedbackTimerRef.current !== null) {
				window.clearTimeout(roomActionFeedbackTimerRef.current);
			}
			if (transientPanelNoticeTimerRef.current !== null) {
				window.clearTimeout(transientPanelNoticeTimerRef.current);
			}
			if (inviteNoticeTimerRef.current !== null) {
				window.clearTimeout(inviteNoticeTimerRef.current);
			}
			if (roomEndConfirmationTimerRef.current !== null) {
				window.clearTimeout(roomEndConfirmationTimerRef.current);
			}
			if (signOutConfirmationTimerRef.current !== null) {
				window.clearTimeout(signOutConfirmationTimerRef.current);
			}
			for (const timerId of reactionIdentityCueTimersRef.current.values()) {
				window.clearTimeout(timerId);
			}
			reactionIdentityCueTimersRef.current.clear();
			for (const timerId of reactionVisibleTimersRef.current.values()) {
				window.clearTimeout(timerId);
			}
			reactionVisibleTimersRef.current.clear();
		},
		[],
	);

	const cueReactionParticipant = useCallback((participantId: string) => {
		const currentTimer =
			reactionIdentityCueTimersRef.current.get(participantId);
		if (currentTimer !== undefined) {
			window.clearTimeout(currentTimer);
		}

		setReactionCueParticipantIds((current) => {
			if (current.has(participantId)) {
				return current;
			}
			return new Set([...current, participantId]);
		});

		const timerId = window.setTimeout(() => {
			reactionIdentityCueTimersRef.current.delete(participantId);
			setReactionCueParticipantIds((current) => {
				if (!current.has(participantId)) {
					return current;
				}
				const next = new Set(current);
				next.delete(participantId);
				return next;
			});
		}, REACTION_IDENTITY_CUE_DURATION_MS);
		reactionIdentityCueTimersRef.current.set(participantId, timerId);
	}, []);

	const updateSettingsRailOverflow = useCallback(() => {
		const rail = settingsCategoryScrollRef.current;
		if (!rail) {
			setSettingsRailOverflow((previous) =>
				previous.left || previous.right
					? { left: false, right: false }
					: previous,
			);
			return;
		}

		const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
		const next = {
			left: rail.scrollLeft > 1,
			right: rail.scrollLeft < maxScrollLeft - 1,
		};

		setSettingsRailOverflow((previous) =>
			previous.left === next.left && previous.right === next.right
				? previous
				: next,
		);
	}, []);

	const updateSettingsIndicatorGeometry = useCallback(() => {
		const rail = settingsCategoryScrollRef.current;
		const activeButton =
			settingsCategoryButtonRefs.current[settingsPanelCategory];
		if (!rail || !activeButton) {
			return;
		}

		const railRect = rail.getBoundingClientRect();
		const activeRect = activeButton.getBoundingClientRect();
		const indicatorWidth = activeRect.width;
		if (indicatorWidth <= 0) {
			return;
		}

		const unclampedLeft = activeRect.left - railRect.left + rail.scrollLeft;
		const railWidth = Math.max(rail.scrollWidth, railRect.width);
		const maxLeft = Math.max(0, railWidth - indicatorWidth);
		const indicatorLeft = Math.max(0, Math.min(maxLeft, unclampedLeft));

		rail.style.setProperty("--settings-indicator-left", `${indicatorLeft}px`);
		rail.style.setProperty("--settings-indicator-width", `${indicatorWidth}px`);
	}, [settingsPanelCategory]);

	const handleSettingsCategoryWheel = useCallback(
		(event: ReactWheelEvent<HTMLDivElement>) => {
			const rail = settingsCategoryScrollRef.current;
			if (!rail) {
				return;
			}

			const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
			if (maxScrollLeft <= 0) {
				return;
			}

			const primaryDelta =
				event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
					? event.deltaX
					: event.deltaY;

			if (Math.abs(primaryDelta) < 1) {
				return;
			}

			const atLeftEdge = rail.scrollLeft <= 1;
			const atRightEdge = rail.scrollLeft >= maxScrollLeft - 1;
			if (
				(primaryDelta < 0 && atLeftEdge) ||
				(primaryDelta > 0 && atRightEdge)
			) {
				window.requestAnimationFrame(updateSettingsRailOverflow);
				return;
			}

			const nextScrollLeft = Math.max(
				0,
				Math.min(maxScrollLeft, rail.scrollLeft + primaryDelta),
			);

			if (Math.abs(nextScrollLeft - rail.scrollLeft) < 1) {
				window.requestAnimationFrame(updateSettingsRailOverflow);
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			rail.scrollLeft = nextScrollLeft;
			window.requestAnimationFrame(updateSettingsRailOverflow);
		},
		[updateSettingsRailOverflow],
	);

	const handleSettingsCategoryPointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}

			const rail = settingsCategoryScrollRef.current;
			if (!rail || rail.scrollWidth <= rail.clientWidth) {
				return;
			}

			settingsRailDragRef.current = {
				dragging: false,
				pointerId: event.pointerId,
				startScrollLeft: rail.scrollLeft,
				startX: event.clientX,
				startY: event.clientY,
			};
		},
		[],
	);

	const handleSettingsCategoryPointerMove = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const rail = settingsCategoryScrollRef.current;
			const drag = settingsRailDragRef.current;
			if (!rail || !drag || drag.pointerId !== event.pointerId) {
				return;
			}

			const deltaX = event.clientX - drag.startX;
			const deltaY = event.clientY - drag.startY;
			const horizontalDistance = Math.abs(deltaX);
			const verticalDistance = Math.abs(deltaY);

			if (!drag.dragging) {
				const hasDragDistance =
					horizontalDistance >= SETTINGS_RAIL_DRAG_THRESHOLD_PX;
				const hasHorizontalIntent =
					horizontalDistance >
					verticalDistance * SETTINGS_RAIL_HORIZONTAL_INTENT_RATIO;

				if (!hasDragDistance || !hasHorizontalIntent) {
					return;
				}
			}

			if (!drag.dragging) {
				drag.dragging = true;
				setSettingsRailDragging(true);
				event.currentTarget.setPointerCapture(event.pointerId);
			}

			event.preventDefault();
			rail.scrollLeft = drag.startScrollLeft - deltaX;
			updateSettingsRailOverflow();
		},
		[updateSettingsRailOverflow],
	);

	const handleSettingsCategoryPointerEnd = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const drag = settingsRailDragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) {
				return;
			}

			const wasDragging = drag.dragging;
			settingsRailDragRef.current = null;
			setSettingsRailDragging(false);

			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}

			if (wasDragging) {
				settingsRailSuppressClickRef.current = true;
				window.setTimeout(() => {
					settingsRailSuppressClickRef.current = false;
				}, 0);
			}

			window.requestAnimationFrame(updateSettingsRailOverflow);
		},
		[updateSettingsRailOverflow],
	);

	const handleSettingsCategoryClickCapture = useCallback(
		(event: SyntheticEvent<HTMLDivElement>) => {
			if (!settingsRailSuppressClickRef.current) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
		},
		[],
	);

	useEffect(() => {
		if (!panelOpen) {
			return;
		}

		const rail = settingsCategoryScrollRef.current;
		if (!rail) {
			return;
		}

		const updateRailLayout = () => {
			updateSettingsRailOverflow();
			updateSettingsIndicatorGeometry();
		};
		const handleScroll = () => updateRailLayout();
		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(updateRailLayout);

		rail.addEventListener("scroll", handleScroll, { passive: true });
		resizeObserver?.observe(rail);
		window.addEventListener("resize", updateRailLayout);

		const frameId = window.requestAnimationFrame(updateRailLayout);

		return () => {
			window.cancelAnimationFrame(frameId);
			rail.removeEventListener("scroll", handleScroll);
			resizeObserver?.disconnect();
			window.removeEventListener("resize", updateRailLayout);
		};
	}, [panelOpen, updateSettingsIndicatorGeometry, updateSettingsRailOverflow]);

	useEffect(() => {
		if (!panelOpen) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			const rail = settingsCategoryScrollRef.current;
			const activeButton =
				settingsCategoryButtonRefs.current[settingsPanelCategory];
			if (!rail || !activeButton) {
				updateSettingsRailOverflow();
				return;
			}

			updateSettingsIndicatorGeometry();

			const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
			const categoryIndex = SETTINGS_PANEL_CATEGORIES.findIndex(
				(category) => category.id === settingsPanelCategory,
			);
			let nextScrollLeft = rail.scrollLeft;

			if (categoryIndex === 0) {
				nextScrollLeft = 0;
			} else if (categoryIndex === SETTINGS_PANEL_CATEGORIES.length - 1) {
				nextScrollLeft = maxScrollLeft;
			} else {
				const railRect = rail.getBoundingClientRect();
				const activeRect = activeButton.getBoundingClientRect();
				const leftInset = 14;
				const rightInset = 14;

				if (activeRect.left < railRect.left + leftInset) {
					nextScrollLeft -= railRect.left + leftInset - activeRect.left;
				} else if (activeRect.right > railRect.right - rightInset) {
					nextScrollLeft += activeRect.right - (railRect.right - rightInset);
				}
			}

			rail.scrollLeft = Math.max(0, Math.min(maxScrollLeft, nextScrollLeft));
			updateSettingsRailOverflow();
		});

		return () => window.cancelAnimationFrame(frameId);
	}, [
		panelOpen,
		settingsPanelCategory,
		updateSettingsIndicatorGeometry,
		updateSettingsRailOverflow,
	]);

	useEffect(() => {
		if (!panelOpen) {
			return;
		}

		const handlePointerDown = (event: globalThis.PointerEvent) => {
			const path = event.composedPath();
			const panel = miniPanelRef.current;
			const bubble = topBubbleRef.current;
			const rootNode = panel?.getRootNode();
			const overlayRoot = rootNode instanceof ShadowRoot ? rootNode.host : null;
			if (
				!shouldDismissOverlayPanel({
					busy: roomCreatePending || roomEndPending || roomLeavePending,
					eventPath: path,
					overlayRoot,
					panel,
					topBubble: bubble,
				})
			) {
				return;
			}

			setPanelOpen(false);
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				!isEscapeKey(event) ||
				isFullscreenActive() ||
				roomCreatePending ||
				roomEndPending ||
				roomLeavePending
			) {
				return;
			}

			event.preventDefault();
			topBubbleRef.current?.focus({ preventScroll: true });
			setPanelOpen(false);
		};

		window.addEventListener("pointerdown", handlePointerDown, true);
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("pointerdown", handlePointerDown, true);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [panelOpen, roomCreatePending, roomEndPending, roomLeavePending]);

	useEffect(() => {
		participantRef.current = participant;
	}, [participant]);

	useEffect(() => {
		authAccessTokenRef.current = authAccessToken;
	}, [authAccessToken]);

	useEffect(() => {
		roomIdRef.current = roomId;
		inviteActionIdsRef.current.clear();
		inviteStatusRequestEpochRef.current += 1;
		if (!roomId) {
			setPrivilegedRoomAuthority(null);
			setRoomCapabilities(null);
			setInvitePanelOpen(false);
			setInviteTargets(null);
			setInviteTargetsLoading(false);
			setInviteSendingTarget(null);
			clearInviteNotice();
			setInviteTargetStatuses(new Map());
		}
		handledP2PSignalIdsRef.current.clear();
		lastSeenP2PServerSeqRef.current = 0;
		p2pSignalSequenceRef.current = 0;
		roomGenerationRef.current = 0;
		sourceGenerationRef.current = 0;
		setRoomGeneration(0);
		setSourceGeneration(0);
		if (!roomId) {
			roomSourceProviderRef.current = null;
			setRoomSourceProvider(null);
		} else {
			setRoomSourceProvider(roomSourceProviderRef.current);
		}
		setRoomSnapshotReady(false);
		setSignalingTransportReady(null);
		setIncomingP2PSignals([]);
	}, [clearInviteNotice, roomId]);

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
		loadedVoiceAudioPreferencesRef.current = loadedVoiceAudioPreferences;
	}, [loadedVoiceAudioPreferences]);

	const flushVoiceAudioPreferencesWrite = useCallback(() => {
		if (voiceAudioPreferencesWriteTimerRef.current !== null) {
			window.clearTimeout(voiceAudioPreferencesWriteTimerRef.current);
			voiceAudioPreferencesWriteTimerRef.current = null;
		}
		const pending = pendingVoiceAudioPreferencesWriteRef.current;
		pendingVoiceAudioPreferencesWriteRef.current = null;
		if (!pending) {
			return;
		}

		void storage.setItem(pending.key, pending.preferences).catch((error) => {
			logDebug("p2p.audio-preferences", "persist failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		});
	}, []);

	const commitVoiceAudioPreferences = useCallback(
		(update: (current: VoiceAudioPreferences) => VoiceAudioPreferences) => {
			const listenerUserId = accountUser?.id ?? null;
			const current = loadedVoiceAudioPreferencesRef.current;
			if (!listenerUserId || current.listenerUserId !== listenerUserId) {
				return;
			}

			const preferences = update(current.preferences);
			const next = { listenerUserId, preferences };
			loadedVoiceAudioPreferencesRef.current = next;
			setLoadedVoiceAudioPreferences(next);
			pendingVoiceAudioPreferencesWriteRef.current = {
				key: voiceAudioPreferencesStorageKeyForUser(listenerUserId),
				preferences,
			};
			if (voiceAudioPreferencesWriteTimerRef.current !== null) {
				window.clearTimeout(voiceAudioPreferencesWriteTimerRef.current);
			}
			voiceAudioPreferencesWriteTimerRef.current = window.setTimeout(
				flushVoiceAudioPreferencesWrite,
				120,
			);
		},
		[accountUser?.id, flushVoiceAudioPreferencesWrite],
	);

	useEffect(
		() => () => {
			flushVoiceAudioPreferencesWrite();
		},
		[accountUser?.id, flushVoiceAudioPreferencesWrite],
	);

	const clearStoredRoomSession = useCallback(() => {
		storedRoomSessionRef.current = null;
		setStoredRoomSession(null);
		void clearRoomSession().catch((error) => {
			logDebug("overlay.room", "failed to clear background room session", {
				message: error instanceof Error ? error.message : String(error),
			});
			if (isExtensionContextInvalidatedError(error)) {
				setExtensionContextInvalidated(true);
			}
		});
	}, []);

	useEffect(() => {
		if (!identityLoaded) {
			return;
		}

		let cancelled = false;
		const currentUserId = participant?.id ?? null;
		void migrateLegacyRoomSession(currentUserId)
			.then((record) => {
				if (cancelled) {
					return;
				}

				storedRoomSessionRef.current = record;
				setStoredRoomSession(record);
				setRoomSessionLoadedForUserId(currentUserId);
				logDebug("overlay.room", "background room session ready", {
					hasPersistedRoomSession: Boolean(record),
				});
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				setExtensionContextInvalidated(
					isExtensionContextInvalidatedError(error),
				);
				setAuthMessage(
					authErrorMessage(error, "Failed to initialize Anidachi room state"),
				);
			});
		return () => {
			cancelled = true;
		};
	}, [identityLoaded, participant?.id]);

	useEffect(() => {
		if (!identityLoaded) {
			return;
		}

		const listenerUserId = accountUser?.id ?? null;
		if (!listenerUserId) {
			setLoadedVoiceAudioPreferences({
				listenerUserId: null,
				preferences: getDefaultVoiceAudioPreferences(),
			});
			return;
		}

		let cancelled = false;
		const storageKey = voiceAudioPreferencesStorageKeyForUser(listenerUserId);
		void storage
			.getItem<unknown>(storageKey)
			.then((stored) => {
				if (cancelled) {
					return;
				}
				setLoadedVoiceAudioPreferences({
					listenerUserId,
					preferences: parseVoiceAudioPreferences(stored),
				});
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}
				logDebug("p2p.audio-preferences", "load failed; using safe defaults", {
					error: error instanceof Error ? error.message : String(error),
					listenerUserId,
				});
				setLoadedVoiceAudioPreferences({
					listenerUserId,
					preferences: getDefaultVoiceAudioPreferences(),
				});
			});

		return () => {
			cancelled = true;
		};
	}, [accountUser?.id, identityLoaded]);

	const resetQuotaDisplayElapsed = useCallback(() => {
		quotaMeteredMsRef.current = 0;
		quotaTickAtRef.current = null;
		setQuotaDisplayTick((tick) => tick + 1);
	}, []);

	const updateRoomQuota = useCallback(
		(next: RoomQuotaSummary | null) => {
			const current = roomQuotaRef.current;
			if (
				current?.remainingSeconds === next?.remainingSeconds &&
				current?.resetAt === next?.resetAt
			) {
				return;
			}
			resetQuotaDisplayElapsed();
			roomQuotaRef.current = next;
			setRoomQuota(next);
		},
		[resetQuotaDisplayElapsed],
	);

	const updateRoomUsage = useCallback(
		(incoming: RoomUsageSummary | undefined) => {
			const current = {
				roomUsage: roomUsageRef.current,
				localMeteredMs: quotaMeteredMsRef.current,
			};
			const next = applyRoomUsageSnapshot(current, incoming);
			if (next === current) return;
			quotaMeteredMsRef.current = next.localMeteredMs;
			quotaTickAtRef.current = null;
			roomUsageRef.current = next.roomUsage;
			setRoomUsage(next.roomUsage);
			setQuotaDisplayTick((tick) => tick + 1);
		},
		[],
	);

	const clearRoomQuotaDisplay = useCallback(() => {
		resetQuotaDisplayElapsed();
		roomQuotaRef.current = null;
		roomUsageRef.current = null;
		setRoomQuota(null);
		setRoomUsage(null);
	}, [resetQuotaDisplayElapsed]);

	const resetLocalRoomSession = useCallback(
		(message?: string, openPanel = false) => {
			roomReconnectSuppressedRef.current = true;
			roomJoinSequenceRef.current += 1;
			roomJoinInFlightRef.current = null;
			if (roomReconnectTimerRef.current !== null) {
				window.clearTimeout(roomReconnectTimerRef.current);
				roomReconnectTimerRef.current = null;
			}
			clientRef.current.close();
			releaseRoomTabLock();
			roomIdRef.current = null;
			setRoomId(null);
			setParticipants([]);
			setCamsEnabled(DEFAULT_LOCAL_CAMERA_ENABLED);
			clearRoomQuotaDisplay();
			roomTokenRef.current = null;
			roomShareableLinkRef.current = null;
			setRoomToken(null);
			setRoomShareableLink(null);
			setRoomCapabilities(null);
			clearStoredRoomSession();
			clearRoomHash();
			if (message !== undefined) {
				setAuthMessage(message);
			}
			if (openPanel) {
				setPanelOpen(true);
			}
		},
		[clearRoomQuotaDisplay, clearStoredRoomSession],
	);

	const syncAuthUserScopedState = useCallback(
		(nextAuthUserId: string | null, reason: string) => {
			const previousAuthUserId = authUserIdRef.current;
			const wasInitialized = authUserIdInitializedRef.current;
			authUserIdInitializedRef.current = true;

			if (previousAuthUserId === nextAuthUserId) {
				return;
			}

			authUserIdRef.current = nextAuthUserId;
			if (!wasInitialized || previousAuthUserId === null) {
				return;
			}

			logDebug("identity", "auth user changed; clearing local room session", {
				reason,
				previousAuthUserId,
				nextAuthUserId,
				activeRoomId: roomIdRef.current,
				hasPersistedRoomSession: Boolean(storedRoomSessionRef.current),
			});
			resetLocalRoomSession(undefined, false);
		},
		[resetLocalRoomSession],
	);

	const refreshRoomActionIdentity = useCallback(async (reason: string) => {
		const result = await createCurrentParticipant();
		syncAuthUserScopedState(result.tokens?.user.id ?? null, reason);
		authAccessTokenRef.current = result.tokens?.accessToken ?? null;
		participantRef.current = result.participant;
		setParticipant(result.participant);
		setAuthAuthenticated(result.authenticated);
		setAuthAccessToken(result.tokens?.accessToken ?? null);
		setAccountUser(result.tokens?.user ?? null);
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
		() =>
			participants.find((item) => item.id === participant?.id) ?? participant,
		[participant, participants],
	);
	const visibleParticipants = participants.length
		? participants
		: participant
			? [participant]
			: [];
	const participantCount = participants.length || (participant ? 1 : 0);
	const roomParticipantLimit = roomCapabilities?.maxParticipants ?? 4;
	const roomMediaSeatLimit = roomCapabilities?.maxMediaSeats ?? 4;
	const occupiedMediaSeatCount = visibleParticipants.filter(
		(item) => item.mediaSeat === "joined",
	).length;
	const localMediaSeatState = currentParticipant?.mediaSeat ?? "none";
	const localHasMediaSeat = localMediaSeatState === "joined";
	const localTryingMedia = Boolean(
		camsEnabled && currentParticipant && localHasMediaSeat,
	);
	// Camera bubbles show camera publishers (plus the local placeholder while
	// the camera is starting). Voice-only mesh members deliberately get no
	// bubble — P2P membership lives in useGhostCam, not here.
	const displayedCameraParticipants = currentParticipant
		? visibleParticipants.filter(
				(item) =>
					(item.mediaSeat === "joined" && item.cameraEnabled) ||
					(localTryingMedia && item.id === currentParticipant.id),
			)
		: [];
	const liveMediaAvailable = roomMediaSeatLimit > 0 && localHasMediaSeat;
	const mediaSeatText =
		roomMediaSeatLimit > 0
			? `${Math.min(occupiedMediaSeatCount, roomMediaSeatLimit)}/${roomMediaSeatLimit} media seats`
			: "No live media";
	const mediaSeatSummaryText =
		roomMediaSeatLimit > 0
			? `${Math.min(occupiedMediaSeatCount, roomMediaSeatLimit)}/${roomMediaSeatLimit} media seats`
			: "No media seats";
	const roomPeopleCountText = `${participantCount}/${roomParticipantLimit} in room`;
	const isHost = currentParticipant?.role === "host";
	const signOutPrivilegedContext = useMemo<PrivilegedOverlayContext>(() => {
		const accountUserId = accountUser?.id ?? "";
		return {
			accountUserId,
			roomId: null,
			role: null,
			authorityGeneration: null,
		};
	}, [accountUser?.id]);

	const privilegedRoomContext =
		privilegedRoomAuthority ?? signOutPrivilegedContext;

	useEffect(() => {
		if (!roomId || !isHost) {
			clearRoomEndConfirmation();
		}
	}, [clearRoomEndConfirmation, isHost, roomId]);
	const isConnected = status === "connected";
	const participantAudioPreferenceScope = accountUser?.id ?? null;
	const resolvedVoiceAudioPreferences = useMemo(
		() =>
			resolveVoiceAudioPreferencesForListener(
				loadedVoiceAudioPreferences,
				participantAudioPreferenceScope,
			),
		[loadedVoiceAudioPreferences, participantAudioPreferenceScope],
	);
	const participantAudioPreferencesReady =
		identityLoaded && resolvedVoiceAudioPreferences.ready;
	useEffect(() => {
		dispatchVoiceSession({
			type: "context",
			listenerScope: participantAudioPreferenceScope,
			localHasMediaSeat,
			localMediaSeatAuthoritative: !roomId || roomSnapshotReady,
			roomId,
		});
	}, [
		localHasMediaSeat,
		participantAudioPreferenceScope,
		roomId,
		roomSnapshotReady,
	]);
	useEffect(() => {
		pushToTalkHeldRef.current = voiceSession.pushToTalkHeld;
	}, [voiceSession.pushToTalkHeld]);
	const { p2pSessionActive } = getP2PMediaSessionState({
		localHasMediaSeat,
		participantId: currentParticipant?.id ?? null,
		roomId,
		roomMediaSeatLimit,
		roomSnapshotReady,
		status,
	});
	const activeVoiceRoomSession = useMemo(() => {
		if (
			!storedRoomSession ||
			!roomId ||
			!currentParticipant ||
			storedRoomSession.roomId !== roomId ||
			storedRoomSession.ownerUserId !== currentParticipant.id
		) {
			return null;
		}
		return storedRoomSession;
	}, [currentParticipant, roomId, storedRoomSession]);
	useEffect(() => {
		if (!activeVoiceRoomSession) {
			hydratedVoiceParticipantSessionRef.current = null;
			hydratingVoiceModeRef.current = null;
			return;
		}
		if (
			!p2pSessionActive ||
			hydratedVoiceParticipantSessionRef.current ===
				activeVoiceRoomSession.participantSessionId
		) {
			return;
		}

		hydratedVoiceParticipantSessionRef.current =
			activeVoiceRoomSession.participantSessionId;
		hydratingVoiceModeRef.current = activeVoiceRoomSession.voiceMode;
		pushToTalkHeldRef.current = false;
		dispatchVoiceSession({
			type: "mode",
			mode: activeVoiceRoomSession.voiceMode,
		});
	}, [activeVoiceRoomSession, p2pSessionActive]);

	const enqueueRoomVoiceModePersistence = useCallback(
		(
			mode: "open-mic" | "push-to-talk",
			{ requireHydratedSession = true } = {},
		) => {
			voiceModePersistenceQueueRef.current =
				voiceModePersistenceQueueRef.current
					.catch(() => undefined)
					.then(async () => {
						for (let attempt = 0; attempt < 3; attempt += 1) {
							const expected = storedRoomSessionRef.current;
							const activeParticipantId = participantRef.current?.id ?? null;
							if (
								!expected ||
								(requireHydratedSession &&
									hydratedVoiceParticipantSessionRef.current !==
										expected.participantSessionId) ||
								roomIdRef.current !== expected.roomId ||
								activeParticipantId !== expected.ownerUserId
							) {
								return;
							}
							if (expected.voiceMode === mode) {
								return;
							}

							const next = await updateRoomSessionVoiceMode(expected, mode);
							if (!next) {
								hydratedVoiceParticipantSessionRef.current = null;
								return;
							}

							const stillActive =
								roomIdRef.current === next.roomId &&
								participantRef.current?.id === next.ownerUserId &&
								next.participantSessionId === expected.participantSessionId;
							if (!stillActive) {
								hydratedVoiceParticipantSessionRef.current = null;
								return;
							}

							storedRoomSessionRef.current = next;
							setStoredRoomSession(next);
							if (next.voiceMode === mode) {
								return;
							}
						}

						logDebug(
							"overlay.voice",
							"room-scoped Voice mode did not converge",
							{
								mode,
								roomId: roomIdRef.current,
							},
						);
					})
					.catch((error) => {
						logDebug(
							"overlay.voice",
							"failed to persist room-scoped Voice mode",
							{
								error: error instanceof Error ? error.message : String(error),
								mode,
							},
						);
					});
		},
		[],
	);
	const enqueueRoomCameraEnabledPersistence = useCallback(
		(enabled: boolean) => {
			cameraEnabledPersistenceQueueRef.current =
				cameraEnabledPersistenceQueueRef.current
					.catch(() => undefined)
					.then(async () => {
						for (let attempt = 0; attempt < 3; attempt += 1) {
							const expected = storedRoomSessionRef.current;
							const activeParticipantId = participantRef.current?.id ?? null;
							if (
								!expected ||
								roomIdRef.current !== expected.roomId ||
								activeParticipantId !== expected.ownerUserId
							) {
								return;
							}
							if (expected.cameraEnabled === enabled) {
								return;
							}

							const next = await updateRoomSessionCameraEnabled(
								expected,
								enabled,
							);
							if (!next) {
								return;
							}

							const stillActive =
								roomIdRef.current === next.roomId &&
								participantRef.current?.id === next.ownerUserId &&
								next.participantSessionId === expected.participantSessionId;
							if (!stillActive) {
								return;
							}

							storedRoomSessionRef.current = next;
							setStoredRoomSession(next);
							if (next.cameraEnabled === enabled) {
								return;
							}
						}

						logDebug(
							"overlay.camera",
							"room-scoped camera intent did not converge",
							{ enabled, roomId: roomIdRef.current },
						);
					})
					.catch((error) => {
						logDebug("overlay.camera", "failed to persist camera intent", {
							enabled,
							error: error instanceof Error ? error.message : String(error),
						});
					});
		},
		[],
	);
	useEffect(() => {
		if (
			!activeVoiceRoomSession ||
			hydratedVoiceParticipantSessionRef.current !==
				activeVoiceRoomSession.participantSessionId
		) {
			return;
		}

		const hydratingMode = hydratingVoiceModeRef.current;
		if (hydratingMode !== null) {
			if (voiceSession.mode === hydratingMode) {
				hydratingVoiceModeRef.current = null;
			}
			return;
		}

		enqueueRoomVoiceModePersistence(voiceSession.mode);
	}, [
		activeVoiceRoomSession,
		enqueueRoomVoiceModePersistence,
		voiceSession.mode,
	]);
	useEffect(() => {
		if (
			!activeVoiceRoomSession ||
			!shouldResetPersistedOpenMicAfterMediaSeatLoss({
				localHasMediaSeat,
				persistedVoiceMode: activeVoiceRoomSession.voiceMode,
				roomId,
				roomSnapshotReady,
			})
		) {
			return;
		}

		// A confirmed seat revoke is privacy-terminal even when this document
		// remounted before it could hydrate the persisted Open mic preference.
		hydratedVoiceParticipantSessionRef.current =
			activeVoiceRoomSession.participantSessionId;
		hydratingVoiceModeRef.current = null;
		dispatchVoiceSession({ type: "mode", mode: "push-to-talk" });
		enqueueRoomVoiceModePersistence("push-to-talk", {
			requireHydratedSession: false,
		});
	}, [
		activeVoiceRoomSession,
		enqueueRoomVoiceModePersistence,
		localHasMediaSeat,
		roomId,
		roomSnapshotReady,
	]);
	const messageComposerShieldVisible =
		messageComposerOpen || messageComposerShieldActive;
	const messageComposerShieldLatched =
		messageComposerShieldActive && !messageComposerOpen;
	const messageComposerShieldClassName = [
		"message-composer-shield",
		messageComposerShieldLatched ? "latched" : "",
		messageComposerShieldReleasing ? "releasing" : "",
	]
		.filter(Boolean)
		.join(" ");
	// Worker snapshots own accumulated room usage. The local interval only keeps
	// the display moving between snapshots while host and guest are both live.
	const quotaMeteringActive =
		isConnected && isHost && participantCount > 1 && roomQuota !== null;
	const quotaRemainingSeconds = useMemo(() => {
		if (!roomQuota) {
			return null;
		}
		// quotaDisplayTick advances once per second while metering is active so the
		// countdown re-renders even though the elapsed time lives in a ref.
		return roomQuotaRemainingSeconds({
			serverRemainingSeconds: roomQuota.remainingSeconds,
			resetAt: roomQuota.resetAt,
			roomUsage,
			localMeteredMs: quotaMeteredMsRef.current,
		});
	}, [roomQuota, roomUsage, quotaDisplayTick]);
	const cameraStackVisible = shouldShowCameraStack({
		cameraParticipantCount: displayedCameraParticipants.length,
		p2pSessionActive,
	});
	const displayedChatMessages =
		chatDisplayMode === "history" ? chatHistoryMessages : liveChatMessages;
	const liveChatVisible = displayedChatMessages.length > 0;
	useEffect(() => {
		if (!roomId || !roomSnapshotReady || !camsEnabled) {
			return;
		}

		if (roomMediaSeatLimit <= 0) {
			setCamsEnabled(false);
			enqueueRoomCameraEnabledPersistence(false);
			return;
		}

		if (!localHasMediaSeat) {
			setCamsEnabled(false);
			enqueueRoomCameraEnabledPersistence(false);
		}
	}, [
		camsEnabled,
		enqueueRoomCameraEnabledPersistence,
		localHasMediaSeat,
		roomId,
		roomMediaSeatLimit,
		roomSnapshotReady,
	]);

	const setRoomStatus = useCallback(
		(nextStatus: RoomConnectionStatus) => {
			const previousStatus = statusRef.current;
			logDebug("overlay.status", nextStatus, {
				roomId: roomIdRef.current,
				participantId: participantRef.current?.id,
				video: videoDebugSnapshot(adapter.video),
			});
			if (nextStatus === "connected" && previousStatus !== "connected") {
				connectionGenerationRef.current += 1;
			}
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
		playbackSyncController.setSession({
			connectionGeneration: connectionGenerationRef.current,
			isHost,
			participantId: participant?.id ?? null,
			roomGeneration,
			roomId,
			roomProvider:
				roomId && roomSnapshotReady && status === "connected"
					? roomSourceProvider
					: null,
			sourceGeneration,
		});
	}, [
		isHost,
		participant?.id,
		playbackSyncController,
		roomGeneration,
		roomId,
		roomSnapshotReady,
		roomSourceProvider,
		sourceGeneration,
		status,
	]);

	useEffect(() => {
		const id = window.setInterval(
			() => setDebugEntriesCount(getDebugEntries().length),
			1000,
		);
		return () => window.clearInterval(id);
	}, []);

	useEffect(() => {
		let cancelled = false;

		void storage
			.getItem<unknown>(OVERLAY_LAYOUT_STORAGE_KEY_V2)
			.then((storedPreferences) => {
				if (!cancelled) {
					setAppliedOverlayLayout(
						parseOverlayLayoutPreferencesV2(storedPreferences).layout,
					);
				}
			})
			.catch((error) => {
				if (!cancelled) {
					logDebug("layout", "failed to load V2 preferences", {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		const preferenceRevision = reactionsPreferenceRevisionRef.current;

		void storage
			.getItem<unknown>(REACTIONS_ENABLED_STORAGE_KEY)
			.then((storedValue) => {
				if (
					!cancelled &&
					reactionsPreferenceRevisionRef.current === preferenceRevision
				) {
					setReactionsEnabled(parseReactionsEnabled(storedValue));
				}
			})
			.catch((error) => {
				logDebug("overlay.reactions", "failed to load enabled preference", {
					error: error instanceof Error ? error.message : String(error),
				});
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
						normalizeExperimentFlag(
							storedFlag,
							HOLD_FIRE_SUPER_REACTION_EXPERIMENT.defaultEnabled,
						),
					);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!adapterActive) {
			return;
		}

		let disposed = false;

		const updateViewportSize = () => {
			if (disposed) {
				return;
			}

			const rect = adapter.container.getBoundingClientRect();
			const nextSize = {
				height: normalizeOverlayViewportDimension(rect.height),
				width: normalizeOverlayViewportDimension(rect.width),
			};
			setOverlayViewportSize((current) =>
				current.width === nextSize.width && current.height === nextSize.height
					? current
					: nextSize,
			);
		};

		updateViewportSize();
		const observer =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(updateViewportSize);
		observer?.observe(adapter.container);
		window.addEventListener("resize", updateViewportSize);
		document.addEventListener("fullscreenchange", updateViewportSize, true);

		return () => {
			disposed = true;
			observer?.disconnect();
			window.removeEventListener("resize", updateViewportSize);
			document.removeEventListener(
				"fullscreenchange",
				updateViewportSize,
				true,
			);
		};
	}, [adapter, adapterActive]);

	useEffect(() => {
		let cancelled = false;

		void storage
			.getItem<ChatDisplayMode | string>(CHAT_DISPLAY_MODE_STORAGE_KEY)
			.then((mode) => {
				if (!cancelled && mode !== null) {
					setChatDisplayMode(normalizeChatDisplayMode(mode));
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const handleOverlayLayoutApply = useCallback(
		async (layout: OverlayLayoutDefinition) => {
			const nextLayout = normalizeOverlayLayoutDefinition(layout);
			await storage.setItem(OVERLAY_LAYOUT_STORAGE_KEY_V2, {
				version: OVERLAY_LAYOUT_STORAGE_VERSION,
				layout: nextLayout,
			});
			setAppliedOverlayLayout(nextLayout);
		},
		[],
	);

	const handleOverlayLayoutPreviewChange = useCallback(
		(layout: OverlayLayoutDefinition | null) => {
			setPreviewOverlayLayout(
				layout === null ? null : normalizeOverlayLayoutDefinition(layout),
			);
		},
		[],
	);

	const handleChatDisplayModeChange = useCallback(
		(nextMode: ChatDisplayMode) => {
			setChatDisplayMode(nextMode);
			void storage.setItem(CHAT_DISPLAY_MODE_STORAGE_KEY, nextMode);
		},
		[],
	);

	const handleReactionsEnabledToggle = useCallback(() => {
		const nextEnabled = !reactionsEnabled;
		reactionsPreferenceRevisionRef.current += 1;
		setReactionsEnabled(nextEnabled);
		void storage
			.setItem(REACTIONS_ENABLED_STORAGE_KEY, nextEnabled)
			.catch((error) => {
				logDebug("overlay.reactions", "failed to save enabled preference", {
					error: error instanceof Error ? error.message : String(error),
				});
			});
	}, [reactionsEnabled]);

	useEffect(() => {
		setMessageComposerDomGuard(
			messageComposerOpen || messageComposerGuardActive,
		);
	}, [
		messageComposerGuardActive,
		messageComposerOpen,
		setMessageComposerDomGuard,
	]);

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
		if (!messageComposerOpen) {
			return;
		}

		const form = messageComposerFormRef.current;
		if (!form) {
			return;
		}

		const closeComposer = () => {
			messageComposerInputRef.current?.blur();
			setMessageComposerOpen(false);
			setMessageComposerEmojiOpen(false);
			setMessageComposerText("");
			deactivateMessageComposerGuard();
		};
		const handleRootPointerDown = (event: Event) => {
			const insideComposer = event.composedPath().some((target) => {
				if (target === form) {
					return true;
				}
				const candidate = target as { matches?: (selector: string) => boolean };
				return (
					typeof candidate?.matches === "function" &&
					candidate.matches("form.message-composer")
				);
			});
			if (insideComposer) {
				return;
			}

			event.preventDefault();
			event.stopImmediatePropagation();
			closeComposer();
		};
		const root = form.getRootNode();

		root.addEventListener("pointerdown", handleRootPointerDown, true);

		return () => {
			root.removeEventListener("pointerdown", handleRootPointerDown, true);
		};
	}, [deactivateMessageComposerGuard, messageComposerOpen]);

	useEffect(() => {
		if (!roomId) {
			messageComposerInputRef.current?.blur();
			setMessageComposerOpen(false);
			setMessageComposerEmojiOpen(false);
			setMessageComposerText("");
			deactivateMessageComposerGuard();
		}
	}, [deactivateMessageComposerGuard, roomId]);

	useEffect(() => {
		function refreshWatchHistoryOnFocus(): void {
			void watchHistoryControllerRef.current
				?.refreshAuthority()
				.catch(() => undefined);
		}

		window.addEventListener("focus", refreshWatchHistoryOnFocus);
		return () =>
			window.removeEventListener("focus", refreshWatchHistoryOnFocus);
	}, []);

	const watchHistoryRuntimeGate = resolveWatchHistoryRuntimeGate({
		identityLoaded,
		ownerUserId: participant?.id ?? null,
		roomSessionLoadedForUserId,
		storedRoomSessionOwnerUserId: storedRoomSession?.ownerUserId ?? null,
		roomActive: Boolean(roomId),
	});
	watchHistoryRoomSuppressedRef.current =
		watchHistoryRuntimeGate.roomSuppressed;

	useEffect(() => {
		if (!adapterActive || !watchHistoryRuntimeGate.ready) return;
		const expectedOwnerUserId = participant?.id;
		if (!expectedOwnerUserId) return;
		const definition = getDefinitionForProvider(adapter.provider);
		if (!definition?.historyPolicy) return;
		const controller = createWatchHistoryController({
			getObservation: (preferences) =>
				definition.historyPolicy?.observe({ adapter, preferences }) ?? null,
			getRoomActive: () =>
				watchHistoryRoomSuppressedRef.current || Boolean(roomIdRef.current),
			loadCachedPreferences: async () => {
				const response = await requestWatchHistory({
					type: "ANIDACHI_WATCH_HISTORY_V2",
					command: "bootstrap-cache",
					expectedOwnerUserId,
				});
				if (!response?.ok) return null;
				const loaded = parseWatchHistoryBootstrapData(response.data);
				return loaded?.ownerUserId === expectedOwnerUserId ? loaded : null;
			},
			loadPreferences: async () => {
				const response = await requestWatchHistory({
					type: "ANIDACHI_WATCH_HISTORY_V2",
					command: "bootstrap",
					expectedOwnerUserId,
				});
				if (!response?.ok) return null;
				const loaded = parseWatchHistoryBootstrapData(response.data);
				return loaded?.ownerUserId === expectedOwnerUserId ? loaded : null;
			},
			recoverCapture: async () => {
				const recovered = await requestWatchHistory({
					type: "ANIDACHI_WATCH_HISTORY_V2",
					command: "recover-storage",
				});
				if (!recovered.ok) return null;
				const bootstrapped = await requestWatchHistory({
					type: "ANIDACHI_WATCH_HISTORY_V2",
					command: "bootstrap",
					expectedOwnerUserId,
				});
				if (!bootstrapped.ok) return null;
				const loaded = parseWatchHistoryBootstrapData(bootstrapped.data);
				return loaded?.ownerUserId === expectedOwnerUserId ? loaded : null;
			},
			observeLocally: async (
				event,
				expectedOwnerUserId,
				meaningfulSolo,
				displayMode,
				queueForSync,
				flushNow,
			) => {
				const response = await requestWatchHistory({
					type: "ANIDACHI_WATCH_HISTORY_V2",
					command: "observe-progress",
					expectedOwnerUserId,
					event,
					meaningfulSolo,
					displayMode,
					queueForSync,
					flushNow,
				});
				return response.ok
					? ({ ok: true } as const)
					: (response as WatchHistoryCaptureResult);
			},
			onObservation: setCurrentResourceEntry,
			onRoomHistoryAuthorityState: (state) => {
				logDebug("watch.history", "room authority state", {
					roomId: roomIdRef.current,
					state,
				});
			},
			isPlaying: () => !adapter.video.paused && !adapter.video.ended,
			isSeeking: () => adapter.video.seeking,
		});
		watchHistoryControllerRef.current = controller;
		void controller
			.start()
			.then(async () => {
				await controller.setRoomActive(watchHistoryRoomSuppressedRef.current);
				const retainedRoomAuthority = clientRef.current.historyAuthority;
				if (retainedRoomAuthority?.roomId === roomIdRef.current) {
					await controller.setRoomHistoryAuthority(retainedRoomAuthority);
				}
				await controller.recover();
				await requestWatchHistory(createWatchHistoryContentReconnectMessage());
			})
			.catch(() => undefined);
		const removeHistoryListeners = bindWatchHistoryPlaybackListeners({
			video: adapter.video,
			controller,
		});
		const removeHistoryPreferenceListener = bindWatchHistoryPreferenceListener({
			ownerUserId: expectedOwnerUserId,
			controller,
		});
		return () => {
			removeHistoryPreferenceListener();
			removeHistoryListeners();
			if (watchHistoryControllerRef.current === controller) {
				watchHistoryControllerRef.current = null;
			}
		};
	}, [adapter, adapterActive, participant?.id, watchHistoryRuntimeGate.ready]);

	useEffect(() => {
		const next = {
			ownerUserId: participant?.id ?? null,
			accessToken: authAccessToken,
		};
		const previous = watchHistoryAuthContextRef.current;
		watchHistoryAuthContextRef.current = next;
		if (
			!shouldRefreshWatchHistoryAuthority({
				previous,
				next,
				controllerAvailable: watchHistoryControllerRef.current !== null,
			})
		) {
			return;
		}
		void watchHistoryControllerRef.current
			?.refreshAuthority()
			.catch(() => undefined);
	}, [authAccessToken, participant?.id]);

	useEffect(() => {
		if (!watchHistoryRuntimeGate.ready) return;
		void watchHistoryControllerRef.current
			?.setRoomActive(watchHistoryRuntimeGate.roomSuppressed)
			.catch(() => undefined);
	}, [watchHistoryRuntimeGate.ready, watchHistoryRuntimeGate.roomSuppressed]);

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

	const sendP2PSignal = useCallback(
		(
			toUserId: string,
			signal: P2PSignal,
			senderMediaSessionId: string,
		): RoomSendDisposition => {
			const activeRoomId = roomIdRef.current;
			const activeParticipant = participantRef.current;
			if (
				!activeRoomId ||
				!activeParticipant ||
				toUserId === activeParticipant.id
			) {
				return "dropped";
			}

			const event: ClientEvent = {
				type: "P2P_SIGNAL",
				clientSignalId: createClientSignalId(),
				roomId: activeRoomId,
				fromUserId: activeParticipant.id,
				senderConnectionId: clientRef.current.senderConnectionId,
				senderMediaSessionId,
				toUserId,
				signal,
			};
			if (roomGenerationRef.current > 0) {
				event.roomGeneration = roomGenerationRef.current;
			}
			if (sourceGenerationRef.current > 0) {
				event.sourceGeneration = sourceGenerationRef.current;
			}

			return clientRef.current.send(event);
		},
		[],
	);

	const sendMediaSeatEvent = useCallback((event: ClientEvent) => {
		clientRef.current.send(event);
	}, []);

	const requestMediaSeat = useCallback(
		(userId: string) => {
			const activeRoomId = roomIdRef.current;
			if (!activeRoomId) {
				return;
			}
			sendMediaSeatEvent({
				type: "MEDIA_JOIN_REQUEST",
				roomId: activeRoomId,
				userId,
			});
		},
		[sendMediaSeatEvent],
	);

	const cancelMediaSeatRequest = useCallback(
		(userId: string) => {
			const activeRoomId = roomIdRef.current;
			if (!activeRoomId) {
				return;
			}
			sendMediaSeatEvent({
				type: "MEDIA_JOIN_CANCEL",
				roomId: activeRoomId,
				userId,
			});
		},
		[sendMediaSeatEvent],
	);

	const grantMediaSeat = useCallback(
		(targetUserId: string) => {
			const activeRoomId = roomIdRef.current;
			if (!activeRoomId) {
				return;
			}
			sendMediaSeatEvent({
				type: "MEDIA_SEAT_GRANT",
				roomId: activeRoomId,
				targetUserId,
			});
		},
		[sendMediaSeatEvent],
	);

	const revokeMediaSeat = useCallback(
		(targetUserId: string) => {
			const activeRoomId = roomIdRef.current;
			if (!activeRoomId) {
				return;
			}
			sendMediaSeatEvent({
				type: "MEDIA_SEAT_REVOKE",
				roomId: activeRoomId,
				targetUserId,
			});
		},
		[sendMediaSeatEvent],
	);

	const handleGhostCamToggle = useCallback(() => {
		const nextEnabled = !camsEnabled;
		if (nextEnabled && roomIdRef.current && roomMediaSeatLimit <= 0) {
			showTransientPanelNotice("Live media is not available in this room.");
			setPanelOpen(true);
			return;
		}

		if (nextEnabled && roomIdRef.current && !localHasMediaSeat) {
			showTransientPanelNotice(
				localMediaSeatState === "requested"
					? "Waiting for the host to approve live media."
					: "Ask the host for a live media seat before turning on camera.",
			);
			setPanelOpen(true);
			return;
		}

		clearTransientPanelNotice();
		setCamsEnabled(nextEnabled);
		enqueueRoomCameraEnabledPersistence(nextEnabled);
	}, [
		camsEnabled,
		clearTransientPanelNotice,
		enqueueRoomCameraEnabledPersistence,
		localHasMediaSeat,
		localMediaSeatState,
		roomMediaSeatLimit,
		showTransientPanelNotice,
	]);

	const ghostCamSession = useGhostCam({
		cameraEnabled: camsEnabled,
		connected: p2pSessionActive,
		incomingP2PSignals,
		participants: visibleParticipants,
		roomId,
		roomToken,
		roomGeneration,
		sourceGeneration,
		participant,
		onCameraStatus: sendCameraStatus,
		participantAudioPreferenceScope,
		participantAudioPreferences:
			resolvedVoiceAudioPreferences.preferences.participantAudio,
		participantAudioPreferencesReady,
		sendP2PSignal,
		signalingTransportReady,
	});
	const handleVoiceModeChange = useCallback(
		(mode: "open-mic" | "push-to-talk") => {
			if (
				mode === "open-mic" &&
				(!roomId || !localHasMediaSeat || !p2pSessionActive)
			) {
				showTransientPanelNotice(
					!roomId
						? "Join a room before enabling Open mic."
						: localMediaSeatState === "requested"
							? "Waiting for the host to approve live media."
							: "A live media seat is required for Open mic.",
				);
				return;
			}

			clearTransientPanelNotice();
			pushToTalkHeldRef.current = false;
			dispatchVoiceSession({ type: "mode", mode });
		},
		[
			clearTransientPanelNotice,
			localHasMediaSeat,
			localMediaSeatState,
			p2pSessionActive,
			roomId,
			showTransientPanelNotice,
		],
	);
	const handleParticipantAudioChange = useCallback(
		(targetParticipantId: string, preference: ParticipantAudioPreference) => {
			ghostCamSession.setParticipantAudioOutput(
				targetParticipantId,
				preference,
			);
			commitVoiceAudioPreferences((current) =>
				updateParticipantAudioPreference(
					current,
					targetParticipantId,
					preference,
				),
			);
		},
		[commitVoiceAudioPreferences, ghostCamSession.setParticipantAudioOutput],
	);
	const getParticipantAudioPreference = useCallback(
		(targetParticipantId: string): ParticipantAudioPreference =>
			resolvedVoiceAudioPreferences.preferences.participantAudio[
				targetParticipantId
			] ?? getDefaultParticipantAudioPreference(),
		[resolvedVoiceAudioPreferences.preferences.participantAudio],
	);
	const ghostVideos = ghostCamSession.videos;
	const cameraVideoByParticipantId = useMemo(
		() => new Map(ghostVideos.map((video) => [video.participantId, video])),
		[ghostVideos],
	);
	const renderableCameraParticipants = useMemo(
		() =>
			displayedCameraParticipants.filter((item) =>
				cameraVideoByParticipantId.has(item.id),
			),
		[cameraVideoByParticipantId, displayedCameraParticipants],
	);
	const mountedCameraParticipantIds = useMemo(
		() =>
			new Set(
				(cameraStackVisible ? renderableCameraParticipants : []).map(
					(item) => item.id,
				),
			),
		[cameraStackVisible, renderableCameraParticipants],
	);
	const voiceRailParticipants = useMemo(
		() =>
			selectVoiceRailParticipants(
				visibleParticipants,
				mountedCameraParticipantIds,
			),
		[mountedCameraParticipantIds, visibleParticipants],
	);
	const roomRailVisible = shouldRenderRoomRail({
		participantCount: voiceRailParticipants.length,
		panelOpen,
		roomActive: Boolean(roomId),
	});
	const playerBottomInsetPx = playerOverlayGeometry.safeInsets.bottomPx;
	const overlayChromePlacement = getOverlayChromePlacement(
		playerOverlayGeometry,
	);
	const overlayLayoutPreviewActive = previewOverlayLayout !== null;
	const overlayLayoutCameraCount = overlayLayoutPreviewActive
		? 4
		: getOverlayLayoutCameraSlotCount(
				cameraStackVisible ? renderableCameraParticipants.length : 0,
			);
	const overlayLayoutViewportHeight =
		overlayViewportSize.height || playerOverlayGeometry.viewport.heightPx;
	const overlayLayoutViewportWidth =
		overlayViewportSize.width || playerOverlayGeometry.viewport.widthPx;
	const roomRailBottomPx = getRoomRailBottomInsetPx({
		playerBottomInsetPx,
		viewportHeight: overlayLayoutViewportHeight,
	});
	const overlayLayoutRuntimeContext = useMemo<OverlayLayoutContext>(
		() =>
			createOverlayLayoutRuntimeContext({
				cameraCount: overlayLayoutCameraCount,
				height: overlayLayoutViewportHeight,
				playerSafeInsets: playerOverlayGeometry.safeInsets,
				safePaddingPx: 12,
				width: overlayLayoutViewportWidth,
			}),
		[
			overlayLayoutCameraCount,
			overlayLayoutViewportHeight,
			overlayLayoutViewportWidth,
			playerOverlayGeometry.safeInsets,
		],
	);
	const resolvedOverlayLayout = useMemo(
		() =>
			resolveOverlayLayout(
				previewOverlayLayout ?? appliedOverlayLayout,
				overlayLayoutRuntimeContext,
			),
		[appliedOverlayLayout, overlayLayoutRuntimeContext, previewOverlayLayout],
	);
	const cameraInteractionCorridor = useMemo(() => {
		const definition = previewOverlayLayout ?? appliedOverlayLayout;
		const controlsHiddenLayout = resolveOverlayLayout(
			definition,
			createOverlayLayoutRuntimeContext({
				cameraCount: overlayLayoutCameraCount,
				height: overlayLayoutViewportHeight,
				safePaddingPx: 12,
				width: overlayLayoutViewportWidth,
			}),
		);
		const maximumControlsLayout = resolveOverlayLayout(
			definition,
			createOverlayLayoutRuntimeContext({
				cameraCount: overlayLayoutCameraCount,
				height: overlayLayoutViewportHeight,
				playerSafeInsets: cameraInteractionPlayerSafeInsets,
				safePaddingPx: 12,
				width: overlayLayoutViewportWidth,
			}),
		);

		return getCameraInteractionCorridor(
			[
				resolvedOverlayLayout.video.bounds,
				controlsHiddenLayout.video.bounds,
				maximumControlsLayout.video.bounds,
			],
			{
				height: overlayLayoutViewportHeight,
				width: overlayLayoutViewportWidth,
			},
		);
	}, [
		appliedOverlayLayout,
		cameraInteractionPlayerSafeInsets,
		overlayLayoutCameraCount,
		overlayLayoutViewportHeight,
		overlayLayoutViewportWidth,
		previewOverlayLayout,
		resolvedOverlayLayout.video.bounds,
	]);
	const cameraControlDisabledReason =
		roomMediaSeatLimit <= 0
			? "Live media is not available in this room"
			: localMediaSeatState === "requested"
				? "Waiting for the host to approve media access"
				: "Media seat required";
	const overlayCssVariables = {
		...getOverlayLayoutRuntimeStyles(resolvedOverlayLayout),
		...getRoomRailRuntimeStyles({
			height: overlayLayoutViewportHeight,
			width: overlayLayoutViewportWidth,
		}),
		"--cam-stack-height": `${resolvedOverlayLayout.video.bounds.height}px`,
		"--cam-stack-width": `${resolvedOverlayLayout.video.bounds.width}px`,
		"--cam-interaction-corridor-height": `${cameraInteractionCorridor.height}px`,
		"--cam-interaction-corridor-left": `${cameraInteractionCorridor.x}px`,
		"--cam-interaction-corridor-top": `${cameraInteractionCorridor.y}px`,
		"--cam-interaction-corridor-width": `${cameraInteractionCorridor.width}px`,
		"--mini-panel-bottom-reserve": `${overlayChromePlacement.miniPanelBottomReservePx}px`,
		"--mini-panel-right": `${overlayChromePlacement.miniPanelRightPx}px`,
		"--mini-panel-top": `${overlayChromePlacement.miniPanelTopPx}px`,
		"--top-bubble-right": `${overlayChromePlacement.topBubbleRightPx}px`,
		"--top-bubble-top": `${overlayChromePlacement.topBubbleTopPx}px`,
		"--room-rail-bottom": `${roomRailBottomPx}px`,
	} as CSSProperties;
	const overlayClassName = [
		"anidachi-overlay",
		playerOverlayGeometry.controlsVisible ? "player-controls-visible" : "",
	]
		.filter(Boolean)
		.join(" ");
	const liveVoiceActiveSpeakerIds = ghostCamSession.activeSpeakerIds;
	const voiceIndicatorParticipantIds = useMemo(
		() =>
			getVoiceIndicatorParticipantIds({
				localParticipantId: participant?.id ?? null,
				measuredSpeakerIds: liveVoiceActiveSpeakerIds,
				state: voiceSession,
			}),
		[liveVoiceActiveSpeakerIds, participant?.id, voiceSession],
	);
	const localLiveVoiceActive = Boolean(
		participant?.id && liveVoiceActiveSpeakerIds.includes(participant.id),
	);
	const microphonePublishingWanted = isVoiceSessionPublishing(voiceSession);

	const isCurrentHost = useCallback((list = participantsRef.current) => {
		const current = participantRef.current;
		return Boolean(
			current && list.find((item) => item.id === current.id)?.role === "host",
		);
	}, []);

	const triggerFlameBurst = useCallback(
		(participantId: string | undefined, durationMs = 3200) => {
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
				setFlamingParticipantIds((current) =>
					current.filter((id) => id !== participantId),
				);
			}, durationMs);
		},
		[],
	);

	const enqueueLiveChatMessage = useCallback((reaction: ReactionEvent) => {
		const timerId = liveChatTimersRef.current[reaction.id];
		if (timerId !== undefined) {
			window.clearTimeout(timerId);
		}

		setLiveChatMessages((current) =>
			[
				...current.filter((item) => item.id !== reaction.id),
				{ id: reaction.id, reaction },
			].slice(-LIVE_CHAT_MAX_MESSAGES),
		);

		liveChatTimersRef.current[reaction.id] = window.setTimeout(() => {
			delete liveChatTimersRef.current[reaction.id];
			setLiveChatMessages((current) =>
				current.filter((item) => item.id !== reaction.id),
			);
		}, LIVE_CHAT_MESSAGE_TTL_MS);
	}, []);

	const recordChatHistoryMessage = useCallback((reaction: ReactionEvent) => {
		setChatHistoryMessages((current) =>
			[
				...current.filter((item) => item.id !== reaction.id),
				{ id: reaction.id, reaction },
			].slice(-CHAT_HISTORY_MAX_MESSAGES),
		);
	}, []);

	const applyHostState = useCallback(
		async (state: PlaybackState, source?: WatchSourceDescriptor) => {
			if (!adapterActiveRef.current) {
				return;
			}
			await playbackSyncController.handleHostState(state, source);
		},
		[playbackSyncController],
	);

	// Terminally end the local room session without a reconnect loop: used for
	// server-terminal errors (ROOM_FULL / SESSION_TAKEN_OVER) and for graceful
	// free-quota expiry, so the overlay settles on a clear message instead of
	// jittering between connect attempts.
	const terminateRoomSession = useCallback(
		(message: string) => {
			roomReconnectSuppressedRef.current = true;
			if (roomReconnectTimerRef.current !== null) {
				window.clearTimeout(roomReconnectTimerRef.current);
				roomReconnectTimerRef.current = null;
			}
			clientRef.current.close();
			releaseRoomTabLock();
			roomIdRef.current = null;
			setRoomId(null);
			setParticipants([]);
			setCamsEnabled(false);
			setIncomingP2PSignals([]);
			clearRoomQuotaDisplay();
			setRoomSnapshotReady(false);
			setSignalingTransportReady(null);
			roomTokenRef.current = null;
			roomShareableLinkRef.current = null;
			setRoomToken(null);
			setRoomShareableLink(null);
			setRoomCapabilities(null);
			clearStoredRoomSession();
			clearRoomHash();
			setAuthMessage(message);
			setPanelOpen(true);
		},
		[clearRoomQuotaDisplay, clearStoredRoomSession],
	);

	const handleServerEvent = useCallback(
		(event: ServerEvent) => {
			logDebug("overlay.server", event.type, {
				event: roomEventDebugSnapshot(event),
				localParticipantId: participantRef.current?.id,
				isHost: isCurrentHost(),
				video: videoDebugSnapshot(adapter.video),
			});

			switch (event.type) {
				case "ROOM_ENDED":
					terminateRoomSession("Watch room ended.");
					return;
				case "ROOM_SNAPSHOT": {
					if (
						isStaleAuthoritativeGeneration(
							roomGenerationRef.current,
							sourceGenerationRef.current,
							event.roomGeneration,
							event.sourceGeneration,
						)
					) {
						logDebug("sync.source", "ignored stale room snapshot", {
							currentRoomGeneration: roomGenerationRef.current,
							currentSourceGeneration: sourceGenerationRef.current,
							receivedRoomGeneration: event.roomGeneration,
							receivedSourceGeneration: event.sourceGeneration,
						});
						return;
					}
					if (
						roomGenerationRef.current > 0 &&
						(roomGenerationRef.current !== event.roomGeneration ||
							sourceGenerationRef.current !== event.sourceGeneration)
					) {
						handledP2PSignalIdsRef.current.clear();
						lastSeenP2PServerSeqRef.current = 0;
						p2pSignalSequenceRef.current = 0;
						setIncomingP2PSignals([]);
						logDebug("p2p.signal", "reset on generation change", {
							fromRoomGeneration: roomGenerationRef.current,
							fromSourceGeneration: sourceGenerationRef.current,
							toRoomGeneration: event.roomGeneration,
							toSourceGeneration: event.sourceGeneration,
						});
					}
					roomGenerationRef.current = event.roomGeneration;
					sourceGenerationRef.current = event.sourceGeneration;
					const currentRoomProvider = roomSourceProviderRef.current;
					const snapshotSourceProvider = event.source?.provider ?? null;
					const snapshotProvider =
						currentRoomProvider ?? snapshotSourceProvider;
					if (
						currentRoomProvider &&
						snapshotSourceProvider &&
						currentRoomProvider !== snapshotSourceProvider
					) {
						logDebug(
							"sync.source",
							"ignored conflicting room snapshot provider",
							{
								currentRoomProvider,
								snapshotSourceProvider,
								roomId: event.roomId,
							},
						);
					}
					roomSourceProviderRef.current = snapshotProvider;
					setRoomGeneration(event.roomGeneration);
					setSourceGeneration(event.sourceGeneration);
					setRoomSourceProvider(snapshotProvider);
					setParticipants(event.participants);
					updateRoomUsage(event.roomUsage);
					if (event.capabilities) {
						setRoomCapabilities(event.capabilities);
					}
					setRoomSnapshotReady(true);
					playbackSyncController.setSession({
						connectionGeneration: connectionGenerationRef.current,
						isHost: isCurrentHost(event.participants),
						participantId: participantRef.current?.id ?? null,
						roomGeneration: event.roomGeneration,
						roomId: event.roomId,
						roomProvider: snapshotProvider,
						sourceGeneration: event.sourceGeneration,
					});
					if (event.hostState && !isCurrentHost(event.participants)) {
						void applyHostState(event.hostState, event.source);
					}
					return;
				}
				case "SOURCE_CHANGED": {
					if (
						isStaleAuthoritativeGeneration(
							roomGenerationRef.current,
							sourceGenerationRef.current,
							event.roomGeneration,
							event.sourceGeneration,
						)
					) {
						logDebug("sync.source", "ignored stale source change", {
							currentRoomGeneration: roomGenerationRef.current,
							currentSourceGeneration: sourceGenerationRef.current,
							receivedRoomGeneration: event.roomGeneration,
							receivedSourceGeneration: event.sourceGeneration,
						});
						return;
					}
					if (
						roomGenerationRef.current > 0 &&
						(roomGenerationRef.current !== event.roomGeneration ||
							sourceGenerationRef.current !== event.sourceGeneration)
					) {
						handledP2PSignalIdsRef.current.clear();
						lastSeenP2PServerSeqRef.current = 0;
						p2pSignalSequenceRef.current = 0;
						setIncomingP2PSignals([]);
						logDebug("p2p.signal", "reset on source change", {
							fromRoomGeneration: roomGenerationRef.current,
							fromSourceGeneration: sourceGenerationRef.current,
							toRoomGeneration: event.roomGeneration,
							toSourceGeneration: event.sourceGeneration,
							source: event.source,
							previousSource: event.previousSource,
						});
					}
					roomGenerationRef.current = event.roomGeneration;
					sourceGenerationRef.current = event.sourceGeneration;
					const sourceChangedProvider =
						roomSourceProviderRef.current ?? event.source.provider;
					if (
						roomSourceProviderRef.current &&
						roomSourceProviderRef.current !== event.source.provider
					) {
						logDebug(
							"sync.source",
							"ignored conflicting source-change provider",
							{
								currentRoomProvider: roomSourceProviderRef.current,
								receivedProvider: event.source.provider,
								roomId: event.roomId,
							},
						);
					}
					roomSourceProviderRef.current = sourceChangedProvider;
					setRoomGeneration(event.roomGeneration);
					setSourceGeneration(event.sourceGeneration);
					setRoomSourceProvider(sourceChangedProvider);
					playbackSyncController.setSession({
						connectionGeneration: connectionGenerationRef.current,
						isHost: isCurrentHost(),
						participantId: participantRef.current?.id ?? null,
						roomGeneration: event.roomGeneration,
						roomId: event.roomId,
						roomProvider: sourceChangedProvider,
						sourceGeneration: event.sourceGeneration,
					});
					if (!isCurrentHost()) {
						void applyHostState(event.hostState, event.source);
					}
					return;
				}
				case "PARTICIPANT_JOINED":
					setParticipants((current) => [
						...current.filter((item) => item.id !== event.participant.id),
						event.participant,
					]);
					return;
				case "PARTICIPANT_LEFT":
					setParticipants((current) =>
						current.filter((item) => item.id !== event.participant.id),
					);
					return;
				case "HOST_STATE":
					if (!isCurrentHost()) {
						void applyHostState(event.state);
					}
					return;
				case "PLAY":
					playbackSyncController.handleRemoteCommand(event);
					return;
				case "PAUSE":
					playbackSyncController.handleRemoteCommand(event);
					return;
				case "SEEK":
					playbackSyncController.handleRemoteCommand(event);
					return;
				case "P2P_SIGNAL": {
					if (
						event.toUserId !== participantRef.current?.id ||
						event.fromUserId === participantRef.current?.id
					) {
						return;
					}

					if (
						(roomGenerationRef.current > 0 &&
							event.roomGeneration !== roomGenerationRef.current) ||
						(sourceGenerationRef.current > 0 &&
							event.sourceGeneration !== sourceGenerationRef.current)
					) {
						logDebug("p2p.signal", "drop stale generation", {
							clientSignalId: event.clientSignalId,
							eventRoomGeneration: event.roomGeneration,
							eventSourceGeneration: event.sourceGeneration,
							roomGeneration: roomGenerationRef.current,
							sourceGeneration: sourceGenerationRef.current,
						});
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
				case "REACTION": {
					if (event.reaction.text) {
						recordChatHistoryMessage(event.reaction);
						if (chatDisplayMode === "live") {
							enqueueLiveChatMessage(event.reaction);
						}
						return;
					}
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
					cueReactionParticipant(event.reaction.userId);
					const nextLaneIndex =
						reactionLaneCounterByParticipantRef.current.get(
							event.reaction.userId,
						) ?? 0;
					reactionLaneCounterByParticipantRef.current.set(
						event.reaction.userId,
						(nextLaneIndex + 1) % 4,
					);
					setReactions((current) => [
						...current,
						{ laneIndex: nextLaneIndex, reaction: event.reaction },
					]);
					const visibleTimerId = window.setTimeout(() => {
						reactionVisibleTimersRef.current.delete(event.reaction.id);
						setReactions((current) =>
							current.filter((item) => item.reaction.id !== event.reaction.id),
						);
					}, REACTION_VISIBLE_DURATION_MS);
					reactionVisibleTimersRef.current.set(
						event.reaction.id,
						visibleTimerId,
					);
					return;
				}
				case "ERROR":
					console.warn("[Anidachi] Room error", event.code, event.message);
					if (
						event.code === "MEDIA_SEATS_FULL" ||
						event.code === "MEDIA_SEAT_REQUIRED" ||
						event.code === "MEDIA_UNAVAILABLE"
					) {
						setCamsEnabled(false);
						enqueueRoomCameraEnabledPersistence(false);
						setAuthMessage(
							event.message ||
								"No live media seats are available in this room.",
						);
						setPanelOpen(true);
						return;
					}
					if (
						event.code === "ROOM_FULL" ||
						event.code === "SESSION_TAKEN_OVER"
					) {
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
			adapter.id,
			adapter.video,
			applyHostState,
			cueReactionParticipant,
			isCurrentHost,
			chatDisplayMode,
			enqueueLiveChatMessage,
			enqueueRoomCameraEnabledPersistence,
			experimentalSuperReactionsEnabled,
			playbackSyncController,
			recordChatHistoryMessage,
			reactionsEnabled,
			terminateRoomSession,
			triggerFlameBurst,
			updateRoomUsage,
		],
	);

	useEffect(() => {
		handleServerEventRef.current = handleServerEvent;
	}, [handleServerEvent]);

	const connectToRoomAsParticipant = useCallback(
		async (
			nextRoomId: string,
			activeParticipant: Participant,
			nextRoomToken: string,
			nextStoredRoomSession: RoomSessionRecord,
			isCurrentJoin: () => boolean,
			createdRoomProvider: SourceProvider | null = null,
		): Promise<boolean> => {
			if (!isCurrentJoin()) {
				return false;
			}

			roomReconnectSuppressedRef.current = false;
			if (roomReconnectTimerRef.current !== null) {
				window.clearTimeout(roomReconnectTimerRef.current);
				roomReconnectTimerRef.current = null;
			}

			const sameRoomReconnect = roomIdRef.current === nextRoomId;
			if (!sameRoomReconnect) {
				roomSourceProviderRef.current = createdRoomProvider;
				setRoomSourceProvider(createdRoomProvider);
				handledP2PSignalIdsRef.current.clear();
				lastSeenP2PServerSeqRef.current = 0;
				p2pSignalSequenceRef.current = 0;
				setIncomingP2PSignals([]);
			}

			setRoomSnapshotReady(false);
			setSignalingTransportReady(null);
			if (
				nextStoredRoomSession.roomId !== nextRoomId ||
				nextStoredRoomSession.ownerUserId !== activeParticipant.id
			) {
				releaseRoomTabLock();
				throw new Error("Room admission returned a mismatched tab session");
			}
			if (!isCurrentJoin()) {
				logDebug("overlay.room", "confirmed session ignored for stale join", {
					roomId: nextRoomId,
					participantId: activeParticipant.id,
				});
				return false;
			}

			setCamsEnabled((currentCameraEnabled) =>
				getCameraEnabledForRoomConnection({
					currentCameraEnabled,
					persistedCameraEnabled: nextStoredRoomSession.cameraEnabled,
					sameRoomReconnect,
				}),
			);
			storedRoomSessionRef.current = nextStoredRoomSession;
			setStoredRoomSession(nextStoredRoomSession);
			setRoomSessionLoadedForUserId(activeParticipant.id);
			roomReconnectSuppressedRef.current = false;
			setActiveRoomConflict(null);
			roomIdRef.current = nextRoomId;
			setRoomId(nextRoomId);
			ensureRoomHash(nextRoomId);
			logDebug("overlay.room", "connect requested", {
				roomId: nextRoomId,
				authenticated: true,
				participantId: activeParticipant.id,
				fingerprint: adapter.getFingerprint(),
				video: videoDebugSnapshot(adapter.video),
			});
			clientRef.current.connect({
				lastSeenP2PServerSeq: sameRoomReconnect
					? lastSeenP2PServerSeqRef.current
					: 0,
				participantSessionId: nextStoredRoomSession.participantSessionId,
				reconnect: sameRoomReconnect,
				roomId: nextRoomId,
				roomToken: nextRoomToken,
				participant: activeParticipant,
				videoFingerprint: adapter.getFingerprint(),
				onEvent: (event) => handleServerEventRef.current(event),
				onStatus: setRoomStatus,
				onHistoryAuthority: (authority) => {
					void watchHistoryControllerRef.current
						?.setRoomHistoryAuthority(authority)
						.catch(() => undefined);
				},
				onTerminalClose: (code) =>
					terminateRoomSession(roomTerminalCloseMessage(code)),
				onTransportReady: setSignalingTransportReady,
			});
			return true;
		},
		[adapter, setRoomStatus, terminateRoomSession],
	);

	const connectToExistingWebsiteRoom = useCallback(
		async (nextRoomId: string, reason: string) => {
			const skipActiveConnection = () => {
				const activeRoomId = roomIdRef.current;
				const activeStatus = statusRef.current;
				if (
					activeRoomId === nextRoomId &&
					(activeStatus === "connected" || activeStatus === "connecting")
				) {
					logDebug("overlay.room", "join skipped for active room connection", {
						reason,
						roomId: nextRoomId,
						status: activeStatus,
					});
					return true;
				}

				return false;
			};

			if (skipActiveConnection()) {
				return;
			}

			const existingJoin = roomJoinInFlightRef.current;
			if (existingJoin?.roomId === nextRoomId) {
				logDebug("overlay.room", "join skipped for in-flight room connection", {
					reason,
					roomId: nextRoomId,
				});
				return existingJoin.promise;
			}

			const joinSequence = roomJoinSequenceRef.current + 1;
			roomJoinSequenceRef.current = joinSequence;
			logDebug("overlay.room", "join started", {
				reason,
				roomId: nextRoomId,
				sequence: joinSequence,
			});

			const isCurrentJoin = () =>
				roomJoinInFlightRef.current?.sequence === joinSequence &&
				roomJoinInFlightRef.current.roomId === nextRoomId;

			const skipStaleJoin = (stage: string) => {
				if (isCurrentJoin()) {
					return false;
				}

				logDebug("overlay.room", "join skipped for stale room connection", {
					reason,
					roomId: nextRoomId,
					stage,
				});
				return true;
			};

			const joinPromise = (async () => {
				const refreshed = await refreshRoomActionIdentity(`join:${reason}`);
				if (skipStaleJoin("identity") || skipActiveConnection()) {
					return;
				}

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

				let preparedRoomSession: Awaited<
					ReturnType<typeof prepareRoomSession>
				> | null = null;
				let connected: Awaited<ReturnType<typeof connectWebsiteRoom>>;
				try {
					preparedRoomSession = await prepareRoomSession(
						activeParticipant.id,
						nextRoomId,
					);
					if (skipStaleJoin("session-prepared") || skipActiveConnection()) {
						await discardPreparedRoomSession(preparedRoomSession);
						return;
					}
					connected = await connectWebsiteRoom(
						nextRoomId,
						activeAccessToken,
						preparedRoomSession,
					);
				} catch (error) {
					if (preparedRoomSession) {
						await discardPreparedRoomSession(preparedRoomSession).catch(
							() => undefined,
						);
					}
					throw error;
				}

				if (skipStaleJoin("room-token") || skipActiveConnection()) {
					return;
				}

				roomTokenRef.current = connected.roomToken;
				setRoomToken(connected.roomToken);
				setPrivilegedRoomAuthority(connected.privilegedRoomAuthority ?? null);
				setRoomCapabilities(connected.capabilities ?? null);
				updateRoomQuota(connected.quota ?? null);
				const shareableLink = buildRoomShareableUrl(nextRoomId);
				roomShareableLinkRef.current = shareableLink;
				setRoomShareableLink(shareableLink);
				await connectToRoomAsParticipant(
					nextRoomId,
					activeParticipant,
					connected.roomToken,
					connected.roomSession,
					() =>
						isCurrentJoin() &&
						participantRef.current?.id === activeParticipant.id,
				);
			})();

			roomJoinInFlightRef.current = {
				promise: joinPromise,
				roomId: nextRoomId,
				sequence: joinSequence,
			};

			try {
				await joinPromise;
			} finally {
				if (roomJoinInFlightRef.current?.sequence === joinSequence) {
					roomJoinInFlightRef.current = null;
				}
			}
		},
		[connectToRoomAsParticipant, refreshRoomActionIdentity, updateRoomQuota],
	);

	/*
	 * createAndConnectRoom owns the active room transition. If an invite auto-join
	 * is still resolving, invalidate it so it cannot connect after room creation.
	 */
	const cancelPendingRoomJoin = useCallback(() => {
		roomJoinSequenceRef.current += 1;
		roomJoinInFlightRef.current = null;
	}, []);

	const clearRoomReconnectTimer = useCallback(() => {
		if (roomReconnectTimerRef.current === null) {
			return;
		}

		window.clearTimeout(roomReconnectTimerRef.current);
		roomReconnectTimerRef.current = null;
	}, []);

	const showActiveRoomConflict = useCallback(
		(error: unknown): boolean => {
			if (!isActiveRoomConflictError(error)) {
				return false;
			}

			roomReconnectSuppressedRef.current = true;
			clearRoomReconnectTimer();
			setActiveRoomConflict(error.activeRoom);
			setAuthMessage(
				activeRoomConflictMessage(error.activeRoom.provider, adapter.provider),
			);
			setPanelOpen(true);
			return true;
		},
		[adapter.provider, clearRoomReconnectTimer],
	);

	const scheduleRoomReconnect = useCallback(
		(reason: string) => {
			if (
				roomReconnectSuppressedRef.current ||
				roomReconnectTimerRef.current !== null
			) {
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
						if (showActiveRoomConflict(error)) {
							logDebug(
								"overlay.room",
								"auto reconnect found another active room",
								{
									attemptedRoomId: reconnectRoomId,
								},
							);
							return;
						}

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

						const message =
							error instanceof Error ? error.message : "Room reconnect failed";
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
		[
			connectToExistingWebsiteRoom,
			showActiveRoomConflict,
			terminateRoomSession,
		],
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

	useEffect(() => {
		quotaEndTriggeredRef.current = false;
	}, [roomId, roomQuota?.resetAt]);

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
		if (
			!quotaMeteringActive ||
			quotaRemainingSeconds === null ||
			quotaRemainingSeconds > 0
		) {
			return;
		}
		if (quotaEndTriggeredRef.current) {
			return;
		}

		quotaEndTriggeredRef.current = true;
		const exhaustedRoomId = roomIdRef.current;
		logDebug("overlay.room", "free host quota exhausted; ending session", {
			resetAt: roomQuota?.resetAt ?? null,
			roomId: exhaustedRoomId,
		});
		if (exhaustedRoomId) {
			void (async () => {
				try {
					await requestQuotaRoomEnd(privilegedRoomContext);
					logDebug("overlay.room", "quota exhausted room ended on server", {
						roomId: exhaustedRoomId,
					});
				} catch (error) {
					logDebug("overlay.room", "quota exhausted server end failed", {
						roomId: exhaustedRoomId,
						message: error instanceof Error ? error.message : String(error),
					});
				}
			})();
		}
		terminateRoomSession(quotaExhaustedMessage(roomQuota?.resetAt));
	}, [
		quotaMeteringActive,
		quotaRemainingSeconds,
		privilegedRoomContext,
		roomQuota,
		terminateRoomSession,
	]);

	const applyParticipantIdentity = useCallback(
		(
			result: CurrentParticipantResult,
			reason: string,
			reconnectActiveRoom: boolean,
		) => {
			const activeRoomId = roomIdRef.current;
			const previousUserId = participantRef.current?.id ?? null;
			const nextUserId = result.participant?.id ?? null;
			if (previousUserId !== nextUserId) {
				setActiveRoomConflict(null);
			}
			syncAuthUserScopedState(result.tokens?.user.id ?? null, reason);
			authAccessTokenRef.current = result.tokens?.accessToken ?? null;
			participantRef.current = result.participant;
			setParticipant(result.participant);
			setAuthAuthenticated(result.authenticated);
			setAuthAccessToken(result.tokens?.accessToken ?? null);
			setAccountUser(result.tokens?.user ?? null);
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
			applyParticipantIdentity(
				await signInAndCreateParticipant(),
				"sign-in",
				true,
			);
		} catch (error) {
			setExtensionContextInvalidated(isExtensionContextInvalidatedError(error));
			setAuthMessage(authErrorMessage(error, "Sign in failed"));
		} finally {
			setAuthBusy(false);
		}
	}, [applyParticipantIdentity]);

	const handleSignOut = useCallback(
		async (event: ReactMouseEvent<HTMLButtonElement>) => {
			if (!isTrustedOverlayActionEvent(event)) {
				return;
			}
			if (!signOutConfirmationPending) {
				setSignOutConfirmationPending(true);
				if (signOutConfirmationTimerRef.current !== null) {
					window.clearTimeout(signOutConfirmationTimerRef.current);
				}
				signOutConfirmationTimerRef.current = window.setTimeout(() => {
					signOutConfirmationTimerRef.current = null;
					setSignOutConfirmationPending(false);
				}, SIGN_OUT_CONFIRMATION_DURATION_MS);
				return;
			}
			clearSignOutConfirmation();
			setAuthBusy(true);
			setAuthMessage(null);
			try {
				await runOverlayPrivilegedAction(
					event,
					"sign-out",
					signOutPrivilegedContext,
					async () => {
						suppressSilentSignInUntilRef.current =
							Date.now() + SILENT_SIGN_IN_SUPPRESSION_AFTER_SIGN_OUT_MS;
						roomReconnectSuppressedRef.current = true;
						clearRoomReconnectTimer();
						applyParticipantIdentity(
							await createCurrentParticipant(),
							"sign-out",
							false,
						);
						clientRef.current.close();
						releaseRoomTabLock();
						roomIdRef.current = null;
						setRoomId(null);
						setParticipants([]);
						setCamsEnabled(DEFAULT_LOCAL_CAMERA_ENABLED);
						clearRoomQuotaDisplay();
						setRoomCapabilities(null);
					},
				);
			} catch (error) {
				setExtensionContextInvalidated(
					isExtensionContextInvalidatedError(error),
				);
				setAuthMessage(authErrorMessage(error, "Sign out failed"));
			} finally {
				setAuthBusy(false);
			}
		},
		[
			applyParticipantIdentity,
			clearSignOutConfirmation,
			clearRoomQuotaDisplay,
			clearRoomReconnectTimer,
			signOutConfirmationPending,
			signOutPrivilegedContext,
		],
	);

	useEffect(() => {
		if (!panelOpen || !authAuthenticated) {
			clearSignOutConfirmation();
		}
	}, [authAuthenticated, clearSignOutConfirmation, panelOpen]);

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
		return () => {
			disposed = true;
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
				logDebug(
					"identity",
					"panel-open silent sign-in suppressed after explicit sign-out",
					{
						retryAfterMs: suppressSilentSignInUntilRef.current - Date.now(),
					},
				);
				return;
			}

			const adopted = await adoptWebsiteSessionWithRetry({
				initialResult: result,
				readCurrentIdentity: () => createCurrentParticipant(),
				trySilentSignIn,
				shouldContinue: () =>
					!cancelled &&
					document.visibilityState !== "hidden" &&
					Date.now() >= suppressSilentSignInUntilRef.current,
				onAttempt: (attempt) => {
					if (
						attempt.reason === "silent-miss" ||
						attempt.reason === "current-miss"
					) {
						logDebug("identity", "panel-open silent adoption retry", {
							reason: attempt.reason,
						});
					}
				},
			});
			if (
				cancelled ||
				(!adopted.result?.authenticated && !adopted.result?.requiresPageReload)
			) {
				return;
			}

			applyParticipantIdentityRef.current(
				adopted.result,
				`panel-open-${adopted.reason}`,
				true,
			);
		});

		return () => {
			cancelled = true;
		};
	}, [adapter, identityLoaded, panelOpen]);

	const createAndConnectRoom = useCallback(
		async (reason: string) => {
			if (roomIdRef.current) {
				logDebug("overlay.room", "create skipped while room is active", {
					reason,
					roomId: roomIdRef.current,
				});
				return null;
			}

			cancelPendingRoomJoin();
			const createSequence = roomJoinSequenceRef.current;
			const isCurrentCreate = () =>
				roomJoinSequenceRef.current === createSequence;
			const refreshed = await refreshRoomActionIdentity(`create:${reason}`);
			if (!isCurrentCreate()) {
				return null;
			}
			const activeParticipant = refreshed.participant;
			const activeAccessToken = refreshed.accessToken;
			if (!activeParticipant || !activeAccessToken) {
				setPanelOpen(true);
				setAuthMessage("Sign in to create Anidachi rooms.");
				logDebug("overlay.room", "create skipped without participant", {
					reason,
				});
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
			if (!isCurrentCreate()) {
				return null;
			}

			// Idempotency key survives retries of the same create attempt and is
			// cleared only on success, so a network retry reuses the same room.
			createRequestIdRef.current ??= crypto.randomUUID();
			let preparedRoomSession: Awaited<
				ReturnType<typeof prepareRoomSession>
			> | null = null;
			let created: Awaited<ReturnType<typeof createRoom>>;
			try {
				preparedRoomSession = await prepareRoomSession(
					activeParticipant.id,
					null,
				);
				if (!isCurrentCreate()) {
					await discardPreparedRoomSession(preparedRoomSession);
					return null;
				}
				created = await createRoom(activeAccessToken, preparedRoomSession, {
					sourceUrl: buildCurrentSourceUrlForInvite(),
					videoFingerprint: adapter.getFingerprint(),
					title: adapter.getTitle() ?? document.title,
					clientRequestId: createRequestIdRef.current,
				});
			} catch (error) {
				if (preparedRoomSession) {
					await discardPreparedRoomSession(preparedRoomSession).catch(
						() => undefined,
					);
				}
				if (isCurrentCreate()) {
					releaseRoomTabLock();
				}
				throw error;
			}
			createRequestIdRef.current = null;
			if (!isCurrentCreate()) {
				return null;
			}
			clearRoomQuotaDisplay();
			updateRoomQuota(created.quota ?? null);
			setRoomCapabilities(created.capabilities ?? null);
			if (roomIdRef.current) {
				return null;
			}

			const nextRoomToken = created.roomToken;
			const nextShareableLink =
				created.shareableLink || buildRoomShareableUrl(created.roomId);
			roomTokenRef.current = nextRoomToken;
			roomShareableLinkRef.current = nextShareableLink;
			setRoomToken(nextRoomToken);
			setRoomShareableLink(nextShareableLink);
			setPrivilegedRoomAuthority(created.privilegedRoomAuthority ?? null);
			logDebug("overlay.room", "created", {
				reason,
				roomId: created.roomId,
				reused: created.reused === true,
				authenticated: true,
				participantId: activeParticipant.id,
			});
			setRoomHash(created.roomId);
			const connected = await connectToRoomAsParticipant(
				created.roomId,
				activeParticipant,
				nextRoomToken,
				created.roomSession,
				() =>
					isCurrentCreate() &&
					participantRef.current?.id === activeParticipant.id,
				adapter.provider,
			);
			return connected ? created : null;
		},
		[
			adapter,
			cancelPendingRoomJoin,
			clearRoomQuotaDisplay,
			connectToRoomAsParticipant,
			refreshRoomActionIdentity,
			updateRoomQuota,
		],
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
				logDebug(
					"identity",
					"initial silent sign-in suppressed after explicit sign-out",
					{
						retryAfterMs: suppressSilentSignInUntilRef.current - Date.now(),
					},
				);
				return;
			}

			const adopted = await adoptWebsiteSessionWithRetry({
				initialResult: result,
				readCurrentIdentity: () => createCurrentParticipant(),
				trySilentSignIn,
				shouldContinue: () =>
					!cancelled &&
					document.visibilityState !== "hidden" &&
					Date.now() >= suppressSilentSignInUntilRef.current,
				onAttempt: (attempt) => {
					if (
						attempt.reason === "silent-miss" ||
						attempt.reason === "current-miss"
					) {
						logDebug("identity", "initial silent adoption retry", {
							reason: attempt.reason,
						});
					}
				},
			});
			if (
				cancelled ||
				(!adopted.result?.authenticated && !adopted.result?.requiresPageReload)
			) {
				return;
			}

			logDebug("identity", "silent website session adopted", {
				participantId: adopted.result.participant?.id ?? null,
				reason: adopted.reason,
			});
			applyParticipantIdentityRef.current(adopted.result, adopted.reason, true);
			setIdentityLoaded(true);
		});
		return () => {
			cancelled = true;
			clientRef.current.close();
			releaseRoomTabLock();
		};
	}, []);

	useEffect(() => {
		const currentUserId = participant?.id ?? null;
		if (
			!identityLoaded ||
			roomSessionLoadedForUserId !== currentUserId ||
			roomId ||
			roomIdRef.current
		) {
			return;
		}

		const hashRoomId = getRoomIdFromHash();
		const persistedRoomId =
			storedRoomSession?.ownerUserId === currentUserId
				? storedRoomSession.roomId
				: null;
		const initialRoomId = hashRoomId ?? persistedRoomId;
		if (initialRoomId) {
			if (!participant) {
				setAuthMessage("Sign in to join Anidachi rooms.");
				setPanelOpen(true);
				return;
			}

			void connectToExistingWebsiteRoom(
				initialRoomId,
				hashRoomId ? "hash" : "persisted",
			).catch((error) => {
				if (showActiveRoomConflict(error)) {
					logDebug("overlay.room", "initial join found another active room", {
						attemptedRoomId: initialRoomId,
					});
					return;
				}

				// Quota is exhausted — drop the stale room pointer so reloads stop
				// re-attempting a join that can only fail, and show why.
				if (isQuotaExhaustedError(error)) {
					logDebug("overlay.room", "initial join blocked by quota", {
						roomId: initialRoomId,
						resetAt: error.resetAt,
					});
					clearStoredRoomSession();
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
					clearStoredRoomSession();
					clearRoomHash();
					releaseRoomTabLock();
					setAuthMessage(roomJoinUnavailableMessage(error));
					setPanelOpen(true);
					return;
				}

				const message =
					error instanceof Error ? error.message : "Failed to join room";
				logDebug("overlay.room", "initial join failed", {
					roomId: initialRoomId,
					message,
				});
				setAuthMessage(message);
				setPanelOpen(true);
			});
			setPanelOpen(shouldOpenPanelForInitialRoom(hashRoomId, persistedRoomId));
		}
	}, [
		clearStoredRoomSession,
		connectToExistingWebsiteRoom,
		identityLoaded,
		participant,
		roomId,
		roomSessionLoadedForUserId,
		showActiveRoomConflict,
		storedRoomSession,
	]);

	useActiveAdapterPlayback({
		active: adapterActive,
		adapter,
		controller: playbackSyncController,
	});

	const handleCreateRoom = async () => {
		if (roomCreatePending) {
			return;
		}

		if (extensionContextInvalidated) {
			setAuthMessage(EXTENSION_CONTEXT_INVALIDATED_MESSAGE);
			return;
		}

		if (!participant) {
			logDebug("overlay.room", "create skipped without participant");
			return;
		}

		clearRoomActionFeedback();
		setRoomCreatePending(true);
		setPanelOpen(true);
		setAuthMessage(null);
		try {
			await waitForOverlayPaint();
			const created = await createAndConnectRoom("manual");
			if (created) {
				showRoomActionFeedback("room-created");
			}
		} catch (error) {
			if (showActiveRoomConflict(error)) {
				logDebug("overlay.room", "create found another active room");
				return;
			}

			if (isQuotaExhaustedError(error)) {
				logDebug("overlay.room", "create blocked by quota", {
					resetAt: error.resetAt,
				});
				setAuthMessage(quotaExhaustedMessage(error.resetAt));
				return;
			}

			const message = authErrorMessage(error, "Failed to create room");
			logDebug("overlay.room", "manual create failed", { message });
			setExtensionContextInvalidated(isExtensionContextInvalidatedError(error));
			setAuthMessage(message);
		} finally {
			setRoomCreatePending(false);
		}
	};

	const handleOpenActiveRoom = async () => {
		const conflict = activeRoomConflict;
		if (!conflict || roomCreatePending) {
			return;
		}
		if (conflict.provider && conflict.provider !== adapter.provider) {
			setAuthMessage(
				activeRoomConflictMessage(conflict.provider, adapter.provider),
			);
			return;
		}

		setRoomCreatePending(true);
		try {
			await connectToExistingWebsiteRoom(
				conflict.roomId,
				"active-room-conflict",
			);
			setActiveRoomConflict(null);
			setAuthMessage(null);
		} catch (error) {
			if (showActiveRoomConflict(error)) {
				return;
			}
			const message = authErrorMessage(error, "Failed to open active room");
			logDebug("overlay.room", "active room open failed", {
				roomId: conflict.roomId,
				message,
			});
			setAuthMessage(message);
		} finally {
			setRoomCreatePending(false);
		}
	};

	const handleEndRoom = async (event: ReactMouseEvent<HTMLButtonElement>) => {
		if (!isTrustedOverlayActionEvent(event)) {
			return;
		}
		if (roomEndPending) {
			return;
		}

		clearRoomActionFeedback();
		clearRoomEndConfirmation();
		setRoomEndPending(true);
		try {
			const activeRoomId = roomIdRef.current;
			if (!activeRoomId || !isHost) {
				return;
			}

			await runOverlayPrivilegedAction(
				event,
				"end-room",
				privilegedRoomContext,
				() => {
					roomReconnectSuppressedRef.current = true;
					clearRoomReconnectTimer();
					clientRef.current.close();
					releaseRoomTabLock();
					roomIdRef.current = null;
					setRoomId(null);
					setPrivilegedRoomAuthority(null);
					setParticipants([]);
					setCamsEnabled(DEFAULT_LOCAL_CAMERA_ENABLED);
					clearRoomQuotaDisplay();
					setRoomCapabilities(null);
					roomTokenRef.current = null;
					roomShareableLinkRef.current = null;
					setRoomToken(null);
					setRoomShareableLink(null);
					clearStoredRoomSession();
					clearRoomHash();
					setAuthMessage(null);
					showRoomActionFeedback("room-closed");
					logDebug("overlay.room", "ended by host", { roomId: activeRoomId });
				},
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to end room";
			logDebug("overlay.room", "end failed", {
				roomId: roomIdRef.current,
				message,
			});
			setAuthMessage(message);
		} finally {
			setRoomEndPending(false);
		}
	};

	const handleRequestEndRoom = async (
		event: ReactMouseEvent<HTMLButtonElement>,
	) => {
		if (!isTrustedOverlayActionEvent(event)) {
			return;
		}
		if (roomEndPending || !roomId || !isHost) {
			return;
		}

		if (shouldConfirmRoomEnd(participantCount) && !roomEndConfirmationPending) {
			setRoomEndConfirmationPending(true);
			if (roomEndConfirmationTimerRef.current !== null) {
				window.clearTimeout(roomEndConfirmationTimerRef.current);
			}
			roomEndConfirmationTimerRef.current = window.setTimeout(() => {
				roomEndConfirmationTimerRef.current = null;
				setRoomEndConfirmationPending(false);
			}, ROOM_END_CONFIRMATION_DURATION_MS);
			return;
		}

		await handleEndRoom(event);
	};

	const handleLeaveRoom = async () => {
		if (roomLeavePending || !roomId || isHost) {
			return;
		}

		clearRoomActionFeedback();
		setRoomLeavePending(true);
		setPanelOpen(true);
		setAuthMessage(null);
		try {
			await waitForOverlayPaint();
			const activeRoomId = roomIdRef.current;
			if (!activeRoomId || isCurrentHost()) {
				return;
			}

			resetLocalRoomSession(undefined, true);
			showRoomActionFeedback("room-left");
			logDebug("overlay.room", "left by guest", { roomId: activeRoomId });
		} finally {
			setRoomLeavePending(false);
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

		const invite =
			roomShareableLinkRef.current ?? buildRoomShareableUrl(roomId);
		const copied = await copyRoomInviteText(
			invite,
			async (text) => {
				if (!navigator.clipboard) {
					throw new Error("Clipboard API unavailable");
				}
				await navigator.clipboard.writeText(text);
			},
			fallbackCopy,
		);
		if (!copied) {
			setAuthMessage("Could not copy the invite link.");
			logDebug("overlay.invite", "copy failed", { roomId });
			return;
		}

		showRoomActionFeedback("invite-copied");
		logDebug("overlay.invite", "copied", { roomId, invite });
	};

	const loadInviteTargetsForRoom = useCallback(async () => {
		const activeRoomId = roomIdRef.current;
		setInviteTargetsLoading(true);
		clearInviteNotice();
		if (!activeRoomId) {
			setPanelOpen(true);
			showInviteNotice("Create a room before inviting friends.", "error");
			setInviteTargetsLoading(false);
			return;
		}
		const statusRequestEpoch = ++inviteStatusRequestEpochRef.current;

		try {
			const accessToken = await getFreshAuthAccessToken("invite-targets");
			if (!accessToken) {
				showInviteNotice("Sign in to invite friends.", "error");
				return;
			}
			if (roomIdRef.current !== activeRoomId) return;

			const [targets, inviteResult] = await Promise.all([
				listInviteTargets(accessToken),
				listRoomInvites(accessToken)
					.then((invites) => ({ ok: true as const, invites }))
					.catch((error: unknown) => ({ ok: false as const, error })),
			]);
			if (roomIdRef.current !== activeRoomId) return;
			setInviteTargets(targets);
			if (
				inviteResult.ok &&
				inviteStatusRequestEpochRef.current === statusRequestEpoch
			) {
				setInviteTargetStatuses(
					roomInviteTargetStatuses(inviteResult.invites.sent, activeRoomId),
				);
			} else if (
				!inviteResult.ok &&
				inviteStatusRequestEpochRef.current === statusRequestEpoch
			) {
				showInviteNotice(
					"Could not refresh invite status. Showing the latest available status.",
					"error",
				);
				logDebug("overlay.invite", "status refresh failed", {
					roomId: activeRoomId,
					message: authErrorMessage(
						inviteResult.error,
						"Failed to load invite status",
					),
				});
			}
			logDebug("overlay.invite", "targets loaded", {
				friendCount: targets.friends.length,
				groupCount: targets.groups.length,
			});
		} catch (error) {
			if (roomIdRef.current !== activeRoomId) return;
			const message = authErrorMessage(error, "Failed to load invite targets");
			showInviteNotice(message, "error");
			logDebug("overlay.invite", "targets failed", { message });
		} finally {
			if (roomIdRef.current === activeRoomId) {
				setInviteTargetsLoading(false);
			}
		}
	}, [clearInviteNotice, getFreshAuthAccessToken, showInviteNotice]);

	const refreshInviteStatusesForRoom = useCallback(async () => {
		const activeRoomId = roomIdRef.current;
		if (!activeRoomId) return;
		const statusRequestEpoch = ++inviteStatusRequestEpochRef.current;
		const accessToken = await getFreshAuthAccessToken(
			"invite-status-membership-change",
		);
		if (!accessToken || roomIdRef.current !== activeRoomId)
			return;

		try {
			const invites = await listRoomInvites(accessToken);
			if (
				roomIdRef.current !== activeRoomId ||
				inviteStatusRequestEpochRef.current !== statusRequestEpoch
			)
				return;
			setInviteTargetStatuses(
				roomInviteTargetStatuses(invites.sent, activeRoomId),
			);
			logDebug("overlay.invite", "status refreshed after participant joined", {
				roomId: activeRoomId,
			});
		} catch (error) {
			logDebug("overlay.invite", "participant-join status refresh failed", {
				roomId: activeRoomId,
				message: authErrorMessage(error, "Failed to refresh invite status"),
			});
		}
	}, [getFreshAuthAccessToken]);

	const toggleInvitePanel = useCallback(() => {
		if (invitePanelOpen) {
			setInvitePanelOpen(false);
			return;
		}

		setInvitePanelOpen(true);
		void loadInviteTargetsForRoom();
	}, [invitePanelOpen, loadInviteTargetsForRoom]);

	useEffect(() => {
		const previous = inviteStatusMembershipRef.current;
		const current = { roomId, participantCount };

		if (previous.roomId !== roomId) {
			inviteStatusMembershipRef.current = current;
			return;
		}

		if (!invitePanelOpen) return;
		inviteStatusMembershipRef.current = current;

		if (!isHost || !roomId || participantCount <= previous.participantCount) {
			return;
		}

		void refreshInviteStatusesForRoom();
	}, [
		invitePanelOpen,
		isHost,
		participantCount,
		refreshInviteStatusesForRoom,
		roomId,
	]);

	const sendInviteToTarget = useCallback(
		async (
			targetKey: string,
			label: string,
			input: Pick<CreateRoomInviteInput, "recipientUserIds" | "groupId">,
		) => {
			const activeRoomId = roomIdRef.current;
			const accessToken = await getFreshAuthAccessToken("send-invite");
			if (!activeRoomId || !accessToken) {
				showInviteNotice(
					"Create a room and sign in before inviting friends.",
					"error",
				);
				return;
			}
			if (roomIdRef.current !== activeRoomId) return;

			setInviteSendingTarget(targetKey);
			clearInviteNotice();
			const requestKey = `${activeRoomId}:${targetKey}`;
			const clientActionId =
				inviteActionIdsRef.current.get(requestKey) ?? crypto.randomUUID();
			inviteActionIdsRef.current.set(requestKey, clientActionId);
			try {
				const result = await createRoomInvite(accessToken, {
					roomId: activeRoomId,
					clientActionId,
					...input,
				});
				if (roomIdRef.current !== activeRoomId) return;
				if (inviteActionIdsRef.current.get(requestKey) === clientActionId) {
					inviteActionIdsRef.current.delete(requestKey);
				}
				inviteStatusRequestEpochRef.current += 1;
				setInviteTargetStatuses((current) =>
					mergeRoomInviteTargetStatus(current, targetKey, result.invite),
				);
				showInviteNotice(
					result.created
						? `Invite sent to ${label}. Waiting for a response.`
						: `An invite for ${label} already exists in this room.`,
					result.created ? "success" : "info",
				);
				logDebug("overlay.invite", "sent", {
					roomId: activeRoomId,
					targetKey,
					label,
					created: result.created,
				});
			} catch (error) {
				const message = authErrorMessage(error, "Failed to send invite");
				showInviteNotice(message, "error");
				logDebug("overlay.invite", "send failed", {
					roomId: activeRoomId,
					targetKey,
					message,
				});
			} finally {
				if (roomIdRef.current === activeRoomId) {
					setInviteSendingTarget(null);
				}
			}
		},
		[clearInviteNotice, getFreshAuthAccessToken, showInviteNotice],
	);

	const sendDirectInvite = useCallback(
		(friend: FriendListItem) =>
			sendInviteToTarget(
				`friend:${friend.user.userId}`,
				friend.user.displayName,
				{
					recipientUserIds: [friend.user.userId],
				},
			),
		[sendInviteToTarget],
	);

	const sendGroupInvite = useCallback(
		(group: FriendGroup) =>
			sendInviteToTarget(`group:${group.id}`, group.name, {
				groupId: group.id,
			}),
		[sendInviteToTarget],
	);

	const saveDiagnostics = async (mode: DiagnosticMode) => {
		setDiagnosticStatus(`Saving ${mode}...`);
		try {
			const p2pDiagnostics = await ghostCamSession.getDiagnostics();
			const voiceDiagnostics = {
				mode: voiceSession.mode,
				microphoneStatus: ghostCamSession.microphoneStatus,
				microphonePublishingWanted,
				localSpeaking: localLiveVoiceActive,
				p2p: p2pDiagnostics,
			};
			logDebug("debug", "diagnostics save requested", {
				mode,
				entries: getDebugEntries().length,
				roomId,
				status,
				video: videoDebugSnapshot(adapter.video),
				voice: voiceDiagnostics,
			});

			const pageDebugText =
				mode === "light" ? getCompactDebugLogText() : getDebugLogText();
			const pageDebug = JSON.parse(pageDebugText) as unknown;
			const response = await saveDiagnosticsFromPage(mode, {
				mode,
				url: location.href,
				visibilityState: document.visibilityState,
				adapterId: adapter.id,
				roomId,
				status,
				hasParticipant: Boolean(participant),
				participantId: participant?.id,
				video: videoDebugSnapshot(adapter.video),
				voice: voiceDiagnostics,
				pageDebug,
			});

			if (!response.ok) {
				setDiagnosticStatus(response.error);
				return;
			}

			setDebugEntriesCount(getDebugEntries().length);
			setDiagnosticStatus(
				`Save dialog opened for ${response.filename ?? `${mode} diagnostics`}`,
			);
		} catch (error) {
			logDebug("debug", "diagnostics save failed", {
				errorName: error instanceof Error ? error.name : "UnknownError",
				mode,
			});
			setDiagnosticStatus("Could not save diagnostics. Try again.");
		}
	};

	const clearDebug = async () => {
		clearDebugLog();
		await clearDiagnosticsFromPage().catch(() => undefined);
		setDiagnosticStatus(null);
		setDebugEntriesCount(getDebugEntries().length);
		setDiagnosticStatus("Logs cleared");
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

	useEffect(() => {
		if (reactionsEnabled) {
			return;
		}

		cancelFireHold("reactions-disabled");
		setReactions([]);
		for (const timerId of reactionVisibleTimersRef.current.values()) {
			window.clearTimeout(timerId);
		}
		reactionVisibleTimersRef.current.clear();
		for (const timerId of reactionIdentityCueTimersRef.current.values()) {
			window.clearTimeout(timerId);
		}
		reactionIdentityCueTimersRef.current.clear();
		reactionLaneCounterByParticipantRef.current.clear();
		setReactionCueParticipantIds(new Set());
	}, [cancelFireHold, reactionsEnabled]);

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
				logDebug(
					"reaction.fire",
					"hold skipped because experiment is disabled",
					{ source },
				);
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

	const startPushToTalk = useCallback(() => {
		if (voiceSession.mode !== "push-to-talk" || !roomId) {
			return;
		}
		if (!localHasMediaSeat) {
			setAuthMessage(
				localMediaSeatState === "requested"
					? "Waiting for the host to approve live media."
					: "Ask the host for a live media seat before using push to talk.",
			);
			setPanelOpen(true);
			return;
		}

		pushToTalkHeldRef.current = true;
		dispatchVoiceSession({ type: "push-to-talk", held: true });
	}, [localHasMediaSeat, localMediaSeatState, roomId, voiceSession.mode]);

	const stopPushToTalk = useCallback(() => {
		pushToTalkHeldRef.current = false;
		dispatchVoiceSession({ type: "push-to-talk", held: false });
	}, []);

	const stopMicrophoneForUnmount = useCallback(() => {
		pushToTalkHeldRef.current = false;
		void ghostCamSession.setMicrophonePublishing(false, "immediate");
	}, [ghostCamSession.setMicrophonePublishing]);

	useEffect(() => {
		const publicationKey = `${microphonePublishingWanted}:${voiceSession.mode}`;
		if (microphonePublicationRef.current === publicationKey) {
			return;
		}

		microphonePublicationRef.current = publicationKey;
		void ghostCamSession.setMicrophonePublishing(
			microphonePublishingWanted,
			voiceSession.release,
			voiceSession.mode,
		);
	}, [
		ghostCamSession.setMicrophonePublishing,
		microphonePublishingWanted,
		voiceSession.mode,
		voiceSession.release,
	]);

	useEffect(() => {
		if (!ghostCamSession.microphoneTerminalFailure) {
			return;
		}

		pushToTalkHeldRef.current = false;
		dispatchVoiceSession({ type: "terminal-failure" });
	}, [ghostCamSession.microphoneTerminalFailure]);

	const unlockLiveVoicePlayback = useCallback(() => {
		void ghostCamSession.unlockAudio();
	}, [ghostCamSession.unlockAudio]);

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

	const blurMessageComposerInput = useCallback(() => {
		const input = messageComposerInputRef.current;
		if (input && document.activeElement === input) {
			input.blur();
		}
	}, []);

	const closeMessageComposer = useCallback(() => {
		blurMessageComposerInput();
		setMessageComposerOpen(false);
		setMessageComposerEmojiOpen(false);
		setMessageComposerText("");
		deactivateMessageComposerGuard();
	}, [blurMessageComposerInput, deactivateMessageComposerGuard]);

	const insertComposerEmoji = useCallback(
		(emoji: string) => {
			const input = messageComposerInputRef.current;
			const selectionStart =
				input?.selectionStart ?? messageComposerText.length;
			const selectionEnd = input?.selectionEnd ?? selectionStart;
			const before = messageComposerText.slice(0, selectionStart);
			const after = messageComposerText.slice(selectionEnd);
			const prefix = before && !/\s$/.test(before) ? " " : "";
			const suffix = after && !/^\s/.test(after) ? " " : "";
			const insertion = `${prefix}${emoji}${suffix}`;
			const nextText = `${before}${insertion}${after}`.slice(0, 140);
			const nextCaret = Math.min(
				before.length + insertion.length,
				nextText.length,
			);

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
			blurMessageComposerInput();
			setMessageComposerText("");
			setMessageComposerOpen(false);
			setMessageComposerEmojiOpen(false);
			deactivateMessageComposerGuard();
		},
		[
			blurMessageComposerInput,
			deactivateMessageComposerGuard,
			messageComposerText,
			roomId,
			sendReaction,
		],
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
		[
			deactivateMessageComposerGuard,
			messageComposerOpen,
			setMessageComposerDomGuard,
		],
	);

	useEffect(() => {
		const handleShortcut = () => {
			if (messageComposerOpen) {
				closeMessageComposer();
				return;
			}

			openMessageComposer();
		};

		window.addEventListener(
			ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT,
			handleShortcut,
		);

		return () => {
			window.removeEventListener(
				ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT,
				handleShortcut,
			);
		};
	}, [closeMessageComposer, messageComposerOpen, openMessageComposer]);

	useEffect(() => {
		if (!messageComposerOpen) {
			return;
		}

		const handleSubmit = () => submitMessageComposer();

		window.addEventListener(
			ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
			handleSubmit,
		);

		return () => {
			window.removeEventListener(
				ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
				handleSubmit,
			);
		};
	}, [messageComposerOpen, submitMessageComposer]);

	useEffect(() => {
		const state = () => ({
			experimentalSuperReactionsEnabled,
			panelOpen,
			reactionsEnabled,
			reactionShortcuts: reactionShortcuts.assignments,
			roomActive: Boolean(roomId),
			voiceMode: voiceSession.mode,
		});

		const handleKeyDown = (event: KeyboardEvent) => {
			if (isWithinOverlayHotkeyBoundary(event)) {
				return;
			}

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

			if (
				isMessageComposerShortcut(event) &&
				!isKeyboardEditableTarget(event)
			) {
				event.preventDefault();
				event.stopImmediatePropagation();
				openMessageComposer();
				return;
			}

			const hotkeyState = state();
			const action = getHotkeyAction(event, hotkeyState);
			const capturesReactionShortcut = shouldCaptureReactionShortcutEvent(
				event,
				hotkeyState,
			);
			if (!action && !capturesReactionShortcut) {
				return;
			}

			event.preventDefault();
			event.stopImmediatePropagation();

			if (!action) {
				return;
			}

			if (action.type === "fire-start") {
				beginFireHold("hotkey");
			} else if (action.type === "message-composer-open") {
				openMessageComposer();
			} else if (action.type === "voice-start") {
				startPushToTalk();
			} else if (action.type === "reaction") {
				sendReaction(action.emoji);
			}
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			if (
				isPushToTalkReleaseEvent(event, {
					held: pushToTalkHeldRef.current,
					voiceMode: voiceSession.mode,
				})
			) {
				event.preventDefault();
				event.stopImmediatePropagation();
				stopPushToTalk();
				return;
			}

			if (isWithinOverlayHotkeyBoundary(event)) {
				return;
			}

			if (messageComposerOpen && isEscapeKey(event) && !isFullscreenActive()) {
				event.preventDefault();
				event.stopImmediatePropagation();
				return;
			}

			const hotkeyState = state();
			const action = getHotkeyAction(event, hotkeyState);
			const capturesReactionShortcut = shouldCaptureReactionShortcutEvent(
				event,
				hotkeyState,
			);
			if (
				!capturesReactionShortcut &&
				(!action ||
					(action.type !== "voice-stop" && action.type !== "fire-stop"))
			) {
				return;
			}

			event.preventDefault();
			event.stopImmediatePropagation();
			if (!action) {
				return;
			}
			if (action.type === "fire-stop") {
				finishFireHold("hotkey-up");
			} else {
				stopPushToTalk();
			}
		};

		const handleBlur = () => {
			cancelFireHold("window-blur");
			if (shouldStopVoiceTalkOnWindowBlur(voiceSession.mode)) {
				stopPushToTalk();
			}
		};

		const handleVisibilityChange = () => {
			if (
				document.visibilityState === "hidden" &&
				voiceSession.mode === "push-to-talk"
			) {
				stopPushToTalk();
			}
		};

		window.addEventListener("keydown", handleKeyDown, true);
		window.addEventListener("keyup", handleKeyUp, true);
		window.addEventListener("blur", handleBlur);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("keydown", handleKeyDown, true);
			window.removeEventListener("keyup", handleKeyUp, true);
			window.removeEventListener("blur", handleBlur);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
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
		reactionShortcuts.assignments,
		roomId,
		sendReaction,
		startPushToTalk,
		stopPushToTalk,
		voiceSession.mode,
	]);

	useOverlayUnmountCleanup({
		stopMicrophonePublication: stopMicrophoneForUnmount,
	});

	const roomActionsClassName = [
		"panel-actions",
		roomId ? "room-active" : "room-empty",
		roomCreatePending ? "creating" : "",
		roomEndPending ? "ending" : "",
		roomLeavePending ? "leaving" : "",
	]
		.filter(Boolean)
		.join(" ");
	const primaryRoomActionKind = getPrimaryRoomActionKind({
		isHost,
		roomExists: Boolean(roomId),
	});
	const primaryRoomActionLabel = getPrimaryRoomActionLabel({
		feedback: roomActionFeedback,
		isHost,
		roomCreatePending,
		roomEndConfirmationPending,
		roomEndPending,
		roomExists: Boolean(roomId),
		roomLeavePending,
	});
	const inviteCopied = isInviteCopiedFeedback(roomActionFeedback);
	const accountDisplayName =
		accountUser?.displayName ??
		participant?.displayName ??
		(identityLoaded ? "Sign in to Anidachi" : "Checking account");
	const accountAvatarLabel =
		accountUser?.displayName ??
		participant?.displayName ??
		(identityLoaded ? "A" : "...");
	const accountHelperText = identityLoaded
		? "Create rooms and invite friends"
		: "Checking account...";

	return (
		<div
			className={overlayClassName}
			onPointerDownCapture={unlockLiveVoicePlayback}
			ref={overlayRootRef}
			style={overlayCssVariables}
		>
			<style>{overlayStyles}</style>
			<div
				className={[
					"top-bubble-reveal",
					panelOpen ? "panel-open" : "",
					topBubbleReveal.bubbleVisible ? "bubble-visible" : "",
					topBubbleReveal.edgeGlowVisible ? "edge-glow" : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				<span className="top-bubble-edge-glow" aria-hidden="true" />
				<button
					aria-controls="anidachi-mini-panel"
					aria-expanded={panelOpen}
					aria-label={`${panelOpen ? "Close" : "Open"} Anidachi controls${
						openMicLauncherVisible ? ". Open mic is on" : ""
					}`}
					className="top-bubble"
					onBlur={topBubbleReveal.handleBubbleBlur}
					onFocus={topBubbleReveal.handleBubbleFocus}
					ref={topBubbleRef}
					type="button"
					onClick={(event) => {
						if (event.detail > 0) {
							event.currentTarget.blur();
						}
						setPanelOpen((value) =>
							roomCreatePending || roomEndPending || roomLeavePending
								? true
								: !value,
						);
					}}
				>
					<AnidachiLogoMark className="top-bubble-logo" size={24} />
					{openMicLauncherVisible ? (
						<span
							aria-hidden="true"
							className={`top-bubble-open-mic ${localLiveVoiceActive ? "speaking" : ""}`}
						>
							<Mic size={11} />
						</span>
					) : null}
					<span
						className={`sync-dot ${isConnected ? "connected" : catchUp ? "warning" : ""}`}
					/>
					<span className="bubble-count">{participantCount}</span>
				</button>
			</div>

			{panelOpen ? (
				<section
					className="mini-panel"
					id="anidachi-mini-panel"
					aria-label="Anidachi controls"
					ref={miniPanelRef}
					{...overlayInteractionBoundaryProps}
				>
					<div className="panel-header">
						<div className="panel-account">
							<span className="mini-avatar panel-account-avatar">
								{initials(accountAvatarLabel)}
							</span>
							<div className="panel-account-copy">
								<PanelAccountTitle
									displayName={accountDisplayName}
									plan={
										authAuthenticated && accountUser ? accountUser.plan : null
									}
								/>
								{roomId ? (
									<div className="panel-room-summary">
										<span>{mediaSeatSummaryText}</span>
									</div>
								) : !authAuthenticated ? (
									<div className="panel-account-helper">
										{accountHelperText}
									</div>
								) : null}
							</div>
						</div>
						<div className="panel-header-actions">
							{!authAuthenticated ? (
								<button
									className="button compact panel-sign-in-button"
									type="button"
									onClick={handleSignIn}
									disabled={
										authBusy || !identityLoaded || extensionContextInvalidated
									}
								>
									{authBusy || !identityLoaded ? "Wait" : "Sign in"}
								</button>
							) : null}
							{roomId && currentParticipant ? (
								<PanelCameraControl
									cameraEnabled={camsEnabled}
									disabled={!liveMediaAvailable}
									disabledReason={cameraControlDisabledReason}
									onToggle={handleGhostCamToggle}
								/>
							) : null}
						</div>
					</div>

					<div className={roomActionsClassName}>
						<button
							className={[
								"button",
								"primary",
								"panel-primary-action",
								primaryRoomActionKind !== "create" ? "room-exit" : "",
								roomEndConfirmationPending ? "confirming" : "",
								roomCreatePending || roomEndPending || roomLeavePending
									? "loading"
									: "",
							]
								.filter(Boolean)
								.join(" ")}
							type="button"
							onClick={
								primaryRoomActionKind === "leave"
									? handleLeaveRoom
									: primaryRoomActionKind === "end"
										? handleRequestEndRoom
										: handleCreateRoom
							}
							disabled={
								!participant ||
								extensionContextInvalidated ||
								roomCreatePending ||
								roomEndPending ||
								roomLeavePending
							}
						>
							<span aria-live="polite">{primaryRoomActionLabel}</span>
						</button>
						{roomId ? (
							<div
								className="panel-action-icons"
								role="group"
								aria-label="Room actions"
							>
								<button
									aria-label={inviteCopied ? "Invite copied" : "Copy invite"}
									className={`panel-icon-action reveal-action${inviteCopied ? " success" : ""}`}
									title={inviteCopied ? "Invite copied" : "Copy invite"}
									type="button"
									onClick={copyInvite}
									disabled={
										roomCreatePending || roomEndPending || roomLeavePending
									}
									style={{ "--action-index": 0 } as CSSProperties}
								>
									{inviteCopied ? <Check size={14} /> : <Copy size={14} />}
									{inviteCopied ? (
										<span className="sr-only" role="status">
											Invite copied
										</span>
									) : null}
								</button>
								<button
									aria-label={
										invitePanelOpen
											? "Close friends and groups"
											: "Invite friends and groups"
									}
									className="panel-icon-action reveal-action"
									title={
										invitePanelOpen
											? "Close friends and groups"
											: "Invite friends and groups"
									}
									type="button"
									onClick={toggleInvitePanel}
									disabled={
										!authAuthenticated ||
										roomCreatePending ||
										roomEndPending ||
										roomLeavePending
									}
									style={{ "--action-index": 1 } as CSSProperties}
								>
									<UserPlus size={14} />
								</button>
								<button
									aria-label="Sync now"
									className="panel-icon-action reveal-action"
									title={isHost ? "Sync now" : "Only the host can sync"}
									type="button"
									onClick={() => playbackSyncController.broadcastHostState()}
									disabled={
										!isHost ||
										roomCreatePending ||
										roomEndPending ||
										roomLeavePending
									}
									style={{ "--action-index": 2 } as CSSProperties}
								>
									<RefreshCw size={14} />
								</button>
							</div>
						) : null}
					</div>
					{transientPanelNotice ? (
						<div
							aria-live="polite"
							className="auth-notice panel-action-notice"
							role="status"
						>
							<span>{transientPanelNotice}</span>
						</div>
					) : null}
					{authMessage ? (
						<div className="auth-notice">
							<span>{authMessage}</span>
							{extensionContextInvalidated ? (
								<button
									className="button compact"
									type="button"
									onClick={reloadPage}
								>
									Reload page
								</button>
							) : null}
							{activeRoomConflict &&
							(!activeRoomConflict.provider ||
								activeRoomConflict.provider === adapter.provider) ? (
								<button
									className="button compact"
									type="button"
									onClick={handleOpenActiveRoom}
									disabled={roomCreatePending}
								>
									Open active room
								</button>
							) : null}
						</div>
					) : null}
					{roomQuota ? (
						<div className="quota-note">
							<span>Free watch-party time today</span>
							<strong>
								{formatQuotaCountdown(quotaRemainingSeconds)} left
							</strong>
						</div>
					) : null}
					{invitePanelOpen ? (
						<div className="invite-panel" aria-busy={inviteTargetsLoading}>
							<div className="invite-panel-header">
								<div className="invite-panel-heading">
									<strong>Friends & groups</strong>
									<span>
										{inviteTargets
											? `${inviteTargets.groups.length + inviteTargets.friends.length} available`
											: "Choose who to invite"}
									</span>
								</div>
								<button
									aria-label="Refresh friends and groups"
									className="invite-panel-refresh"
									disabled={inviteTargetsLoading}
									type="button"
									onClick={loadInviteTargetsForRoom}
									title="Refresh friends and groups"
								>
									<RefreshCw size={14} />
								</button>
							</div>
							{inviteNotice ? (
								<div
									className="invite-status-message"
									data-tone={inviteNotice.tone}
									role={inviteNotice.tone === "error" ? "alert" : "status"}
									aria-live="polite"
								>
									<span className="invite-status-mark" aria-hidden="true">
										{inviteNotice.tone === "success" ? "✓" : "!"}
									</span>
									<span>{inviteNotice.message}</span>
								</div>
							) : null}
							{inviteTargetsLoading && !inviteTargets ? (
								<div
									className="invite-panel-loading"
									role="status"
									aria-label="Loading friends and groups"
								>
									{[0, 1, 2].map((index) => (
										<div className="invite-target-skeleton" key={index}>
											<span />
											<div>
												<i />
												<i />
											</div>
											<b />
										</div>
									))}
								</div>
							) : null}
							{inviteTargets?.groups.length ? (
								<section className="invite-target-section">
									<div className="invite-target-section-title">
										<span>Groups</span>
										<b>{inviteTargets.groups.length}</b>
									</div>
									{inviteTargets.groups.map((group) => {
										const targetKey = `group:${group.id}`;
										const targetStatus = roomInviteGroupStatus(
											inviteTargetStatuses,
											group.members.map((member) => member.user.userId),
										);
										const invitedMemberCount =
											targetStatus?.recipientStatuses.size ?? 0;
										const uninvitedMemberCount = Math.max(
											0,
											group.members.length - invitedMemberCount,
										);
										const statusLabel = targetStatus
											? roomInviteTargetStatusLabel(targetStatus)
											: null;
										return (
											<div className="invite-target-row" key={group.id}>
												<div className="participant-main">
													<span className="mini-avatar">
														{initials(group.name)}
													</span>
													<span className="invite-target-copy">
														<strong>{group.name}</strong>
														<small>
															{group.members.length === 0
																? "No members"
																: `${group.members.length} ${group.members.length === 1 ? "member" : "members"}${statusLabel ? ` · ${statusLabel.toLowerCase()}` : ""}`}
														</small>
													</span>
												</div>
												<button
													className="button compact invite-target-action"
													data-state={
														targetStatus?.state ??
														(group.members.length === 0 ? "empty" : "idle")
													}
													disabled={
														inviteSendingTarget !== null ||
														group.members.length === 0 ||
														uninvitedMemberCount === 0
													}
													onClick={() => sendGroupInvite(group)}
													type="button"
												>
													{inviteSendingTarget === targetKey
														? "Sending…"
														: group.members.length === 0
															? "No members"
															: targetStatus && uninvitedMemberCount === 0
																? roomInviteTargetStatusLabel(targetStatus)
																: targetStatus
																	? `Invite ${uninvitedMemberCount} new`
																	: "Invite"}
												</button>
											</div>
										);
									})}
								</section>
							) : null}
							{inviteTargets?.friends.length ? (
								<section className="invite-target-section">
									<div className="invite-target-section-title">
										<span>Friends</span>
										<b>{inviteTargets.friends.length}</b>
									</div>
									{inviteTargets.friends.map((friend) => {
										const targetKey = `friend:${friend.user.userId}`;
										const targetStatus = inviteTargetStatuses.get(targetKey);
										return (
											<div
												className="invite-target-row"
												key={friend.user.userId}
											>
												<div className="participant-main">
													<span className="mini-avatar">
														{initials(friend.user.displayName)}
													</span>
													<span className="invite-target-copy">
														<strong>{friend.user.displayName}</strong>
														<small>
															{friend.user.handle
																? `@${friend.user.handle}`
																: "Friend"}
														</small>
													</span>
												</div>
												<button
													className="button compact invite-target-action"
													data-state={targetStatus?.state ?? "idle"}
													disabled={
														inviteSendingTarget !== null ||
														Boolean(targetStatus)
													}
													onClick={() => sendDirectInvite(friend)}
													type="button"
												>
													{inviteSendingTarget === targetKey
														? "Sending…"
														: targetStatus
															? roomInviteTargetStatusLabel(targetStatus)
															: "Invite"}
												</button>
											</div>
										);
									})}
								</section>
							) : null}
							{inviteTargets &&
							!inviteTargets.friends.length &&
							!inviteTargets.groups.length &&
							!inviteTargetsLoading ? (
								<div className="footnote">
									No friends or groups yet. Copy invite still works for one-off
									watching.
								</div>
							) : null}
						</div>
					) : null}

					{currentResourceEntry ? (
						<div className="panel-sync-card">
							<CurrentResourcePanel entry={currentResourceEntry} />
						</div>
					) : null}
					{playbackSyncNotice ? (
						<div className="playback-sync-notice" role="status">
							<span>{playbackSyncNotice}</span>
							{resumeSyncRequired ? (
								<button
									className="playback-sync-resume"
									onClick={() => playbackSyncController.resumeFromUserGesture()}
									type="button"
								>
									Resume sync
								</button>
							) : null}
						</div>
					) : null}

					{roomId && visibleParticipants.length ? (
						<RoomPeopleSection
							currentParticipantId={currentParticipant?.id ?? null}
							liveVoiceActiveSpeakerIds={voiceIndicatorParticipantIds}
							maxMediaSeats={roomMediaSeatLimit}
							occupiedMediaSeatCount={occupiedMediaSeatCount}
							onCancelMediaSeatRequest={cancelMediaSeatRequest}
							onGrantMediaSeat={grantMediaSeat}
							onRequestMediaSeat={requestMediaSeat}
							onRevokeMediaSeat={revokeMediaSeat}
							participants={visibleParticipants}
							roomPeopleCountText={roomPeopleCountText}
						/>
					) : null}

					<div className="section-title settings-section-title">
						<Settings2
							aria-hidden="true"
							className="section-title-icon settings-section-title-icon"
							size={15}
							strokeWidth={1.8}
						/>
						<span className="settings-section-title-label">Settings</span>
					</div>
					<div className="settings-shell">
						<div
							className={[
								"settings-category-rail",
								settingsRailOverflow.left ? "can-scroll-left" : "",
								settingsRailOverflow.right ? "can-scroll-right" : "",
								settingsRailDragging ? "dragging" : "",
							]
								.filter(Boolean)
								.join(" ")}
						>
							<div
								aria-label="Settings sections"
								className="settings-category-scroll"
								data-active-category={settingsPanelCategory}
								onClickCapture={handleSettingsCategoryClickCapture}
								onLostPointerCapture={handleSettingsCategoryPointerEnd}
								onPointerCancel={handleSettingsCategoryPointerEnd}
								onPointerDown={handleSettingsCategoryPointerDown}
								onPointerMove={handleSettingsCategoryPointerMove}
								onPointerUp={handleSettingsCategoryPointerEnd}
								onScroll={updateSettingsRailOverflow}
								onWheel={handleSettingsCategoryWheel}
								ref={settingsCategoryScrollRef}
								role="tablist"
							>
								{SETTINGS_PANEL_CATEGORIES.map((category) => (
									<button
										aria-selected={settingsPanelCategory === category.id}
										className={`settings-category-tab${
											settingsPanelCategory === category.id ? " active" : ""
										}`}
										key={category.id}
										onClick={() => setSettingsPanelCategory(category.id)}
										ref={(node) => {
											settingsCategoryButtonRefs.current[category.id] = node;
										}}
										role="tab"
										type="button"
									>
										{category.label}
									</button>
								))}
							</div>
						</div>

						<div className="settings-panel" role="tabpanel">
							{settingsPanelCategory === "layout" ? (
								<OverlayLayoutEditor
									appliedLayout={appliedOverlayLayout}
									chatDisplayMode={chatDisplayMode}
									layoutContext={overlayLayoutRuntimeContext}
									onApply={handleOverlayLayoutApply}
									onChatDisplayModeChange={handleChatDisplayModeChange}
									onPreviewChange={handleOverlayLayoutPreviewChange}
								/>
							) : null}

							{settingsPanelCategory === "reactions" ? (
								<div className="settings-panel-stack reaction-settings-panel">
									<div className="settings-toggle-row">
										<div className="settings-toggle-heading">
											<span className="settings-toggle-switch-label">
												Quick reactions
											</span>
											<span className="settings-help">
												<button
													aria-describedby={quickReactionsHelpId}
													aria-label="About quick reactions"
													className="settings-help-trigger"
													type="button"
												>
													<CircleHelp
														aria-hidden="true"
														size={14}
														strokeWidth={1.8}
													/>
												</button>
												<span
													className="settings-help-tooltip"
													id={quickReactionsHelpId}
													role="tooltip"
												>
													Assign emojis to keys 1–0. Press a number during a
													room to send a quick reaction.
												</span>
											</span>
										</div>
										<button
											aria-checked={reactionsEnabled}
											aria-label="Quick reactions"
											className="settings-toggle-switch"
											data-state={reactionsEnabled ? "on" : "off"}
										onClick={handleReactionsEnabledToggle}
											role="switch"
											type="button"
										>
											<span className="settings-toggle-switch-state">
												<span
													aria-hidden="true"
													className="settings-toggle-switch-track"
												>
													<span className="settings-toggle-switch-thumb" />
												</span>
											</span>
										</button>
									</div>
									{reactionsEnabled ? (
										<>
											<ReactionShortcutEditor
												assignments={reactionShortcuts.assignments}
												onAssign={reactionShortcuts.assign}
											/>
											{reactionShortcuts.error ? (
												<p className="reaction-shortcut-status" role="status">
													{reactionShortcuts.error}
												</p>
											) : null}
										</>
									) : null}
								</div>
							) : null}

							{settingsPanelCategory === "interface" ? (
								<InterfaceSettingsPanel
									error={interfacePreferences.error}
									onChange={interfacePreferences.update}
									preferences={interfacePreferences.preferences}
									ready={interfacePreferences.ready}
									saving={interfacePreferences.saving}
								/>
							) : null}

							{settingsPanelCategory === "voice" ? (
								<VoiceSettingsPanel
									feedback={ghostCamSession.voiceMessage}
									mode={voiceSession.mode}
									onModeChange={handleVoiceModeChange}
								/>
							) : null}

							{settingsPanelCategory === "debug" ? (
								<div className="settings-panel-stack">
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
											<strong>P2P</strong>
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
											<button
												className="button"
												type="button"
												onClick={() => saveDiagnostics("light")}
											>
												Save light
											</button>
											<button
												className="button"
												type="button"
												onClick={() => saveDiagnostics("full")}
											>
												Save full
											</button>
											<button
												className="button"
												type="button"
												onClick={clearDebug}
											>
												Clear
											</button>
										</div>
										{diagnosticStatus ? (
											<div className="debug-status" title={diagnosticStatus}>
												{diagnosticStatus}
											</div>
										) : null}
									</div>
									<div className="footnote">
										Debug logging is temporarily always on. Media transport is
										P2P-only.
									</div>
								</div>
							) : null}
						</div>
					</div>

					{authAuthenticated ? (
						<div className="account-footer">
							<button
								className={`account-footer-action${signOutConfirmationPending ? " confirming" : ""}`}
								type="button"
								onClick={handleSignOut}
								disabled={authBusy || extensionContextInvalidated}
							>
								<LogOut
									aria-hidden="true"
									className="account-footer-action-icon"
									size={14}
									strokeWidth={1.8}
								/>
								<span>
									{authBusy
										? "Signing out..."
										: signOutConfirmationPending
											? "Press again to sign out"
											: "Sign out"}
								</span>
							</button>
						</div>
					) : null}
				</section>
			) : null}

			{overlayLayoutPreviewActive ? (
				<OverlayLayoutGhostPreview
					layout={resolvedOverlayLayout}
					occupiedCameraSlots={
						cameraStackVisible ? renderableCameraParticipants.length : 0
					}
					showChatPlaceholder={!liveChatVisible}
				/>
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
									<button
										key={emoji}
										onClick={() => insertComposerEmoji(emoji)}
										type="button"
									>
										{emoji}
									</button>
								))}
							</div>
						) : null}
					</div>
					<input
						aria-label="Anidachi message"
						maxLength={140}
						onChange={(event) =>
							setMessageComposerText(event.currentTarget.value)
						}
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
					{cameraStackVisible && renderableCameraParticipants.length ? (
						<>
							<div
								aria-hidden="true"
								className="cam-stack-interaction-corridor"
								{...overlayInteractionBoundaryProps}
							/>
							<div className="cam-stack">
								{renderableCameraParticipants.map((item) => {
									const video = cameraVideoByParticipantId.get(item.id);
									if (!video) {
										return null;
									}

									return (
										<CameraBubble
											key={item.id}
											participant={item}
											video={video}
											audioPreference={
												item.id === participant?.id
													? null
													: getParticipantAudioPreference(item.id)
											}
											fireChargePhase={
												fireCharge?.participantId === item.id
													? fireCharge.phase
													: null
											}
											flaming={flamingParticipantIds.includes(item.id)}
											onAudioPreferenceChange={(preference) =>
												handleParticipantAudioChange(item.id, preference)
											}
											speaking={voiceIndicatorParticipantIds.includes(item.id)}
										/>
									);
								})}
							</div>
						</>
					) : null}

					{roomRailVisible ? (
						<RoomRail
							activeParticipantId={participant?.id}
							getParticipantAudioPreference={getParticipantAudioPreference}
							onParticipantAudioChange={handleParticipantAudioChange}
							participants={voiceRailParticipants}
							reactionCueParticipantIds={reactionCueParticipantIds}
							speakingParticipantIds={voiceIndicatorParticipantIds}
							visibilityMode={
								interfacePreferences.preferences.participantPillVisibility
							}
						/>
					) : null}

					{liveChatVisible ? (
						<LiveChatColumn
							layoutPreviewActive={overlayLayoutPreviewActive}
							mode={chatDisplayMode}
							messages={displayedChatMessages}
							maxLiveMessages={resolvedOverlayLayout.chat.effectiveMaxMessages}
							participants={participants}
							fallbackParticipantId={participant?.id}
						/>
					) : null}

					{reactions.map(({ laneIndex, reaction }) => (
						<ReactionPop
							key={reaction.id}
							fallbackParticipantIndex={Math.max(
								0,
								participants.findIndex((item) => item.id === reaction.userId),
							)}
							fallbackParticipantId={participant?.id}
							laneIndex={laneIndex}
							overlayRef={overlayRootRef}
							participants={participants}
							reaction={reaction}
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
									playbackSyncController.catchUpFromUserGesture();
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
	audioPreference,
	fireChargePhase,
	flaming,
	onAudioPreferenceChange,
	speaking,
}: {
	participant: Participant;
	video: GhostVideo;
	audioPreference: ParticipantAudioPreference | null;
	fireChargePhase: FireChargePhase | null;
	flaming: boolean;
	onAudioPreferenceChange: (preference: ParticipantAudioPreference) => void;
	speaking: boolean;
}) {
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!ref.current) {
			return;
		}

		void attachAndPlayVideoElement(ref.current, video.element).catch(
			(error) => {
				logDebug("p2p.video", "attached video playback failed", {
					error: error instanceof Error ? error.message : String(error),
					participantId: participant.id,
					paused: video.element.paused,
					readyState: video.element.readyState,
				});
			},
		);
	}, [participant.id, video]);

	return (
		<div
			className={`cam-bubble ${flaming ? "flame-active" : ""} ${
				speaking ? "speaking" : ""
			}`}
			data-participant-id={participant.id}
			title={participant.displayName}
			{...overlayHotkeyBoundaryProps}
			{...overlayInteractionBoundaryProps}
		>
			<div className="cam-media" ref={ref} />
			{flaming ? (
				<svg
					aria-hidden="true"
					className="nuke-burst"
					focusable="false"
					viewBox="0 0 120 150"
				>
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
						<ellipse
							className="nuke-stem-glow"
							cx="61"
							cy="101"
							rx="8"
							ry="26"
						/>
					</g>
					<g className="nuke-cap">
						<ellipse
							className="nuke-cap-shadow"
							cx="60"
							cy="69"
							rx="36"
							ry="21"
						/>
						<circle
							className="nuke-cap-puff puff-left"
							cx="34"
							cy="62"
							r="16"
						/>
						<circle
							className="nuke-cap-puff puff-mid-left"
							cx="49"
							cy="52"
							r="19"
						/>
						<circle
							className="nuke-cap-puff puff-mid-right"
							cx="70"
							cy="51"
							r="21"
						/>
						<circle
							className="nuke-cap-puff puff-right"
							cx="89"
							cy="64"
							r="17"
						/>
						<ellipse
							className="nuke-cap-core"
							cx="61"
							cy="68"
							rx="33"
							ry="17"
						/>
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
					<circle
						className="super-ring-track"
						cx="50"
						cy="50"
						r="46"
						pathLength={100}
					/>
					<circle
						className="super-ring-progress"
						cx="50"
						cy="50"
						r="46"
						pathLength={100}
					/>
				</svg>
			) : null}
			{speaking ? (
				<span className="mic-dot" aria-hidden="true">
					<Mic size={11} strokeWidth={2.5} />
				</span>
			) : null}
			{audioPreference ? (
				<ParticipantAudioContourControl
					displayName={participant.displayName}
					onChange={onAudioPreferenceChange}
					preference={audioPreference}
				/>
			) : null}
		</div>
	);
}

function LiveChatColumn({
	layoutPreviewActive,
	mode,
	messages,
	maxLiveMessages,
	participants,
	fallbackParticipantId,
}: {
	layoutPreviewActive: boolean;
	mode: ChatDisplayMode;
	messages: LiveChatMessage[];
	maxLiveMessages: number;
	participants: Participant[];
	fallbackParticipantId?: string;
}) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const renderedMode = layoutPreviewActive ? "live" : mode;
	const visibleMessages =
		renderedMode === "history"
			? messages.slice(-CHAT_HISTORY_MAX_MESSAGES)
			: messages.slice(-maxLiveMessages);
	const latestMessageId = visibleMessages.at(-1)?.id;

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) {
			return;
		}

		const distanceFromBottom =
			element.scrollHeight - element.scrollTop - element.clientHeight;
		if (distanceFromBottom < 70 || messages.length <= 1) {
			element.scrollTop = element.scrollHeight;
		}
	}, [latestMessageId, messages.length, renderedMode]);

	return (
		<div
			className={`live-chat-column ${renderedMode}${
				layoutPreviewActive ? " layout-chat-preview-shell" : ""
			}`}
			aria-live="polite"
			onMouseMove={stopNativeEvent}
			onPointerDown={stopNativeEvent}
			onPointerMove={stopNativeEvent}
			onPointerOver={stopNativeEvent}
			onPointerUp={stopNativeEvent}
			ref={scrollRef}
			role="log"
		>
			{visibleMessages.map((message) => {
				const participant = participants.find(
					(item) => item.id === message.reaction.userId,
				);
				const isFallback =
					message.reaction.userId === fallbackParticipantId && !participant;
				const displayName =
					participant?.displayName ?? (isFallback ? "You" : "Friend");
				const style = {
					"--chat-name-color": getLiveChatNameColor(message.reaction.userId),
				} as CSSProperties;

				return (
					<div className="live-chat-message" key={message.id} style={style}>
						<span className="live-chat-name">{displayName}</span>
						<span className="live-chat-text">{message.reaction.text}</span>
					</div>
				);
			})}
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
		...(event.senderMediaSessionId
			? { senderMediaSessionId: event.senderMediaSessionId }
			: {}),
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

function normalizeChatDisplayMode(value: unknown): ChatDisplayMode {
	return value === "history" ? "history" : DEFAULT_CHAT_DISPLAY_MODE;
}

function normalizeOverlayViewportDimension(value: number): number {
	return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
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
	return path.some(
		(target) =>
			target instanceof HTMLElement && isKeyboardEditableElement(target),
	);
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
			const label = reset.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
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

function roomTerminalCloseMessage(code: number): string {
	if (code === ROOM_SESSION_TAKEN_OVER_CLOSE_CODE) {
		return "This room was opened in another tab or device.";
	}
	if (code === ROOM_FULL_CLOSE_CODE) {
		return "This watch room is full.";
	}
	return "Watch room ended.";
}

function activeRoomConflictMessage(
	provider: ActiveRoomConflictResponse["activeRoom"]["provider"],
	currentProvider: VideoAdapter["provider"],
): string {
	if (!provider || provider === currentProvider) {
		return ACTIVE_ROOM_CONFLICT_MESSAGE;
	}
	if (provider === "youtube") {
		return "You already have an active watch room on YouTube. Open that tab to continue.";
	}
	if (provider === "crunchyroll") {
		return "You already have an active watch room on Crunchyroll. Open that tab to continue.";
	}
	return "You already have an active watch room on another supported site. Open that tab to continue.";
}

function formatQuotaCountdown(remainingSeconds: number | null): string {
	const total = Math.max(0, Math.floor(remainingSeconds ?? 0));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function shouldOpenPanelForInitialRoom(
	hashRoomId: string | null,
	persistedRoomId: string | null,
) {
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
	history.replaceState(
		null,
		"",
		`${location.pathname}${location.search}#${params.toString()}`,
	);
}

function buildCurrentSourceUrlForInvite(): string {
	const url = new URL(location.href);
	const params = new URLSearchParams(url.hash.replace(/^#/, ""));
	params.delete("anidachiRoom");
	url.hash = params.toString();
	return url.toString();
}

function isStaleAuthoritativeGeneration(
	currentRoomGeneration: number,
	currentSourceGeneration: number,
	receivedRoomGeneration: number,
	receivedSourceGeneration: number,
): boolean {
	return (
		receivedRoomGeneration < currentRoomGeneration ||
		(receivedRoomGeneration === currentRoomGeneration &&
			receivedSourceGeneration < currentSourceGeneration)
	);
}

function fallbackCopy(text: string): boolean {
	const input = document.createElement("textarea");
	input.value = text;
	input.style.position = "fixed";
	input.style.left = "-9999px";
	document.body.append(input);
	input.select();
	try {
		return document.execCommand("copy");
	} finally {
		input.remove();
	}
}

function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function resetComposerShieldInlineStyles(shield: HTMLDivElement | null) {
	if (!shield) {
		return;
	}

	shield.style.cursor = "";
	shield.style.pointerEvents = "";
}

function wakePlayerAfterComposerShieldRelease(
	point: PointerWakePoint,
	shield: HTMLElement | null,
) {
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

function stopNativeEvent(event: SyntheticEvent<HTMLElement>) {
	event.stopPropagation();
	event.nativeEvent.stopImmediatePropagation();
}
