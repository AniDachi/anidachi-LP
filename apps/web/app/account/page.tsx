import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountOverview } from "@/components/account/account-overview";
import { listAccountInbox } from "@/lib/anidachi-auth/account-inbox";
import { getSession } from "@/lib/anidachi-auth/session";
import { getAccountWaitlistStatus } from "@/lib/kreatli-crm/survey-lead";
import { listFriendGroups, listFriends } from "@/lib/anidachi-auth/social";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Overview",
  robots: { index: false, follow: false },
};

export default async function AccountOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount");

  const [friends, groups, inbox, waitlist] = await Promise.all([
    listFriends(session.userId),
    listFriendGroups(session.userId),
    listAccountInbox({ ownerUserId: session.userId, limit: 1 }),
    getAccountWaitlistStatus(session.email),
  ]);
  const activeGroups = groups.filter((group) => !group.archivedAt);

  return (
    <AccountOverview
      friendCount={friends.friends.length}
      groupCount={activeGroups.length}
      inviteCount={inbox.counts.activeRoomInvites}
      waitlist={waitlist}
    />
  );
}
