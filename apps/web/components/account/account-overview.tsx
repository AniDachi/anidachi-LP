import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CreditCard,
  Inbox,
  Lightbulb,
  Users,
} from "lucide-react";
import { AccountPageHeader } from "./account-ui";
import { AccountWaitlistCard } from "./account-waitlist-card";

export function AccountOverview({
  friendCount,
  groupCount,
  inviteCount,
  waitlist,
}: {
  friendCount: number;
  groupCount: number;
  inviteCount: number;
  waitlist: {
    waitlistPosition: number;
    referralLink: string;
    referralCount: number;
  } | null;
}) {
  return (
    <div className="ac-page ac-overview">
      <AccountPageHeader
        title="Your space"
        description="Your watch history, people, and account in one place."
      />
      <section
        className="ac-library-shortcut"
        aria-labelledby="overview-library"
      >
        <div className="ac-shortcut-icon">
          <BookOpen aria-hidden />
        </div>
        <div>
          <p className="ac-eyebrow">WATCH LIBRARY</p>
          <h2 id="overview-library">Pick up where you left off.</h2>
          <p>
            Find your titles, update episode progress, and keep your history in
            order.
          </p>
          <Link
            className="ac-button ac-button-primary"
            href="/account/watch-library"
          >
            Open library <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </section>
      <div className="ac-overview-links">
        <Link href="/account/invites" className="ac-route-row">
          <Inbox aria-hidden />
          <div>
            <h2>
              Invites{" "}
              {inviteCount > 0 ? (
                <span className="ac-count">{inviteCount}</span>
              ) : null}
            </h2>
            <p>
              {inviteCount > 0
                ? `${inviteCount} room invitation${inviteCount === 1 ? "" : "s"} waiting for you`
                : "Room invitations and friend requests"}
            </p>
          </div>
          <ArrowRight aria-hidden />
        </Link>
        <Link href="/account/friends" className="ac-route-row">
          <Users aria-hidden />
          <div>
            <h2>Friends & Groups</h2>
            <p>
              {friendCount} friend{friendCount === 1 ? "" : "s"} · {groupCount}{" "}
              group{groupCount === 1 ? "" : "s"}
            </p>
          </div>
          <ArrowRight aria-hidden />
        </Link>
        <Link href="/account/billing" className="ac-route-row">
          <CreditCard aria-hidden />
          <div>
            <h2>Subscription</h2>
            <p>Your current plan and renewal settings</p>
          </div>
          <ArrowRight aria-hidden />
        </Link>
        <Link href="/account/feature-requests" className="ac-route-row">
          <Lightbulb aria-hidden />
          <div>
            <h2>Share an idea</h2>
            <p>Tell us what would make AniDachi better for you</p>
          </div>
          <ArrowRight aria-hidden />
        </Link>
      </div>
      {waitlist ? (
        <AccountWaitlistCard {...waitlist} />
      ) : (
        <section className="ac-referral">
          <div>
            <h2>Early access</h2>
            <p>Join the waitlist and see your place in line.</p>
          </div>
          <Link href="/join" className="ac-button">
            Join the waitlist <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      )}
    </div>
  );
}
