"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Loader2, UserPlus } from "lucide-react";

type PublicProfile = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
};

type Props = {
  sender: PublicProfile;
  token: string;
};

async function readJson(response: Response): Promise<void> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "Could not accept invite");
  }
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  );
}

export function FriendInviteClient({ sender, token }: Props) {
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptInvite = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/friends/invite-links/${encodeURIComponent(token)}/accept`, {
          method: "POST",
        }),
      );
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
    } finally {
      setBusy(false);
    }
  }, [token]);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center gap-4">
        {sender.avatarUrl ? (
          <img
            alt=""
            className="h-14 w-14 rounded-full object-cover"
            src={sender.avatarUrl}
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-500 text-lg font-bold text-white">
            {initials(sender.displayName)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-white">{sender.displayName}</p>
          <p className="truncate text-sm text-slate-400">
            {sender.handle ? `@${sender.handle}` : "AniDachi user"}
          </p>
        </div>
      </div>

      {accepted ? (
        <div className="mt-6 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <Check className="mr-2 inline h-4 w-4" aria-hidden />
          You are friends now.
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || accepted}
          onClick={acceptInvite}
          type="button"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden />
          )}
          {accepted ? "Accepted" : "Add friend"}
        </button>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
          href="/account/friends"
        >
          Open friends
        </Link>
      </div>
    </div>
  );
}
