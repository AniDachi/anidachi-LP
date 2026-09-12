import {
	ArrowUpRight,
	Check,
	Inbox,
	LoaderCircle,
	Play,
	RefreshCw,
	Users,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { AccountInboxResponse } from "@anidachi/protocol";
import type { AccountOwnedState } from "./account-sync";
import type {
	PopupInboxFriendRequest,
	PopupInboxInvite,
	PopupInboxModel,
} from "./popup-people-model";

export type InboxInviteAction = "join" | "decline";

export function PopupInboxPanel({
	actionNotice = null,
	busyFriendRequestActionKey,
	busyInviteId,
	busyInviteAction = null,
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
	actionNotice?: {
		actionKey: string;
		tone: "success" | "warning" | "error";
		text: string;
	} | null;
	busyFriendRequestActionKey: string | null;
	busyInviteId: string | null;
	busyInviteAction?: InboxInviteAction | null;
	model: PopupInboxModel | null;
	onAcceptFriendRequest: (friendshipId: string) => void;
	onAcceptInvite: (inviteId: string) => void;
	onDeclineFriendRequest: (friendshipId: string) => void;
	onDeclineInvite: (inviteId: string) => void;
	onOpenDashboard: () => void;
	onRefresh: () => void;
	onSignIn: () => void;
	state: AccountOwnedState<AccountInboxResponse>;
}) {
	const busy = Boolean(busyFriendRequestActionKey || busyInviteId);
	const disabled = state.status !== "ready" || busy;
	const refreshing = state.status === "loading";
	const hasCache = Boolean(model) && state.status !== "signed-out";
	const hasItems =
		hasCache &&
		Boolean(
			model!.friendRequests.length +
				model!.activeRoomInvites.length +
				model!.missedRoomInvites.length,
		);
	const stale = hasCache && (refreshing || state.status === "error");
	const notice =
		actionNotice && /^(accept|decline)-friend:/.test(actionNotice.actionKey)
			? actionNotice
			: null;

	return (
		<section className="popup-section inbox-panel" aria-label="Inbox">
			<div className="inbox-toolbar">
				<h2>Invitations</h2>
				<button
					className="inbox-icon-button"
					aria-label="Refresh inbox"
					title="Refresh inbox"
					disabled={refreshing || busy || state.status === "signed-out"}
					type="button"
					onClick={onRefresh}
				>
					<RefreshCw
						size={16}
						className={refreshing ? "inbox-spin" : undefined}
					/>
				</button>
			</div>

			{state.status === "signed-out" ? (
				<InboxState
					title="Your invitations, in one place"
					description="Sign in to view friend requests and room invites."
				>
					<button className="inbox-primary" type="button" onClick={onSignIn}>
						Sign in
					</button>
				</InboxState>
			) : null}

			{state.status === "error" && !hasCache ? (
				<InboxState
					title="Could not load invitations"
					description={state.error}
				>
					<button className="inbox-primary" type="button" onClick={onRefresh}>
						Retry
					</button>
				</InboxState>
			) : null}

			{refreshing && !hasCache ? (
				<div className="inbox-loading" role="status" aria-label="Loading inbox">
					{[0, 1, 2].map((row) => (
						<div className="inbox-skeleton" aria-hidden="true" key={row}>
							<i />
							<span />
						</div>
					))}
					<span className="inbox-loading-label">Loading invitations…</span>
				</div>
			) : null}

			{stale ? (
				<div
					className="inbox-status"
					data-state={state.status === "error" ? "error" : "stale"}
					role="status"
				>
					<span>
						{state.status === "error"
							? `${state.error} Saved inbox data may be out of date.`
							: "Refreshing inbox. Saved data may be out of date."}
					</span>
					{state.status === "error" ? (
						<button type="button" disabled={busy} onClick={onRefresh}>
							Retry
						</button>
					) : null}
				</div>
			) : null}

			<div aria-live="polite" aria-atomic="true">
				{notice ? (
					<div className="inbox-status" data-tone={notice.tone}>
						{notice.text}
					</div>
				) : null}
			</div>

			{hasCache && !hasItems ? (
				<InboxState
					title={
						state.status === "ready"
							? "You’re all caught up"
							: "No saved invitations"
					}
					description="Room invites and friend requests will appear here."
				/>
			) : null}

			{hasItems && model ? (
				<div className="inbox-sections">
					{model.friendRequests.length ? (
						<InboxSection
							label="Friend requests"
							count={model.friendRequests.length}
						>
							{model.friendRequests.map((request) => (
								<FriendRequestRow
									key={request.friendshipId}
									request={request}
									disabled={disabled}
									busyActionKey={busyFriendRequestActionKey}
									onAccept={() => onAcceptFriendRequest(request.friendshipId)}
									onDecline={() => onDeclineFriendRequest(request.friendshipId)}
								/>
							))}
						</InboxSection>
					) : null}
					{model.activeRoomInvites.length ? (
						<InboxSection
							label="Room invites"
							count={model.activeRoomInvites.length}
						>
							{model.activeRoomInvites.map((invite) => (
								<RoomInviteRow
									key={invite.inviteId}
									invite={invite}
									disabled={disabled}
									busyAction={
										busyInviteId === invite.inviteId ? busyInviteAction : null
									}
									onJoin={() => onAcceptInvite(invite.inviteId)}
									onDecline={() => onDeclineInvite(invite.inviteId)}
								/>
							))}
						</InboxSection>
					) : null}
					{model.missedRoomInvites.length ? (
						<InboxSection label="Missed" count={model.missedRoomInvites.length}>
							{model.missedRoomInvites.map((invite) => (
								<RoomInviteRow
									key={invite.inviteId}
									invite={invite}
									disabled
									busyAction={null}
								/>
							))}
						</InboxSection>
					) : null}
				</div>
			) : null}

			{state.status !== "signed-out" ? (
				<button
					className="inbox-website"
					type="button"
					onClick={onOpenDashboard}
				>
					View on website <ArrowUpRight size={13} />
				</button>
			) : null}
		</section>
	);
}

function InboxState({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children?: ReactNode;
}) {
	return (
		<div className="inbox-empty">
			<Inbox size={29} strokeWidth={1.35} aria-hidden="true" />
			<h3>{title}</h3>
			<p>{description}</p>
			{children}
		</div>
	);
}

function InboxSection({
	children,
	count,
	label,
}: {
	children: ReactNode;
	count: number;
	label: string;
}) {
	return (
		<section className="inbox-section" aria-label={label}>
			<h3 className="inbox-heading">
				<span>{label}</span>
				<span>{count}</span>
			</h3>
			<div className="inbox-list">{children}</div>
		</section>
	);
}

function FriendRequestRow({
	request,
	disabled,
	busyActionKey,
	onAccept,
	onDecline,
}: {
	request: PopupInboxFriendRequest;
	disabled: boolean;
	busyActionKey: string | null;
	onAccept: () => void;
	onDecline: () => void;
}) {
	const accepting = busyActionKey === `accept-friend:${request.friendshipId}`;
	const declining = busyActionKey === `decline-friend:${request.friendshipId}`;
	return (
		<article className="inbox-friend" aria-busy={accepting || declining}>
			<div className="inbox-sender">
				<InboxAvatar profile={request.sender} />
				<div className="inbox-person">
					<strong>{request.sender.displayName}</strong>
					<span>
						{request.sender.handle
							? `@${request.sender.handle}`
							: "Wants to be friends"}
					</span>
				</div>
				<ActivityTime value={request.activityAt} />
			</div>
			<div className="inbox-actions">
				<button
					className="inbox-primary"
					type="button"
					disabled={disabled}
					onClick={onAccept}
					aria-label={`Accept friend request from ${request.sender.displayName}`}
				>
					{accepting ? <Spinner /> : <Check size={14} />}
					{accepting ? "Accepting…" : "Accept"}
				</button>
				<button
					className="inbox-secondary"
					type="button"
					disabled={disabled}
					onClick={onDecline}
					aria-label={`Decline friend request from ${request.sender.displayName}`}
				>
					{declining ? <Spinner /> : null}
					{declining ? "Declining…" : "Decline"}
				</button>
			</div>
		</article>
	);
}

function RoomInviteRow({
	invite,
	disabled,
	busyAction,
	onJoin,
	onDecline,
}: {
	invite: PopupInboxInvite;
	disabled: boolean;
	busyAction: InboxInviteAction | null;
	onJoin?: () => void;
	onDecline?: () => void;
}) {
	const missed = invite.state === "missed";
	return (
		<article
			className="inbox-room"
			data-state={missed ? "missed" : "active"}
			aria-busy={Boolean(busyAction)}
		>
			<div className="inbox-sender">
				<InboxAvatar profile={invite.sender} />
				<div className="inbox-person">
					<strong>{invite.sender.displayName}</strong>
					<span>{missed ? "Missed invite" : "Invited you to watch"}</span>
				</div>
				<ActivityTime value={invite.activityAt} />
			</div>
			<div className="inbox-room-copy">
				<h4>{invite.roomTitle || "Watch together"}</h4>
				{invite.targetGroupName ? (
					<div className="inbox-group">
						<Users size={12} aria-hidden="true" />
						<span>{invite.targetGroupName}</span>
					</div>
				) : null}
				{invite.message ? (
					<p className="inbox-message">{invite.message}</p>
				) : null}
			</div>
			{!missed ? (
				<div className="inbox-actions">
					<button
						className="inbox-primary"
						type="button"
						disabled={disabled}
						onClick={onJoin}
						aria-label={`Join room invite from ${invite.sender.displayName}`}
					>
						{busyAction === "join" ? (
							<Spinner />
						) : (
							<Play size={13} fill="currentColor" />
						)}
						{busyAction === "join" ? "Joining…" : "Join room"}
					</button>
					<button
						className="inbox-secondary"
						type="button"
						disabled={disabled}
						onClick={onDecline}
						aria-label={`Decline room invite from ${invite.sender.displayName}`}
					>
						{busyAction === "decline" ? <Spinner /> : null}
						{busyAction === "decline" ? "Declining…" : "Decline"}
					</button>
				</div>
			) : null}
		</article>
	);
}

function InboxAvatar({ profile }: { profile: PopupInboxInvite["sender"] }) {
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const initials =
		profile.displayName
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join("") || "A";
	return profile.avatarUrl && profile.avatarUrl !== failedUrl ? (
		<img
			className="inbox-avatar"
			alt=""
			src={profile.avatarUrl}
			loading="lazy"
			onError={() => setFailedUrl(profile.avatarUrl)}
		/>
	) : (
		<span className="inbox-avatar" aria-hidden="true">
			{initials}
		</span>
	);
}

function ActivityTime({ value }: { value: string }) {
	const timestamp = new Date(value).getTime();
	if (!Number.isFinite(timestamp)) return null;
	const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
	const label =
		minutes < 1
			? "now"
			: minutes < 60
				? `${minutes}m ago`
				: minutes < 1440
					? `${Math.floor(minutes / 60)}h ago`
					: new Date(timestamp).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						});
	return (
		<time
			className="inbox-time"
			dateTime={value}
			title={new Date(timestamp).toLocaleString()}
		>
			{label}
		</time>
	);
}

function Spinner() {
	return <LoaderCircle size={14} className="inbox-spin" aria-hidden="true" />;
}
