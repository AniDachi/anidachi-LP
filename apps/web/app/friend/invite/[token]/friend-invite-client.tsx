"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SOCIAL_OWNER_HEADER } from "@/lib/social-editor-contracts";

type PublicProfile = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
};

type Props = {
  alreadyFriends?: boolean;
  ownerUserId: string;
  sender: PublicProfile;
  token: string;
};

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
  const [needsLogin, setNeedsLogin] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const confirmationRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (accepted && !alreadyFriends) confirmationRef.current?.focus();
  }, [accepted, alreadyFriends]);

  const acceptInvite = useCallback(async () => {
    if (busyRef.current || accepted) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/friends/invite-links/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          headers: { [SOCIAL_OWNER_HEADER]: ownerUserId },
        },
      );
      if (response.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: unknown;
        friendship?: { status?: unknown };
      } | null;
      if (!response.ok || body?.friendship?.status !== "accepted") {
        if (
          [403, 404, 410].includes(response.status) ||
          (response.status === 409 && body?.error === "This invite has already been used. Ask for a new link.")
        ) {
          setUnavailable(true);
        }
        throw new Error(
          response.status < 500 && !response.ok && typeof body?.error === "string"
            ? body.error
            : "Could not add friend. Please try again.",
        );
      }
      setAccepted(true);
    } catch (err) {
      setError(
        err instanceof Error && err.name !== "TypeError"
          ? err.message
          : "Could not add friend. Please try again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [token, ownerUserId, accepted]);

  return (
    <div className="rounded-[20px] border border-ani-line bg-ani-panel p-6 sm:p-8">
      <div className="flex items-center gap-4">
        {sender.avatarUrl ? (
          <img
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover"
            src={sender.avatarUrl}
          />
        ) : (
          <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-ani-line bg-ani-canvas text-xl font-semibold text-ani-text">
            {initials(sender.displayName)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold leading-snug tracking-[-0.02em] text-ani-text">
            {sender.displayName}
          </h1>
          {sender.handle ? (
            <p className="mt-1 break-words text-sm text-ani-muted">@{sender.handle}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6" aria-live="polite">
        {accepted ? (
          <p
            ref={confirmationRef}
            tabIndex={-1}
            role="status"
            className="flex min-h-11 items-center gap-2.5 text-base font-medium text-ani-text outline-none"
          >
            <Check className="h-5 w-5 shrink-0 text-ani-progress" aria-hidden />
            You’re now friends
          </p>
        ) : (
          <>
            {!unavailable && (
              <p className="text-base leading-relaxed text-ani-muted">
                {needsLogin ? "Sign in to accept this invitation." : "Invites you to be friends"}
              </p>
            )}
            {unavailable ? null : needsLogin ? (
              <Button asChild className="mt-6 w-full" size="control" variant="cream">
                <a href={`/login?next=${encodeURIComponent(`/friend/invite/${encodeURIComponent(token)}`)}`}>
                  Sign in
                </a>
              </Button>
            ) : (
              <Button
                className="mt-6 w-full"
                disabled={busy}
                aria-busy={busy}
                onClick={acceptInvite}
                size="control"
                type="button"
                variant="cream"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <UserPlus className="h-4 w-4" aria-hidden />
                )}
                Add friend
              </Button>
            )}
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm leading-relaxed text-ani-error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
