import {
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
} from "react";
import {
	ArrowLeft,
	Check,
	Copy,
	LoaderCircle,
	Search,
	UserPlus,
	Users,
} from "lucide-react";
import type {
	FriendGroup,
	FriendListItem,
	InviteTargets,
} from "@anidachi/protocol";
import type { FriendInviteLink } from "./friend-invite-link";
import type { RoomInviteTargetStatus } from "./room-invite-target-status";
import {
	capsuleInvitePresentation,
	type CapsuleInviteView,
} from "./capsule-friends-model";
import { capsuleFriendsStyles } from "./capsule-friends-styles";
import { panelMatteGrain } from "./panel-matte-texture";

type Mode = "friends" | "groups";
// Owned above the controls' mount boundary; scoped by account/session and room.
export interface CapsuleFriendLinkCache {
	value: FriendInviteLink | null;
	pending: Promise<FriendInviteLink> | null;
}
export function createCapsuleFriendLinkCache(): CapsuleFriendLinkCache {
	return { value: null, pending: null };
}
export interface CapsuleFriendsPanelProps {
	linkCache?: CapsuleFriendLinkCache;
	open: boolean;
	targets: InviteTargets | null;
	loading: boolean;
	statuses: ReadonlyMap<string, RoomInviteTargetStatus>;
	participants: readonly { id: string }[];
	membershipReady: boolean;
	sending: ReadonlyMap<string, readonly string[]>;
	failedTargets: ReadonlySet<string>;
	notice: { message: string; tone: string } | null;
	onRefresh(): void;
	onClose(): void;
	onSendFriend(friend: FriendListItem): void;
	onSendGroup(group: FriendGroup): void;
	onCreateLink(): Promise<FriendInviteLink>;
}

function InviteAction({
	model,
	name,
	onClick,
}: {
	model: CapsuleInviteView;
	name: string;
	onClick(): void;
}) {
	return (
		<button
			type="button"
			className="cf-invite"
			data-state={model.state}
			disabled={model.disabled}
			aria-busy={model.state === "sending"}
			aria-label={`${model.label}: ${name}`}
			title={model.detail ?? undefined}
			onClick={onClick}
		>
			<span
				className="cf-action-content"
				key={`${model.state}:${model.label}`}
				aria-hidden="true"
			>
				{model.state === "sending" ? (
					<LoaderCircle
						className="cf-sending-icon"
						size={14}
						strokeWidth={1.8}
					/>
				) : (
					<>
						{["sent", "in-room"].includes(model.state) && (
							<Check size={12} strokeWidth={1.8} />
						)}
						<span>{model.label}</span>
					</>
				)}
			</span>
		</button>
	);
}

export function CapsuleFriendsPanel({
	open,
	targets,
	loading,
	statuses,
	participants,
	membershipReady,
	sending,
	failedTargets,
	notice,
	onRefresh,
	onClose,
	onSendFriend,
	onSendGroup,
	onCreateLink,
	linkCache: suppliedLinkCache,
}: CapsuleFriendsPanelProps) {
	const id = useId();
	const localLinkCache = useRef<CapsuleFriendLinkCache>(
		createCapsuleFriendLinkCache(),
	);
	const linkCache = suppliedLinkCache ?? localLinkCache.current;
	const pendingFocus = useRef<"back" | "add" | null>(null);
	const root = useRef<HTMLElement>(null);
	const [frame, setFrame] = useState({ width: 298, height: 249, anchor: 238 });
	const [mode, setMode] = useState<Mode>("friends");
	const [queries, setQueries] = useState({ friends: "", groups: "" });
	const [adding, setAdding] = useState(false);
	const [friendLink, setFriendLink] = useState<FriendInviteLink | null>(
		linkCache.value,
	);
	const [linkBusy, setLinkBusy] = useState(false);
	const linkBusyRef = useRef(false);
	const mounted = useRef(true);
	const [linkError, setLinkError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [copyError, setCopyError] = useState(false);
	const copyAttempt = useRef(0);
	const copyReset = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [status, setStatus] = useState("");
	const query = queries[mode].trim().toLocaleLowerCase();
	const friends = targets?.friends ?? [];
	const groups = targets?.groups ?? [];
	const matchingFriends = friends.filter(({ user }) =>
		`${user.displayName} ${user.handle ?? ""}`
			.toLocaleLowerCase()
			.includes(query),
	);
	const matchingGroups = groups.filter((group) =>
		group.name.toLocaleLowerCase().includes(query),
	);
	const present = new Set(participants.map((person) => person.id));
	const sendingIds = new Set([...sending.values()].flat());
	const modelFor = (ids: string[], key: string) =>
		capsuleInvitePresentation({
			ids,
			statuses,
			present,
			membershipReady,
			sending: sendingIds,
			failed: failedTargets.has(key),
		});

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			copyAttempt.current++;
			if (copyReset.current) clearTimeout(copyReset.current);
		};
	}, []);
	const resetCopy = () => {
		copyAttempt.current++;
		if (copyReset.current) clearTimeout(copyReset.current);
		copyReset.current = null;
		setCopied(false);
		setCopyError(false);
	};
	const createLink = async () => {
		if (linkBusyRef.current) return;
		linkBusyRef.current = true;
		setLinkBusy(true);
		setLinkError(null);
		resetCopy();
		const pending = linkCache.pending ?? Promise.resolve().then(onCreateLink);
		linkCache.pending = pending;
		try {
			const next = await pending;
			linkCache.value = next;
			if (mounted.current) {
				setFriendLink(next);
				setStatus("New invitation link ready. Only one person can use it.");
			}
		} catch {
			if (mounted.current) setLinkError("Could not create a link. Try again.");
		} finally {
			if (linkCache.pending === pending) linkCache.pending = null;
			linkBusyRef.current = false;
			if (mounted.current) setLinkBusy(false);
		}
	};
	const openAddFriend = () => {
		pendingFocus.current = "back";
		setAdding(true);
		resetCopy();
		setStatus("");
		if (
			linkCache.pending ||
			!friendLink ||
			Date.parse(friendLink.expiresAt) <= Date.now()
		)
			void createLink();
	};
	const returnToList = () => {
		pendingFocus.current = "add";
		resetCopy();
		setAdding(false);
		setStatus("");
		onRefresh();
	};
	const copyLink = async () => {
		if (!friendLink || linkBusy) return;
		if (Date.parse(friendLink.expiresAt) <= Date.now()) {
			void createLink();
			return;
		}
		resetCopy();
		const attempt = copyAttempt.current;
		try {
			await navigator.clipboard.writeText(friendLink.url);
			if (!mounted.current || attempt !== copyAttempt.current) return;
			setCopied(true);
			setStatus("Invitation link copied. Send it to one friend.");
			copyReset.current = setTimeout(() => {
				setCopied(false);
				copyReset.current = null;
			}, 2000);
		} catch {
			if (mounted.current && attempt === copyAttempt.current)
				setCopyError(true);
		}
	};
	const close = () => {
		const panel = root.current?.closest(".mini-panel");
		onClose();
		requestAnimationFrame(() =>
			panel
				?.querySelector<HTMLButtonElement>(
					'[aria-label="Invite friends and groups"]',
				)
				?.focus(),
		);
	};
	const selectMode = (value: Mode) => {
		setMode(value);
		setStatus("");
	};
	useLayoutEffect(() => {
		if (!open || !root.current) return;
		const panel = root.current;
		const opener = panel
			.closest(".mini-panel")
			?.querySelector<HTMLButtonElement>(
				'[aria-label="Close friends and groups"]',
			);
		if (!opener) return;
		const align = () => {
			// Layout coordinates exclude the room action's entrance transform and preview zoom.
			const common = panel.closest(".mini-panel");
			const layoutLeft = (element: HTMLElement) => {
				let left = 0;
				for (
					let node: HTMLElement | null = element;
					node && node !== common;
					node = node.offsetParent as HTMLElement | null
				)
					left += node.offsetLeft;
				return left;
			};
			if (!panel.offsetWidth) return;
			const next = {
				width: panel.offsetWidth,
				height: panel.offsetHeight,
				anchor: layoutLeft(opener) + opener.offsetWidth / 2 - layoutLeft(panel),
			};
			setFrame((previous) =>
				Object.keys(next).every(
					(key) =>
						Math.abs(
							previous[key as keyof typeof next] -
								next[key as keyof typeof next],
						) < 0.25,
				)
					? previous
					: next,
			);
		};
		align();
		const observer =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(align);
		observer?.observe(opener);
		observer?.observe(panel);
		window.addEventListener("resize", align);
		return () => {
			observer?.disconnect();
			window.removeEventListener("resize", align);
		};
	}, [open]);

	useLayoutEffect(() => {
		if (!pendingFocus.current) return;
		const selector =
			pendingFocus.current === "back"
				? ".cf-back"
				: ".cf-add, .cf-empty button";
		root.current?.querySelector<HTMLButtonElement>(selector)?.focus();
		pendingFocus.current = null;
	}, [adding]);

	// One continuous surface and outline: the curved attachment is part of the window.
	const w = frame.width,
		h = frame.height + 14,
		r = 15;
	const a = Math.max(r + 24, Math.min(w - r - 24, frame.anchor));
	const top = `M ${r} 14.5 H ${a - 23} C ${a - 12} 14.5 ${a - 7} 8.5 ${a - 1} 2.5 Q ${a} 1.5 ${a + 1} 2.5 C ${a + 7} 8.5 ${a + 12} 14.5 ${a + 23} 14.5 H ${w - r}`;
	const outline = `${top} Q ${w - 0.5} 14.5 ${w - 0.5} ${14 + r} V ${h - r} Q ${w - 0.5} ${h - 0.5} ${w - r} ${h - 0.5} H ${r} Q .5 ${h - 0.5} .5 ${h - r} V ${14 + r} Q .5 14.5 ${r} 14.5 Z`;
	const paintId = id.replace(/[^a-zA-Z0-9_-]/g, "");

	return (
		<div
			className="cf-reveal"
			data-open={open}
			aria-hidden={!open}
			inert={!open}
		>
			<style>{capsuleFriendsStyles}</style>
			<div className="cf-reveal-clip">
				<section
					ref={root}
					className="capsule-friends-panel"
					data-open={open}
					style={{ "--cf-origin": `${a}px` } as CSSProperties}
					aria-label={adding ? "Add friend" : "Friends and groups"}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							event.preventDefault();
							event.stopPropagation();
							adding ? returnToList() : close();
						}
					}}
				>
					<svg
						className="cf-frame"
						viewBox={`0 0 ${w} ${h}`}
						preserveAspectRatio="none"
						aria-hidden="true"
						focusable="false"
					>
						<defs>
							<linearGradient
								id={`${paintId}-surface`}
								x1="0"
								y1="0"
								x2=".65"
								y2="1"
								gradientUnits="objectBoundingBox"
							>
								<stop stopColor="#16181c" />
								<stop offset=".55" stopColor="#101215" />
								<stop offset="1" stopColor="#121417" />
							</linearGradient>
							<pattern
								id={`${paintId}-grain`}
								patternUnits="userSpaceOnUse"
								width="64"
								height="64"
							>
								<image href={panelMatteGrain} width="64" height="64" />
							</pattern>
							<linearGradient
								id={`${paintId}-rim`}
								x1={a - 150}
								y1="0"
								x2={a + 65}
								y2="0"
								gradientUnits="userSpaceOnUse"
							>
								<stop stopColor="#ff8a3d" stopOpacity="0" />
								<stop offset=".6" stopColor="#ffad63" stopOpacity=".42" />
								<stop offset=".7" stopColor="#ffad63" stopOpacity=".85" />
								<stop offset=".83" stopColor="#ffad63" stopOpacity=".65" />
								<stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
							</linearGradient>
						</defs>
						<path d={outline} fill={`url(#${paintId}-surface)`} />
						<path d={outline} fill={`url(#${paintId}-grain)`} />
						<path
							d={outline}
							fill="none"
							stroke="rgba(255,255,255,.2)"
							strokeWidth="1"
						/>
						<path
							d={top}
							fill="none"
							stroke={`url(#${paintId}-rim)`}
							strokeWidth="1.15"
						/>
					</svg>
					<div className="cf-window">
						<header className="cf-header">
							{adding ? (
								<button
									type="button"
									className="cf-back"
									aria-label="Back to friends and groups"
									onClick={returnToList}
								>
									<ArrowLeft size={15} />
									<span>Add friend</span>
								</button>
							) : (
								<div
									className="cf-tabs"
									role="tablist"
									aria-label="Invitation lists"
								>
									{(["friends", "groups"] as const).map((value) => (
										<button
											key={value}
											type="button"
											role="tab"
											id={`${id}-${value}`}
											aria-controls={`${id}-list`}
											aria-selected={mode === value}
											tabIndex={mode === value ? 0 : -1}
											onClick={() => selectMode(value)}
											onKeyDown={(event) => {
												if (
													["ArrowRight", "ArrowLeft", "Home", "End"].includes(
														event.key,
													)
												) {
													event.preventDefault();
													const next =
														event.key === "Home"
															? "friends"
															: event.key === "End"
																? "groups"
																: mode === "friends"
																	? "groups"
																	: "friends";
													selectMode(next);
													(
														event.currentTarget.parentElement?.querySelector(
															`[id="${id}-${next}"]`,
														) as HTMLButtonElement
													)?.focus();
												}
											}}
										>
											{value === "friends" ? "Friends" : "Groups"}
										</button>
									))}
								</div>
							)}
							{!adding && (mode !== "friends" || friends.length > 0) && (
								<button
									type="button"
									className="cf-add"
									onClick={openAddFriend}
								>
									<UserPlus size={14} strokeWidth={1.7} />
									<span>Add friend</span>
								</button>
							)}
						</header>
						{adding ? (
							<div className="cf-add-screen">
								<p>Only one person can use this link.</p>
								<div className="cf-link-field">
									<input
										readOnly
										aria-label="Friend invitation link"
										placeholder={
											linkBusy ? "Preparing your link…" : "Invitation link"
										}
										value={friendLink?.url ?? ""}
										onFocus={(event) => event.currentTarget.select()}
									/>
								</div>
								<button
									type="button"
									className="cf-primary"
									disabled={linkBusy || !friendLink}
									aria-busy={linkBusy}
									onClick={() => void copyLink()}
								>
									<span
										className="cf-action-content"
										key={linkBusy ? "busy" : copied ? "copied" : "copy"}
									>
										{linkBusy ? (
											<LoaderCircle className="cf-sending-icon" size={15} />
										) : copied ? (
											<Check size={15} />
										) : (
											<Copy size={15} />
										)}
										<span>{copied ? "Copied" : "Copy link"}</span>
									</span>
								</button>
								{copyError && (
									<p className="cf-error" role="alert">
										Could not copy. Select the link and copy it manually.
									</p>
								)}
								{linkError && (
									<p className="cf-error" role="alert">
										{linkError}
									</p>
								)}
								<div className="cf-link-footer">
									<button
										type="button"
										className="cf-new-link"
										disabled={linkBusy}
										title="Create a link for another friend"
										onClick={() => void createLink()}
									>
										{linkError ? "Try again" : "New link"}
									</button>
								</div>
							</div>
						) : (
							<>
								{notice?.tone === "error" && (
									<div className="cf-list-notice" role="alert">
										<span>{notice.message}</span>
										<button
											type="button"
											disabled={loading}
											onClick={onRefresh}
										>
											Retry
										</button>
									</div>
								)}
								<label className="cf-search">
									<Search size={15} strokeWidth={1.7} />
									<input
										type="search"
										aria-label={
											mode === "friends" ? "Search friends" : "Search groups"
										}
										placeholder={
											mode === "friends" ? "Search friends" : "Search groups"
										}
										value={queries[mode]}
										onChange={(event) =>
											setQueries((previous) => ({
												...previous,
												[mode]: event.target.value,
											}))
										}
									/>
								</label>
								<div
									className="cf-list"
									role="tabpanel"
									id={`${id}-list`}
									aria-labelledby={`${id}-${mode}`}
									tabIndex={0}
									aria-busy={loading}
								>
									{!targets && loading ? (
										<div
											className="cf-loading"
											role="status"
											aria-label="Loading friends and groups"
										>
											{[0, 1, 2].map((index) => (
												<div className="cf-skeleton" key={index}>
													<span />
													<i />
												</div>
											))}
										</div>
									) : null}
									{mode === "friends" &&
										matchingFriends.map((friend) => {
											const user = friend.user;
											const model = modelFor(
												[user.userId],
												`friend:${user.userId}`,
											);
											return (
												<div className="cf-row" key={user.userId}>
													<div className="cf-person">
														<span
															className="mini-avatar cf-avatar"
															aria-hidden="true"
														>
															{user.displayName[0]}
															{user.avatarUrl && (
																<img
																	src={user.avatarUrl}
																	alt=""
																	referrerPolicy="no-referrer"
																	onError={(event) => {
																		event.currentTarget.hidden = true;
																	}}
																/>
															)}
														</span>
														<span className="cf-copy">
															<strong>{user.displayName}</strong>
															<small data-error={model.state === "error"}>
																{model.detail ??
																	(user.handle ? `@${user.handle}` : "Friend")}
															</small>
														</span>
													</div>
													<InviteAction
														model={model}
														name={user.displayName}
														onClick={() => onSendFriend(friend)}
													/>
												</div>
											);
										})}
									{mode === "groups" &&
										matchingGroups.map((group) => {
											const model = modelFor(
												group.members.map((member) => member.user.userId),
												`group:${group.id}`,
											);
											return (
												<div className="cf-row" key={group.id}>
													<div className="cf-person">
														<span
															className="mini-avatar cf-avatar cf-group"
															aria-hidden="true"
														>
															<Users size={16} strokeWidth={1.6} />
														</span>
														<span className="cf-copy">
															<strong>{group.name}</strong>
															<small data-error={model.state === "error"}>
																{model.detail ??
																	(model.inRoomCount
																		? `${model.inRoomCount}/${group.members.length} in room`
																		: `${group.members.length} ${group.members.length === 1 ? "member" : "members"}`)}
															</small>
														</span>
													</div>
													<InviteAction
														model={model}
														name={group.name}
														onClick={() => onSendGroup(group)}
													/>
												</div>
											);
										})}
									{targets &&
										(mode === "friends"
											? matchingFriends.length === 0
											: matchingGroups.length === 0) && (
											<div className="cf-empty">
												<strong>
													{query
														? "No matches"
														: mode === "friends"
															? "No friends yet"
															: "No groups yet"}
												</strong>
												{query ? (
													<button
														type="button"
														onClick={() =>
															setQueries((previous) => ({
																...previous,
																[mode]: "",
															}))
														}
													>
														Clear search
													</button>
												) : mode === "friends" ? (
													<button type="button" onClick={openAddFriend}>
														<UserPlus size={14} />
														Add friend
													</button>
												) : null}
											</div>
										)}
								</div>
							</>
						)}
						<span className="cf-sr" role="status" aria-live="polite">
							{status || (notice?.tone !== "error" ? notice?.message : "")}
						</span>
					</div>
				</section>
			</div>
		</div>
	);
}
