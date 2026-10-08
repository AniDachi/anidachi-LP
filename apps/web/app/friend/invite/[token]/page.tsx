import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { getSession } from "@/lib/anidachi-auth/session";
import { getFriendInvitePreview, SocialApiError } from "@/lib/anidachi-auth/social";
import { FriendInviteClient } from "./friend-invite-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Friend invite",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
};

function InviteError({ message }: { message: string }) {
  return (
    <AuthPageShell maxWidth="max-w-md">
      <AuthPageCard>
        <p className="text-sm font-medium tracking-[-0.01em] text-ani-muted">
          AniDachi
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ani-text">Friend invite</h1>
        <p className="mt-3 text-sm text-ani-muted">{message}</p>
      </AuthPageCard>
    </AuthPageShell>
  );
}

export default async function FriendInvitePage({ params }: Props) {
  const { token } = await params;
  const returnTo = `/friend/invite/${encodeURIComponent(token)}`;
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  let preview;
  try {
    preview = await getFriendInvitePreview(token, session.userId);
  } catch (error) {
    const message =
      error instanceof SocialApiError
        ? error.message
        : "This friend invite could not be loaded.";
    return <InviteError message={message} />;
  }

  if (preview.sender.userId === session.userId) {
    return <InviteError message="This is your own friend invite link." />;
  }

  return (
    <AuthPageShell maxWidth="max-w-md">
      <p className="text-sm font-medium tracking-[-0.01em] text-ani-muted">
        AniDachi
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-ani-text">Add friend</h1>
      <p className="mt-2 text-sm text-ani-muted">
        Accept the invite to add this person to your AniDachi friends.
      </p>
      <div className="mt-6">
        <FriendInviteClient key={session.userId} sender={preview.sender} token={preview.token} ownerUserId={session.userId} alreadyFriends={preview.alreadyFriends} />
      </div>
    </AuthPageShell>
  );
}
