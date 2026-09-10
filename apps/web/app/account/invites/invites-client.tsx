"use client";

import {
  type AccountInboxResponse,
  type PublicProfile,
  type RoomInvite,
  RoomInvitesResponseSchema,
} from "@anidachi/protocol";
import { Check, Inbox, RefreshCw, Send, User, Users, X } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  accountInboxSeenItems,
  appendAccountInboxPage,
  applyAccountInboxSeenAcknowledgement,
  parseOwnedAccountInboxResponse,
} from "@/lib/anidachi-auth/account-inbox-client";
import {
  AccountEmptyState,
  AccountPageHeader,
  AccountSectionSwitch,
} from "@/components/account/account-ui";
import { api } from "@/lib/client-api";

type AccountInboxItem = AccountInboxResponse["items"][number];
type ActiveRoomInvite = Extract<
  AccountInboxItem,
  { kind: "room-invite"; state: "active" }
>;
type MissedRoomInvite = Extract<
  AccountInboxItem,
  { kind: "room-invite"; state: "missed" }
>;
type InboxFriendRequest = Extract<AccountInboxItem, { kind: "friend-request" }>;

type AcceptInviteResponse = {
  invite: RoomInvite;
  roomId: string;
  joinUrl: string;
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  );
}

function Avatar({ user }: { user: PublicProfile }) {
  if (user.avatarUrl) {
    return (
      <img
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        src={user.avatarUrl}
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#44362c] text-sm font-medium text-[#eee5d9]">
      {initials(user.displayName)}
    </span>
  );
}

function IconButton({
  children,
  disabled,
  icon,
  onClick,
  title,
  tone = "default",
}: {
  children?: ReactNode;
  disabled?: boolean;
  icon: ReactNode;
  onClick?: () => void;
  title: string;
  tone?: "default" | "danger" | "primary";
}) {
  const toneClass =
    tone === "primary"
      ? "ac-button-primary"
      : tone === "danger"
        ? "ac-button-danger"
        : "";

  return (
    <button
      aria-label={title}
      className={`ac-button ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {icon}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string): string {
  if (status === "accepted") return "bg-brand-orange/15 text-brand-orange";
  if (status === "declined") return "bg-red-500/15 text-red-200";
  if (status === "expired") return "bg-amber-500/15 text-amber-200";
  return "bg-brand-orange/15 text-brand-orange";
}

async function acknowledgeInboxPageSeen(
  page: AccountInboxResponse,
  ownerUserId: string,
): Promise<AccountInboxResponse> {
  const unseenItems = accountInboxSeenItems(page);
  if (unseenItems.length === 0) return page;

  const payload = await api<unknown>("/api/account/inbox/seen?limit=100", {
    method: "POST",
    body: JSON.stringify({ items: unseenItems }),
  });
  const acknowledgement = parseOwnedAccountInboxResponse(payload, ownerUserId);
  return applyAccountInboxSeenAcknowledgement(page, acknowledgement);
}

export function InvitesClient({ ownerUserId }: { ownerUserId: string }) {
  const [view, setView] = useState<"incoming" | "sent">("incoming");
  const [inbox, setInbox] = useState<AccountInboxResponse | null>(null);
  const [sentInvites, setSentInvites] = useState<RoomInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const refreshGenerationRef = useRef(0);
  const ownerUserIdRef = useRef<string | null>(ownerUserId);

  const friendRequests = useMemo(
    () =>
      inbox?.items.filter(
        (item): item is InboxFriendRequest => item.kind === "friend-request",
      ) ?? [],
    [inbox],
  );
  const activeRoomInvites = useMemo(
    () =>
      inbox?.items.filter(
        (item): item is ActiveRoomInvite =>
          item.kind === "room-invite" && item.state === "active",
      ) ?? [],
    [inbox],
  );
  const missedRoomInvites = useMemo(
    () =>
      inbox?.items.filter(
        (item): item is MissedRoomInvite =>
          item.kind === "room-invite" && item.state === "missed",
      ) ?? [],
    [inbox],
  );

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current;
    const isCurrent = () => refreshGenerationRef.current === generation;
    setLoading(true);
    setNotice(null);
    try {
      const [inboxPayload, invitesPayload] = await Promise.all([
        api<unknown>("/api/account/inbox?limit=100"),
        api<unknown>("/api/invites"),
      ]);
      const nextInbox = parseOwnedAccountInboxResponse(
        inboxPayload,
        ownerUserId,
      );
      const invites = RoomInvitesResponseSchema.parse(invitesPayload);
      if (!isCurrent()) return;
      setSentInvites(invites.sent);

      let displayInbox = nextInbox;
      try {
        displayInbox = await acknowledgeInboxPageSeen(nextInbox, ownerUserId);
      } catch {
        if (!isCurrent()) return;
        setNotice({
          tone: "error",
          text: "Inbox loaded, but read status could not be updated.",
        });
      }
      if (!isCurrent()) return;
      setInbox(displayInbox);
    } catch (error) {
      if (!isCurrent()) return;
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load invites",
      });
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [ownerUserId]);

  const loadMore = useCallback(async () => {
    const cursor = inbox?.nextCursor;
    if (!cursor || loading || loadingMore || busyKey !== null) return;
    const generation = ++refreshGenerationRef.current;
    const isCurrent = () => refreshGenerationRef.current === generation;
    setLoadingMore(true);
    setNotice(null);
    try {
      const pagePayload = await api<unknown>(
        `/api/account/inbox?limit=100&cursor=${encodeURIComponent(cursor)}`,
      );
      let page = parseOwnedAccountInboxResponse(pagePayload, ownerUserId);
      try {
        page = await acknowledgeInboxPageSeen(page, ownerUserId);
      } catch {
        if (!isCurrent()) return;
        setNotice({
          tone: "error",
          text: "Invites loaded, but read status could not be updated.",
        });
      }
      if (!isCurrent()) return;
      setInbox((current) =>
        current ? appendAccountInboxPage(current, page) : page,
      );
    } catch (error) {
      if (!isCurrent()) return;
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not load more invites",
      });
    } finally {
      if (isCurrent()) setLoadingMore(false);
    }
  }, [busyKey, inbox?.nextCursor, loading, loadingMore, ownerUserId]);

  useEffect(() => {
    ownerUserIdRef.current = ownerUserId;
    refreshGenerationRef.current += 1;
    setInbox(null);
    setSentInvites([]);
    setNotice(null);
    setLoading(false);
    setLoadingMore(false);
    setBusyKey(null);
    void refresh();
    return () => {
      refreshGenerationRef.current += 1;
      ownerUserIdRef.current = null;
    };
  }, [refresh]);

  const runAction = useCallback(
    async <T,>(
      key: string,
      action: () => Promise<T>,
      onSuccess?: (result: T) => void | Promise<void>,
    ) => {
      if (loading || loadingMore || busyKey !== null) return;
      const actionOwnerUserId = ownerUserId;
      const isCurrentOwner = () => ownerUserIdRef.current === actionOwnerUserId;
      if (!isCurrentOwner()) return;
      setBusyKey(key);
      setNotice(null);
      try {
        const result = await action();
        if (!isCurrentOwner()) return;
        await onSuccess?.(result);
        if (!isCurrentOwner()) return;
        await refresh();
      } catch (error) {
        if (!isCurrentOwner()) return;
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "Action failed",
        });
      } finally {
        if (isCurrentOwner()) setBusyKey(null);
      }
    },
    [busyKey, loading, loadingMore, ownerUserId, refresh],
  );

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      await runAction(
        `accept:${inviteId}`,
        () =>
          api<AcceptInviteResponse>(`/api/invites/${inviteId}/accept`, {
            method: "POST",
          }),
        (payload) => window.location.assign(payload.joinUrl),
      );
    },
    [runAction],
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      await runAction(
        `decline:${inviteId}`,
        () => api(`/api/invites/${inviteId}/decline`, { method: "POST" }),
        () => setNotice({ tone: "success", text: "Invite declined." }),
      );
    },
    [runAction],
  );

  const acceptFriendRequest = useCallback(
    async (friendshipId: string) => {
      await runAction(`accept-friend:${friendshipId}`, async () => {
        await api(`/api/friends/requests/${friendshipId}/accept`, {
          method: "POST",
        });
      });
    },
    [runAction],
  );

  const declineFriendRequest = useCallback(
    async (friendshipId: string) => {
      await runAction(`decline-friend:${friendshipId}`, async () => {
        await api(`/api/friends/requests/${friendshipId}/decline`, {
          method: "POST",
        });
      });
    },
    [runAction],
  );

  const rowBusyKey = loading || loadingMore ? "inbox:loading" : busyKey;

  return (
    <div className="ac-page ac-invites">
      <AccountPageHeader
        title="Invites"
        description="Join a room, connect with friends, or check an invitation you sent."
        action={
          <IconButton
            disabled={loading || loadingMore || busyKey !== null}
            icon={
              <RefreshCw
                className={`h-4 w-4 ${loading ? "ac-spinning" : ""}`}
                aria-hidden
              />
            }
            onClick={() => void refresh()}
            title="Refresh"
          >
            Refresh
          </IconButton>
        }
      />
      {notice ? (
        <div
          className={`ac-notice ${notice.tone === "error" ? "ac-notice-error" : ""}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.text}
        </div>
      ) : null}
      <AccountSectionSwitch
        label="Invitation view"
        value={view}
        onChange={setView}
        options={[
          {
            value: "incoming",
            label: "Incoming",
            count: inbox?.counts.actionable,
          },
          { value: "sent", label: "Sent" },
        ]}
      />
      {view === "incoming" ? (
        <div
          aria-label="Incoming invitations"
          aria-busy={loading || loadingMore}
        >
          {loading && !inbox ? (
            <p role="status" className="ac-loading">
              Loading invitations…
            </p>
          ) : inbox ? (
            <>
              <InboxSubsection
                count={activeRoomInvites.length}
                label="Room invites"
              >
                {activeRoomInvites.map((invite) => (
                  <InboxInviteRow
                    key={invite.inviteId}
                    invite={invite}
                    busyKey={rowBusyKey}
                    onAccept={() => void acceptInvite(invite.inviteId)}
                    onDecline={() => void declineInvite(invite.inviteId)}
                  />
                ))}
              </InboxSubsection>
              <InboxSubsection
                count={friendRequests.length}
                label="Friend requests"
              >
                {friendRequests.map((request) => (
                  <FriendRequestRow
                    key={request.friendshipId}
                    request={request}
                    busyKey={rowBusyKey}
                    onAccept={() =>
                      void acceptFriendRequest(request.friendshipId)
                    }
                    onDecline={() =>
                      void declineFriendRequest(request.friendshipId)
                    }
                  />
                ))}
              </InboxSubsection>
              {!activeRoomInvites.length && !friendRequests.length ? (
                <AccountEmptyState
                  icon={<Inbox />}
                  title={
                    inbox.counts.actionable > 0
                      ? "More invitations available"
                      : "Nothing waiting for a reply"
                  }
                >
                  {inbox.counts.actionable > 0
                    ? "Load more invitations to find the remaining requests."
                    : "New room invitations and friend requests will appear here."}
                </AccountEmptyState>
              ) : null}
              {missedRoomInvites.length ? (
                <details className="ac-missed">
                  <summary>
                    Missed invitations <span>{missedRoomInvites.length}</span>
                  </summary>
                  {missedRoomInvites.map((invite) => (
                    <MissedInviteRow key={invite.inviteId} invite={invite} />
                  ))}
                </details>
              ) : null}
              {inbox.nextCursor ? (
                <button
                  type="button"
                  className="ac-button ac-load-more"
                  disabled={loading || loadingMore || busyKey !== null}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? "Loading…" : "Load more invitations"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div aria-label="Sent invitations" aria-busy={loading}>
          {loading && !inbox ? (
            <p role="status" className="ac-loading">
              Loading invitations…
            </p>
          ) : inbox ? (
            sentInvites.length ? (
              <>
                <p className="ac-muted">Recent invitations and responses.</p>
                {sentInvites.map((invite) => (
                  <SentInviteRow key={invite.id} invite={invite} />
                ))}
              </>
            ) : (
              <AccountEmptyState
                icon={<Send />}
                title="No sent invitations yet"
              >
                Invite friends or a group from the room controls in your player.
              </AccountEmptyState>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

function InboxSubsection({
  children,
  count,
  label,
}: {
  children: ReactNode;
  count: number;
  label: string;
}) {
  if (!count) return null;
  return (
    <section className="ac-inbox-section" aria-label={label}>
      <div className="ac-section-heading">
        <h2>
          {label} <span className="ac-count">{count}</span>
        </h2>
      </div>
      {children}
    </section>
  );
}

function FriendRequestRow({
  busyKey,
  onAccept,
  onDecline,
  request,
}: {
  busyKey: string | null;
  onAccept: () => void;
  onDecline: () => void;
  request: InboxFriendRequest;
}) {
  const busy =
    busyKey === `accept-friend:${request.friendshipId}` ||
    busyKey === `decline-friend:${request.friendshipId}`;
  return (
    <div className="ac-invite-row ac-invite-person">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar user={request.sender} />
        <div className="min-w-0">
          <h3 className="ac-invite-title">{request.sender.displayName}</h3>
          <p className="mt-1 text-sm text-foreground/50">
            {request.sender.handle
              ? `@${request.sender.handle}`
              : "Wants to be friends"}{" "}
            · {formatDate(request.activityAt)}
          </p>
        </div>
      </div>
      <div className="ac-invite-actions">
        <IconButton
          disabled={busyKey !== null}
          icon={<Check className="h-4 w-4" aria-hidden />}
          onClick={onAccept}
          title="Accept friend request"
          tone="primary"
        >
          Accept
        </IconButton>
        <IconButton
          disabled={busyKey !== null}
          icon={<X className="h-4 w-4" aria-hidden />}
          onClick={onDecline}
          title="Decline friend request"
        >
          {busy ? "Working" : "Decline"}
        </IconButton>
      </div>
    </div>
  );
}

function InboxInviteRow({
  busyKey,
  invite,
  onAccept,
  onDecline,
}: {
  busyKey: string | null;
  invite: ActiveRoomInvite;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const disabled = busyKey !== null;

  return (
    <div className="ac-invite-row">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 gap-3">
          <Avatar user={invite.sender} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="ac-invite-title">
                {invite.roomTitle ?? "Watch room invite"}
              </h3>
              <span className="ac-live-label">active</span>
            </div>
            <p className="mt-1 text-sm text-foreground/50">
              {invite.targetGroupName ? `${invite.targetGroupName} · ` : ""}
              From {invite.sender.displayName} · {formatDate(invite.activityAt)}
            </p>
            {invite.message ? (
              <p className="ac-invite-message">{invite.message}</p>
            ) : null}
          </div>
        </div>
        <div className="ac-invite-actions">
          <IconButton
            disabled={disabled}
            icon={<Check className="h-4 w-4" aria-hidden />}
            onClick={onAccept}
            title="Join room"
            tone="primary"
          >
            Join
          </IconButton>
          <IconButton
            disabled={disabled}
            icon={<X className="h-4 w-4" aria-hidden />}
            onClick={onDecline}
            title="Decline invite"
          >
            Decline
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function MissedInviteRow({ invite }: { invite: MissedRoomInvite }) {
  return (
    <div className="ac-invite-row">
      <div className="flex min-w-0 gap-3">
        <Avatar user={invite.sender} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="ac-invite-title">
              {invite.roomTitle ?? "Missed room invite"}
            </h3>
            <span className="ac-status">missed</span>
          </div>
          <p className="mt-1 text-sm text-foreground/50">
            From {invite.sender.displayName} · {formatDate(invite.missedAt)}
          </p>
          {invite.message ? (
            <p className="mt-2 text-sm text-foreground/65">{invite.message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SentInviteRow({ invite }: { invite: RoomInvite }) {
  return (
    <div className="ac-invite-row">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange">
          {invite.targetKind === "group" ? (
            <Users className="h-4 w-4" aria-hidden />
          ) : (
            <User className="h-4 w-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="ac-invite-title">
            {invite.roomTitle ?? "Watch room invite"}
          </h3>
          <p className="mt-1 text-xs text-foreground/50">
            Sent {formatDate(invite.createdAt)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {invite.recipients.map((recipient) => (
              <span
                className={`ac-recipient ${statusTone(recipient.status)}`}
                key={recipient.user.userId}
              >
                {recipient.user.displayName}
                <span className="opacity-75">{recipient.status}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
