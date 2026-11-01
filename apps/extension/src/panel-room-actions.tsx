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

export interface PanelRoomActionsProps {
	scopeKey: string;
	roomId: string | null;
	isHost: boolean;
	label: string;
	disabled: boolean;
	busy: boolean;
	confirming: boolean;
	remainingSeconds: number | null;
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

export function PanelRoomActions(props: PanelRoomActionsProps) {
	const { roomId, remainingSeconds, busy } = props;
	const active = roomId !== null;
	const timed = remainingSeconds !== null && (!active || props.isHost);
	const scope = `${props.scopeKey}:${roomId ?? "idle"}`;
	const currentScope = useRef(scope);
	currentScope.current = scope;
	const sequence = useRef(0);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [visible, setVisible] = useState(false);
	const [pending, setPending] = useState<"copy" | "sync" | null>(null);
	const [showAction, setShowAction] = useState(false);
	const stripRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const start = useRef<PanelRoomStart | null>(null);
	const motion = useRef<ReturnType<typeof animatePanelRoomStart> | null>(null);
	const descriptionId = useId();
	const cancelTimers = () => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
	};

	useLayoutEffect(() => {
		++sequence.current;
		cancelTimers();
		setNotice(null);
		setVisible(false);
		setPending(null);
		setShowAction(false);
		return () => {
			++sequence.current;
			cancelTimers();
		};
	}, [scope]);

	useLayoutEffect(() => {
		if (!roomId || !stripRef.current || !buttonRef.current || !start.current)
			return;
		const snapshot = start.current;
		start.current = null;
		motion.current = animatePanelRoomStart(
			snapshot,
			stripRef.current,
			buttonRef.current,
		);
		return () => {
			motion.current?.cancel();
			motion.current = null;
		};
	}, [roomId]);
	useLayoutEffect(() => {
		if (!busy && !roomId) start.current = null;
	}, [busy, roomId]);

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
					publish({ action: "sync", error: false, message: "Sync sent" });
			}, delay),
		);
	};
	const copied = visible && notice?.action === "copy" && !notice.error;
	const synced = visible && notice?.action === "sync" && !notice.error;
	const showLabel = showAction || props.confirming || busy || !timed;
	return (
		<div
			ref={stripRef}
			className={`panel-actions panel-room-actions ${active ? "room-active" : "room-empty"}`}
			data-timed={timed}
		>
			{!active && timed && (
				<div
					className="panel-idle-time"
					title="Free time remaining today"
					role="timer"
					aria-label={`${remainingSeconds} seconds of free time remaining today`}
					aria-live="off"
				>
					<PanelTimeCounter seconds={remainingSeconds!} />
				</div>
			)}
			<button
				ref={buttonRef}
				type="button"
				className={`button primary panel-primary-action${active ? " room-exit" : ""}${props.confirming ? " confirming" : ""}${busy ? " loading" : ""}`}
				aria-label={props.label}
				aria-describedby={active && timed ? descriptionId : undefined}
				disabled={props.disabled}
				data-show-action={showLabel}
				onPointerEnter={() => setShowAction(true)}
				onPointerLeave={() => setShowAction(false)}
				onFocus={() => setShowAction(true)}
				onBlur={() => setShowAction(false)}
				onClick={(event) => {
					if (!active && stripRef.current && buttonRef.current)
						start.current = capturePanelRoomStart(
							stripRef.current,
							buttonRef.current,
						);
					props.onPrimaryAction(event);
				}}
			>
				{active && timed && (
					<span className="panel-action-timer">
						<PanelTimeCounter seconds={remainingSeconds!} />
					</span>
				)}
				<span className="panel-action-label" aria-live="polite">
					{props.label}
				</span>
			</button>
			{active && timed && (
				<span id={descriptionId} className="sr-only" aria-live="off">
					{remainingSeconds} seconds of free time remaining today
				</span>
			)}
			{active && (
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
			{active && (
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
