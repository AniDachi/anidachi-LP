"use client";

import {
  type AccountInboxResponse,
  type PublicProfile,
  type RoomInvite,
  RoomInvitesResponseSchema,
} from "@anidachi/protocol";
import { Check, Inbox, RefreshCw, Send, User, Users, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  accountInboxSeenItems,
  appendAccountInboxPage,
  applyAccountInboxSeenAcknowledgement,
  parseOwnedAccountInboxResponse,
} from "@/lib/anidachi-auth/account-inbox-client";
import { api } from "@/lib/client-api";

type AccountInboxItem = AccountInboxResponse["items"][number];
type ActiveRoomInvite = Extract<AccountInboxItem, { kind: "room-invite"; state: "active" }>;
type MissedRoomInvite = Extract<AccountInboxItem, { kind: "room-invite"; state: "missed" }>;
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
      <img alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" src={user.avatarUrl} />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-bold text-foreground">
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
      ? "border-brand-orange/30 bg-brand-orange text-foreground hover:bg-brand-orange-deep"
      : tone === "danger"
        ? "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
        : "border-brand-border bg-brand-surface text-foreground/90 hover:bg-brand-orange";

  return (
    <button
      aria-label={title}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-0 ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {icon}
      {children ? <span className="hidden sm:inline">{children}</span> : null}
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
      inbox?.items.filter((item): item is InboxFriendRequest => item.kind === "friend-request") ??
      [],
    [inbox],
  );
  const activeRoomInvites = useMemo(
    () =>
      inbox?.items.filter(
        (item): item is ActiveRoomInvite => item.kind === "room-invite" && item.state === "active",
      ) ?? [],
    [inbox],
  );
  const missedRoomInvites = useMemo(
    () =>
      inbox?.items.filter(
        (item): item is MissedRoomInvite => item.kind === "room-invite" && item.state === "missed",
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
      const nextInbox = parseOwnedAccountInboxResponse(inboxPayload, ownerUserId);
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
      setInbox((current) => (current ? appendAccountInboxPage(current, page) : page));
    } catch (error) {
      if (!isCurrent()) return;
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load more invites",
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

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 border-b border-brand-border pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-orange">
            AniDachi
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Invites
          </h1>
          <p className="mt-2 text-sm text-foreground/50">
            Friend requests, room invitations, and recent missed invitations.
          </p>
        </div>
        <IconButton
          disabled={loading || loadingMore || busyKey !== null}
          icon={<RefreshCw className="h-4 w-4" aria-hidden />}
          onClick={() => void refresh()}
          title="Refresh"
        >
          Refresh
        </IconButton>
      </header>

      {notice ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-brand-orange/30 bg-brand-orange/10 text-brand-orange"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
          role="status"
        >
          {notice.text}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={<Inbox className="h-5 w-5" aria-hidden />}
          label="Actionable"
          value={inbox?.counts.actionable ?? 0}
        />
        <SummaryTile
          icon={<Users className="h-5 w-5" aria-hidden />}
          label="Room invites"
          value={inbox?.counts.activeRoomInvites ?? 0}
        />
        <SummaryTile
          icon={<User className="h-5 w-5" aria-hidden />}
          label="Friend requests"
          value={inbox?.counts.pendingFriendRequests ?? 0}
        />
        <SummaryTile
          icon={<Send className="h-5 w-5" aria-hidden />}
          label="Sent"
          value={sentInvites.length}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Inbox</h2>
            <span className="rounded-full bg-brand-surface px-2.5 py-1 text-xs text-foreground/70">
              {inbox?.items.length ?? 0}
            </span>
          </div>
          <div className="mt-3">
            {loading ? (
              <p className="py-4 text-sm text-foreground/50">Loading...</p>
            ) : inbox?.items.length ? (
              <div className="divide-y divide-brand-border">
                <InboxSubsection count={friendRequests.length} label="Friend requests">
                  {friendRequests.map((request) => (
                    <FriendRequestRow
                      busyKey={loadingMore ? "inbox:loading" : busyKey}
                      key={request.friendshipId}
                      request={request}
                      onAccept={() => void acceptFriendRequest(request.friendshipId)}
                      onDecline={() => void declineFriendRequest(request.friendshipId)}
                    />
                  ))}
                </InboxSubsection>
                <InboxSubsection count={activeRoomInvites.length} label="Room invites">
                  {activeRoomInvites.map((invite) => (
                    <InboxInviteRow
                      busyKey={loadingMore ? "inbox:loading" : busyKey}
                      invite={invite}
                      key={invite.inviteId}
                      onAccept={() => void acceptInvite(invite.inviteId)}
                      onDecline={() => void declineInvite(invite.inviteId)}
                    />
                  ))}
                </InboxSubsection>
                <InboxSubsection count={missedRoomInvites.length} label="Missed">
                  {missedRoomInvites.map((invite) => (
                    <MissedInviteRow invite={invite} key={invite.inviteId} />
                  ))}
                </InboxSubsection>
                {inbox.nextCursor ? (
                  <button
                    className="mt-4 min-h-11 w-full rounded-lg border border-brand-border bg-brand-surface px-4 text-sm font-semibold text-foreground/80 transition hover:border-brand-orange/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loadingMore || busyKey !== null}
                    onClick={() => void loadMore()}
                    type="button"
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="py-4 text-sm text-foreground/50">Your inbox is clear.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Sent</h2>
            <span className="rounded-full bg-brand-surface px-2.5 py-1 text-xs text-foreground/70">
              {sentInvites.length}
            </span>
          </div>
          <div className="mt-3">
            {loading ? (
              <p className="py-4 text-sm text-foreground/50">Loading...</p>
            ) : sentInvites.length ? (
              sentInvites.map((invite) => <SentInviteRow invite={invite} key={invite.id} />)
            ) : (
              <p className="py-4 text-sm text-foreground/50">No sent invites yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
          {icon}
        </span>
        <span className="text-sm font-semibold text-foreground/80">{label}</span>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
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
  return (
    <section className="py-3 first:pt-0 last:pb-0" aria-label={label}>
      <div className="flex items-center justify-between gap-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/45">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      {count ? children : <p className="py-3 text-sm text-foreground/40">Nothing here.</p>}
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
    <div className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar user={request.sender} />
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">
            {request.sender.displayName}
          </h3>
          <p className="mt-1 text-sm text-foreground/50">
            {request.sender.handle ? `@${request.sender.handle}` : "Wants to be friends"} ·{" "}
            {formatDate(request.activityAt)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
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
    <div className="border-b border-brand-border py-4 last:border-b-0">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 gap-3">
          <Avatar user={invite.sender} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-foreground">
                {invite.roomTitle ?? "Watch room invite"}
              </h3>
              <span className="rounded-full bg-brand-orange/15 px-2.5 py-1 text-xs font-semibold text-brand-orange">
                active
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground/50">
              {invite.targetGroupName ? `${invite.targetGroupName} · ` : ""}
              From {invite.sender.displayName} · {formatDate(invite.activityAt)}
            </p>
            {invite.message ? (
              <p className="mt-2 rounded-lg bg-brand-surface px-3 py-2 text-sm text-foreground/70">
                {invite.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <IconButton
            disabled={disabled}
            icon={<Check className="h-4 w-4" aria-hidden />}
            onClick={onAccept}
            title="Accept invite"
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
    <div className="py-4">
      <div className="flex min-w-0 gap-3">
        <Avatar user={invite.sender} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {invite.roomTitle ?? "Missed room invite"}
            </h3>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
              missed
            </span>
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
    <div className="border-b border-brand-border py-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange">
          {invite.targetKind === "group" ? (
            <Users className="h-4 w-4" aria-hidden />
          ) : (
            <User className="h-4 w-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {invite.roomTitle ?? "Watch room invite"}
          </h3>
          <p className="mt-1 text-xs text-foreground/50">
            Sent {formatDate(invite.createdAt)} · expires {formatDate(invite.expiresAt)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {invite.recipients.map((recipient) => (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(
                  recipient.status,
                )}`}
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
