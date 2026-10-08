"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type PublicProfile = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
};

import { SOCIAL_OWNER_HEADER } from "@/lib/social-editor-contracts";

type Props = {
  alreadyFriends?: boolean;
  ownerUserId: string;
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

export function FriendInviteClient({ sender, token, ownerUserId, alreadyFriends = false }: Props) {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(alreadyFriends);
  const [error, setError] = useState<string | null>(null);

  const acceptInvite = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/friends/invite-links/${encodeURIComponent(token)}/accept`, {
          method: "POST",
          headers: { [SOCIAL_OWNER_HEADER]: ownerUserId },
        }),
      );
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [token, ownerUserId]);

  return (
    <div className="rounded-[20px] border border-ani-line bg-ani-panel p-6">
      <div className="flex items-center gap-4">
        {sender.avatarUrl ? (
          <img
            alt=""
            className="h-14 w-14 rounded-full object-cover"
            src={sender.avatarUrl}
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-ani-line bg-ani-canvas text-lg font-semibold text-ani-text">
            {initials(sender.displayName)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-[-0.02em] text-ani-text">{sender.displayName}</p>
          <p className="truncate text-sm text-ani-muted">
            {sender.handle ? `@${sender.handle}` : "AniDachi user"}
          </p>
        </div>
      </div>

      {accepted ? (
        <div className="mt-6 rounded-[12px] border border-ani-line bg-ani-selected-quiet px-4 py-3 text-sm text-ani-text">
          <Check className="mr-2 inline h-4 w-4 text-ani-progress" aria-hidden />
          You are friends.
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          className="w-full sm:w-auto"
          disabled={busy || accepted}
          onClick={acceptInvite}
          size="control"
          type="button"
          variant="cream"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden />
          )}
          {accepted ? "Already friends" : "Add friend"}
        </Button>
        <Button asChild className="w-full sm:w-auto" size="control" variant="creamOutline">
          <Link href="/account/friends">Open friends</Link>
        </Button>
      </div>
    </div>
  );
}
