"use client";

import {
  Check,
  Inbox,
  RefreshCw,
  Send,
  User,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type PublicProfile = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
};

type RoomInvite = {
  id: string;
  roomId: string;
  sender: PublicProfile;
  targetKind: "direct" | "group";
  targetGroupId: string | null;
  message: string | null;
  roomTitle: string | null;
  sourceUrl: string | null;
  videoFingerprint: string | null;
  createdAt: string;
  expiresAt: string;
  recipients: Array<{
    user: PublicProfile;
    status: string;
    updatedAt: string;
    respondedAt: string | null;
  }>;
};

type InvitesResponse = {
  inbox: RoomInvite[];
  sent: RoomInvite[];
};

type AcceptInviteResponse = {
  invite: RoomInvite;
  roomId: string;
  joinUrl: string;
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

const EMPTY_INVITES: InvitesResponse = {
  inbox: [],
  sent: [],
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | { error?: unknown; message?: unknown }
    | T
    | null;
  if (!response.ok) {
    const errorPayload =
      body && typeof body === "object" && ("message" in body || "error" in body)
        ? (body as { message?: unknown; error?: unknown })
        : null;
    const message = errorPayload
      ? String(errorPayload.message ?? errorPayload.error)
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    headers,
  });
  return readJson<T>(response);
}

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
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-bold text-white">
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
      ? "border-violet-400/30 bg-violet-500 text-white hover:bg-violet-400"
      : tone === "danger"
        ? "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
        : "border-white/15 bg-white/10 text-slate-100 hover:bg-white/15";

  return (
    <button
      aria-label={title}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
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

function inviteStatus(invite: RoomInvite): string {
  return invite.recipients[0]?.status ?? "pending";
}

function isExpired(invite: RoomInvite): boolean {
  return new Date(invite.expiresAt).getTime() <= Date.now();
}

function canRespond(invite: RoomInvite): boolean {
  return inviteStatus(invite) === "pending" && !isExpired(invite);
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
  if (status === "accepted") return "bg-emerald-500/15 text-emerald-200";
  if (status === "declined") return "bg-red-500/15 text-red-200";
  if (status === "expired") return "bg-amber-500/15 text-amber-200";
  return "bg-violet-500/15 text-violet-200";
}

function statusLabel(status: string, expired: boolean): string {
  if (expired && status === "pending") return "expired";
  return status;
}

export function InvitesClient() {
  const [data, setData] = useState<InvitesResponse>(EMPTY_INVITES);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const pendingInbox = useMemo(
    () => data.inbox.filter((invite) => canRespond(invite)),
    [data.inbox],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api<InvitesResponse>("/api/invites");
      setData({
        inbox: Array.isArray(payload.inbox) ? payload.inbox : [],
        sent: Array.isArray(payload.sent) ? payload.sent : [],
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load invites",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setBusyKey(key);
      setNotice(null);
      try {
        await action();
        await refresh();
      } catch (error) {
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "Action failed",
        });
      } finally {
        setBusyKey(null);
      }
    },
    [refresh],
  );

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      await runAction(`accept:${inviteId}`, async () => {
        const payload = await api<AcceptInviteResponse>(`/api/invites/${inviteId}/accept`, {
          method: "POST",
        });
        window.location.assign(payload.joinUrl);
      });
    },
    [runAction],
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      await runAction(`decline:${inviteId}`, async () => {
        await api(`/api/invites/${inviteId}/decline`, { method: "POST" });
        setNotice({ tone: "success", text: "Invite declined." });
      });
    },
    [runAction],
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
            AniDachi
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Invites
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Room invites from friends and group sends.
          </p>
        </div>
        <IconButton
          disabled={loading}
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
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
          role="status"
        >
          {notice.text}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryTile icon={<Inbox className="h-5 w-5" aria-hidden />} label="Pending" value={pendingInbox.length} />
        <SummaryTile icon={<Users className="h-5 w-5" aria-hidden />} label="Inbox" value={data.inbox.length} />
        <SummaryTile icon={<Send className="h-5 w-5" aria-hidden />} label="Sent" value={data.sent.length} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Inbox</h2>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">
              {data.inbox.length}
            </span>
          </div>
          <div className="mt-3">
            {loading ? (
              <p className="py-4 text-sm text-slate-400">Loading...</p>
            ) : data.inbox.length ? (
              data.inbox.map((invite) => (
                <InboxInviteRow
                  busyKey={busyKey}
                  invite={invite}
                  key={invite.id}
                  onAccept={() => void acceptInvite(invite.id)}
                  onDecline={() => void declineInvite(invite.id)}
                />
              ))
            ) : (
              <p className="py-4 text-sm text-slate-400">No room invites yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Sent</h2>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">
              {data.sent.length}
            </span>
          </div>
          <div className="mt-3">
            {loading ? (
              <p className="py-4 text-sm text-slate-400">Loading...</p>
            ) : data.sent.length ? (
              data.sent.map((invite) => <SentInviteRow invite={invite} key={invite.id} />)
            ) : (
              <p className="py-4 text-sm text-slate-400">No sent invites yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 text-violet-200">
          {icon}
        </span>
        <span className="text-sm font-semibold text-slate-200">{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
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
  invite: RoomInvite;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const status = inviteStatus(invite);
  const expired = isExpired(invite);
  const disabled = busyKey !== null || !canRespond(invite);

  return (
    <div className="border-b border-white/10 py-4 last:border-b-0">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 gap-3">
          <Avatar user={invite.sender} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-white">
                {invite.roomTitle ?? "Watch room invite"}
              </h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(
                  statusLabel(status, expired),
                )}`}
              >
                {statusLabel(status, expired)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              From {invite.sender.displayName} · expires {formatDate(invite.expiresAt)}
            </p>
            {invite.message ? (
              <p className="mt-2 rounded-lg bg-white/[0.05] px-3 py-2 text-sm text-slate-300">
                {invite.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
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
          />
        </div>
      </div>
    </div>
  );
}

function SentInviteRow({ invite }: { invite: RoomInvite }) {
  return (
    <div className="border-b border-white/10 py-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-100">
          {invite.targetKind === "group" ? (
            <Users className="h-4 w-4" aria-hidden />
          ) : (
            <User className="h-4 w-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">
            {invite.roomTitle ?? "Watch room invite"}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
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
