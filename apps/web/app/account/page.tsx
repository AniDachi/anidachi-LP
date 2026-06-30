import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight, Bell, UserRoundPlus, Users } from "lucide-react";
import { AccountWaitlistCard } from "@/components/account/account-waitlist-card";
import { getSession } from "@/lib/anidachi-auth/session";
import { getAccountWaitlistStatus } from "@/lib/kreatli-crm/survey-lead";
import {
  listFriendGroups,
  listFriends,
  listRoomInvites,
} from "@/lib/anidachi-auth/social";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Overview",
  robots: { index: false, follow: false },
};

function StatPanel({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-foreground/50">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default async function AccountOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount");

  const [friends, groups, invites, waitlist] = await Promise.all([
    listFriends(session.userId),
    listFriendGroups(session.userId),
    listRoomInvites(session.userId),
    getAccountWaitlistStatus(session.email),
  ]);
  const activeGroups = groups.filter((group) => !group.archivedAt);
  const pendingInvites = invites.inbox.filter((invite) =>
    invite.recipients.some(
      (recipient) => recipient.user.userId === session.userId && recipient.status === "pending",
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      {waitlist ? (
        <AccountWaitlistCard
          waitlistPosition={waitlist.waitlistPosition}
          referralLink={waitlist.referralLink}
          referralCount={waitlist.referralCount}
        />
      ) : (
        <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Join the waitlist</h2>
              <p className="mt-1 text-sm text-foreground/50">
                Sign up to get early access and see your place in line.
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-brand-orange px-4 text-sm font-semibold text-primary-foreground transition hover:bg-brand-orange-deep"
              href="/join"
            >
              Sign up
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <StatPanel
          icon={<UserRoundPlus className="h-5 w-5" aria-hidden />}
          label="Friends"
          value={friends.friends.length}
        />
        <StatPanel
          icon={<Users className="h-5 w-5" aria-hidden />}
          label="Groups"
          value={activeGroups.length}
        />
        <StatPanel
          icon={<Bell className="h-5 w-5" aria-hidden />}
          label="Pending invites"
          value={pendingInvites.length}
        />
      </section>

      <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Friends & Groups</h2>
            <p className="mt-1 text-sm text-foreground/50">
              Manage friend requests and watch groups.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-orange px-4 text-sm font-semibold text-primary-foreground transition hover:bg-brand-orange-deep"
            href="/account/friends"
          >
            Open
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
