import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
          AniDachi
        </p>
        <h1 className="mt-3 text-2xl font-bold text-white">Friend invite</h1>
        <p className="mt-3 text-sm text-slate-300">{message}</p>
      </div>
    </main>
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
    preview = await getFriendInvitePreview(token);
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
          AniDachi
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">Add friend</h1>
        <p className="mt-2 text-sm text-slate-400">
          Accept the invite to add this person to your AniDachi friends.
        </p>
        <div className="mt-6">
          <FriendInviteClient sender={preview.sender} token={preview.token} />
        </div>
      </div>
    </main>
  );
}
