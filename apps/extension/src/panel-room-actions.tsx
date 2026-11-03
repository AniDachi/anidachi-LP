import {
	Check,
	CircleHelp,
	Copy,
	RefreshCw,
	Timer,
	UserPlus,
} from "lucide-react";
import {
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type MouseEvent,
} from "react";
import {
	animatePanelRoomStart,
	capturePanelRoomStart,
	type PanelRoomStart,
} from "./panel-room-start-motion";

/** A bounded visual continuation of the last account observation, never a grant
 * or a running local clock. The first live observation supersedes it. */
export type PanelStartingTime = {
	seconds: number;
	capturedAt: number;
	wall: number;
	expiresAt: number;
};

export interface PanelRoomActionsProps {
	scopeKey: string;
	roomId: string | null;
	roomReady: boolean;
	/** Owned by OverlayApp so closing the panel cannot retire an in-flight start. */
	creating?: boolean;
	/** An invite/restored room is resolving; the personal hosting quota is unrelated. */
	joining?: boolean;
	/** Admission exists but membership is still unconfirmed after its wait window. */
	connectionStalled?: boolean;
	closing?: boolean;
	closingLabel?: "Closing room" | "Leaving room";
	idleTimePending?: boolean;
	idleTimeUnavailable?: boolean;
	onRetryHosting?(): void;
	startingTime?: PanelStartingTime | null;
	/** A failed initial connection must expose the existing departure action. */
	roomStartInterrupted?: boolean;
	isHost: boolean;
	label: string;
	disabled: boolean;
	busy: boolean;
	confirming: boolean;
	remainingSeconds: number | null;
	/** A connected room can precede its first live time response. Null alone
	 * cannot distinguish that pending read from confirmed unlimited access. */
	awaitingHostingTime?: boolean;
	/** Legacy starts may retain their idle animation value. Expiring server
	 * observations must retire it as soon as the consumer passes null. */
	retainIdleTimeWhileConnecting?: boolean;
	onPrimaryAction(event: MouseEvent<HTMLButtonElement>): void;
	onCopyInvite(): Promise<boolean>;
	onSync(): boolean;
	onToggleInvite(): void;
	inviteOpen: boolean;
	inviteDisabled: boolean;
	syncDisabled: boolean;
}

export function PanelTimeCounter({ seconds }: { seconds: number }) {
	const total = Math.max(0, Math.floor(seconds));
	const text = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
	return (
		<span className="panel-time-counter" aria-hidden="true">
			<Timer size={20} strokeWidth={1.8} />
			<strong>{text}</strong>
		</span>
	);
}

type Notice = { action: "copy" | "sync"; error: boolean; message: string };

// Only bounds the presentation hold. The connection/retry lifecycle continues,
// and the existing departure action becomes available if membership stalls.
export const ROOM_START_PRESENTATION_TIMEOUT_MS = 8_000;

export function PanelRoomActions(props: PanelRoomActionsProps) {
	const { roomId, remainingSeconds, busy } = props;
	const active = roomId !== null;
	const joining = Boolean(props.joining) && !props.closing;
	const connectionStalled = Boolean(props.connectionStalled) && !props.closing;
	const pendingMembership = joining || connectionStalled;

	const scope = `${props.scopeKey}:${roomId ?? "idle"}`;
	const currentScope = useRef(scope);
	currentScope.current = scope;
	const sequence = useRef(0);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [visible, setVisible] = useState(false);
	const [pending, setPending] = useState<"copy" | "sync" | null>(null);
	const stripRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [createPointer, setCreatePointer] = useState<{ x: number; y: number } | null>(null);
	const start = useRef<PanelRoomStart | null>(null);
	const startRoomId = useRef<string | null>(null);
	const [startTime, setStartTime] = useState<number | null | undefined>(
		undefined,
	);
	const [retiredStart, setRetiredStart] = useState<number | null>(null);
	const startingTime = props.startingTime;
	const now = performance.now();
	// The owner caps this at the original observation expiry and eight seconds
	// after admission. Time spent waiting for HTTP is not a live-room handoff.
	const startDeadline = startingTime?.expiresAt ?? null;
	const freshStart = startingTime && retiredStart !== startingTime.capturedAt &&
		document.visibilityState !== "hidden" && now >= startingTime.capturedAt && now < startDeadline! &&
		Math.abs(Date.now() - startingTime.wall - (now - startingTime.capturedAt)) < 2_000
		? startingTime : null;
	// Preserve the source geometry while admission precedes the live snapshot.
	// This is the last idle observation, never a locally started allowance.
	const waitingForRoom = active && (props.creating ?? startTime !== undefined) && !props.roomReady && !props.roomStartInterrupted;
	const startInterrupted = Boolean(props.roomStartInterrupted || (!pendingMembership && props.creating === false && !props.roomReady));
	const visibleActive = Boolean(props.closing) || (active && !waitingForRoom && !pendingMembership);
	// HTTP admission can finish before the first room snapshot. Keep Creating
	// throughout that gap, until the room is ready or the existing escape applies.
	const label = props.closing ? props.closingLabel ?? "Closing room"
		: connectionStalled ? "Cancel connection"
		: joining ? "Joining room"
		: !visibleActive ? (props.creating || waitingForRoom ? "Creating room" : "Create room")
		: props.label;
	const actionBusy = busy || waitingForRoom || joining || Boolean(props.closing);
	const continuingStart = !startInterrupted && (props.creating || (visibleActive && props.isHost && props.awaitingHostingTime));
	const displaySeconds = pendingMembership || props.closing || (!active && props.idleTimeUnavailable) ? null : remainingSeconds ?? (continuingStart ? freshStart?.seconds : null) ??
		(waitingForRoom && props.retainIdleTimeWhileConnecting !== false ? startTime : null);
	const timed = typeof displaySeconds === "number" && Number.isFinite(displaySeconds) && (!visibleActive || props.isHost);
	const awaitingTimer = !props.closing && visibleActive && props.isHost && !timed && Boolean(props.awaitingHostingTime) && !props.roomStartInterrupted;
	// Reserve the original slot while connecting, without retaining stale digits.
	const timedLayout = !pendingMembership && (visibleActive || timed || Boolean(props.idleTimePending) || (!visibleActive && (props.idleTimeUnavailable || startTime != null)));
	const motion = useRef<ReturnType<typeof animatePanelRoomStart> | null>(null);
	const exitSnapshot = useRef<PanelRoomStart | null>(null);
	const descriptionId = useId();
	const cancelTimers = () => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
	};
	useLayoutEffect(() => {
		if (!startingTime) return;
		const retire = () => setRetiredStart(startingTime.capturedAt);
		const hide = () => { if (document.visibilityState === "hidden") retire(); };
		const timeout = setTimeout(retire, Math.max(0, startDeadline! - performance.now()));
		document.addEventListener("visibilitychange", hide);
		return () => {
			clearTimeout(timeout);
			document.removeEventListener("visibilitychange", hide);
		};
	}, [startingTime?.capturedAt, startDeadline]);
	useLayoutEffect(() => {
		// Reopening during admission recaptures the still-visible Create layout.
		if (!visibleActive && (props.creating || pendingMembership) && stripRef.current && buttonRef.current) {
			start.current = capturePanelRoomStart(stripRef.current, buttonRef.current);
		}
	}, [visibleActive, props.creating, pendingMembership]);

	useLayoutEffect(() => {
		++sequence.current;
		cancelTimers();
		setNotice(null);
		setVisible(false);
		setPending(null);
		return () => {
			++sequence.current;
			cancelTimers();
			motion.current?.cancel();
			motion.current = null;
		};
	}, [scope]);

	useLayoutEffect(() => {
		if (!waitingForRoom || props.creating !== undefined) return;
		const timeout = setTimeout(() => {
			start.current = null;
			startRoomId.current = null;
			setStartTime(undefined);
		}, ROOM_START_PRESENTATION_TIMEOUT_MS);
		return () => clearTimeout(timeout);
	}, [roomId, waitingForRoom, props.creating]);

	useLayoutEffect(() => {
		if (!roomId || !stripRef.current || !buttonRef.current || !start.current)
			return;
		if (startRoomId.current && startRoomId.current !== roomId) {
			start.current = null;
			startRoomId.current = null;
			setStartTime(undefined);
			return;
		}
		startRoomId.current = roomId;
		if (startInterrupted) {
			start.current = null;
			startRoomId.current = null;
			setStartTime(undefined);
			return;
		}
		if (!props.roomReady) return;
		const snapshot = start.current;
		start.current = null;
		startRoomId.current = null;
		setStartTime(undefined);
		motion.current = animatePanelRoomStart(
			snapshot,
			stripRef.current,
			buttonRef.current,
		);
		return () => {
			motion.current?.cancel();
			motion.current = null;
		};
	}, [roomId, props.roomReady, startInterrupted]);
	useLayoutEffect(() => {
		if (props.confirming) motion.current?.cancel();
	}, [props.confirming]);
	useLayoutEffect(() => {
		if (!busy && !roomId && !joining) {
			start.current = null;
			startRoomId.current = null;
			setStartTime(undefined);
			setCreatePointer(null);
		}
	}, [busy, roomId, joining]);
	useLayoutEffect(() => {
		const strip = stripRef.current, button = buttonRef.current;
		if (!strip || !button) return;
		if (visibleActive) {
			exitSnapshot.current = capturePanelRoomStart(strip, button);
		} else if (exitSnapshot.current) {
			const from = exitSnapshot.current;
			exitSnapshot.current = null;
			motion.current?.cancel();
			motion.current = animatePanelRoomStart(from, strip, button, "end");
		}
	});

	const begin = (action: "copy" | "sync") => {
		const operation = ++sequence.current;
		cancelTimers();
		setNotice(null);
		setVisible(false);
		setPending(action);
		return () =>
			operation === sequence.current && currentScope.current === scope;
	};
	const publish = (value: Notice) => {
		setPending(null);
		setNotice(value);
		setVisible(true);
		timers.current.push(setTimeout(() => setVisible(false), 2800));
	};
	const copy = async () => {
		const current = begin("copy");
		let success = false;
		try {
			success = await props.onCopyInvite();
		} catch {
			/* Clipboard rejection is shown below. */
		}
		if (current())
			publish({
				action: "copy",
				error: !success,
				message: success ? "Invite link copied" : "Could not copy. Try again.",
			});
	};
	const sync = () => {
		const current = begin("sync");
		let sent = false;
		try {
			sent = props.onSync();
		} catch {
			/* A closed socket is not success. */
		}
		if (!sent) {
			publish({
				action: "sync",
				error: true,
				message: "Sync unavailable. Try again.",
			});
			return;
		}
		// Only the icon animates; this delay is presentation, not a network ACK.
		const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)")
			.matches
			? 0
			: 650;
		timers.current.push(
			setTimeout(() => {
				if (current())
					publish({ action: "sync", error: false, message: "Synced" });
			}, delay),
		);
	};
	const copied = visible && notice?.action === "copy" && !notice.error;
	const synced = visible && notice?.action === "sync" && !notice.error;
	const showLabel = props.confirming || actionBusy || (!timed && !awaitingTimer);
	return (
		<div
			ref={stripRef}
			className={`panel-actions panel-room-actions ${visibleActive ? "room-active" : "room-empty"}`}
			data-timed={timed}
			data-timed-layout={timedLayout}
			data-awaiting-time={awaitingTimer}
			data-joining={pendingMembership}
		>
			{!visibleActive && !timed && timedLayout && (
				<div className="panel-idle-time panel-time-loading" aria-label="Remaining time unavailable">
					<Timer size={20} strokeWidth={1.8} aria-hidden="true" />
					{props.idleTimeUnavailable ? <button type="button" className="panel-time-retry"
						onClick={props.onRetryHosting} aria-label="Retry loading remaining time" title="Time unavailable. Try again">
						<span aria-hidden="true">—:—</span><RefreshCw size={14} aria-hidden="true" />
					</button> : <span className="panel-time-placeholder" aria-hidden="true" />}
				</div>
			)}
			<button
				ref={buttonRef}
				type="button"
				className={`button primary panel-primary-action${visibleActive ? " room-exit" : ""}${props.confirming ? " confirming" : ""}${actionBusy ? " loading" : ""}`}
				aria-label={label}
				aria-busy={actionBusy}
				aria-describedby={active && timed ? descriptionId : undefined}
				disabled={props.disabled || waitingForRoom || joining || props.closing}
				data-show-action={showLabel}
				data-suppress-start-hover={createPointer !== null}
				onPointerMove={(event) => {
					// Moving the button under a stationary cursor is not a new hover.
					// Track the hand until arrival, then require deliberate movement
					// rather than subpixel/trackpad jitter to reveal the end action.
					if (!active || !props.roomReady || !createPointer) return;
					if (stripRef.current?.dataset.roomMotion === "true") {
						setCreatePointer({ x: event.clientX, y: event.clientY });
					} else if (Math.hypot(event.clientX - createPointer.x, event.clientY - createPointer.y) >= 4) {
						setCreatePointer(null);
					}
				}}
				onClick={(event) => {
					if (!active && stripRef.current && buttonRef.current) {
						setCreatePointer({ x: event.clientX, y: event.clientY });
						start.current = capturePanelRoomStart(
							stripRef.current,
							buttonRef.current,
						);
						// A quick restart can still show the previous room's close feedback.
						start.current.label = "Create room";
						startRoomId.current = null;
						setStartTime(remainingSeconds);
					}
					props.onPrimaryAction(event);
				}}
			>
				{awaitingTimer && (
					<span className="panel-action-time-pending" aria-hidden="true">
						<Timer size={20} strokeWidth={1.8} />
					</span>
				)}
				<span className="panel-action-label" aria-live="polite">
					{label}
				</span>
			</button>
			{timed && (
				<div key="time" className={visibleActive ? "panel-action-timer" : "panel-idle-time"}
					title="Free time remaining today" role="timer" aria-live="off"
					aria-label={`${displaySeconds} seconds of free time remaining today`}>
					<PanelTimeCounter seconds={displaySeconds!} />
				</div>
			)}
			{visibleActive && timed && (
				<span id={descriptionId} className="sr-only" aria-live="off">
					{displaySeconds} seconds of free time remaining today
				</span>
			)}
			{visibleActive && !props.closing && (
				<div
					className="panel-action-icons"
					role="group"
					aria-label="Room actions"
				>
					<button
						type="button"
						aria-label="Copy invite"
						title="Copy invite"
						className={`panel-icon-action reveal-action${copied ? " success" : ""}`}
						disabled={busy || pending === "copy"}
						onClick={() => void copy()}
						style={{ "--action-index": 0 } as CSSProperties}
					>
						{copied ? <Check size={14} /> : <Copy size={14} />}
					</button>
					<button
						type="button"
						aria-label={
							props.inviteOpen
								? "Close friends and groups"
								: "Invite friends and groups"
						}
						title={
							props.inviteOpen
								? "Close friends and groups"
								: "Invite friends and groups"
						}
						className="panel-icon-action reveal-action"
						disabled={props.inviteDisabled || busy}
						onClick={props.onToggleInvite}
						style={{ "--action-index": 1 } as CSSProperties}
					>
						<UserPlus size={14} />
					</button>
					<button
						type="button"
						aria-label="Sync now"
						title={props.isHost ? "Sync now" : "Only the host can sync"}
						className={`panel-icon-action reveal-action panel-sync-action${synced ? " success" : ""}`}
						aria-busy={pending === "sync"}
						data-syncing={pending === "sync"}
						disabled={
							props.syncDisabled || !props.isHost || busy || pending === "sync"
						}
						onClick={sync}
						style={{ "--action-index": 2 } as CSSProperties}
					>
						<RefreshCw size={14} className="panel-sync-icon" />
					</button>
				</div>
			)}
			{visibleActive && (
				<div
					className="panel-media-tooltip panel-action-feedback"
					data-action={notice?.action}
					data-visible={visible}
					data-error={notice?.error}
					role="status"
					aria-live="polite"
					aria-atomic="true"
					aria-hidden={!visible}
				>
					<span className="panel-media-tooltip-icon" aria-hidden="true">
						{notice?.error ? <CircleHelp size={17} /> : <Check size={17} />}
					</span>
					<span className="panel-media-tooltip-copy">
						<strong>{visible ? notice?.message : ""}</strong>
					</span>
				</div>
			)}
		</div>
	);
}
