import type { Metadata } from "next";
import Link from "next/link";
import { OverlayUsingGuide } from "@/components/overlay-using-guide";
import "../profile/profile.css";

export const metadata: Metadata = {
  title: "Help",
  robots: { index: false, follow: false },
};

export default function AccountHelpPage() {
  return (
    <div className="ac-page profile-page help-page">
      <header className="ac-page-header profile-heading">
        <p className="profile-eyebrow">HELP</p>
        <h1>Get started with AniDachi</h1>
        <p>
          A watch party runs in the Chrome extension, on each person’s own
          Crunchyroll or YouTube tab. Open a title, then use the same controls
          shown below.
        </p>
      </header>
      <section className="help-block">
        <h2>Before the room starts</h2>
        <ul className="help-facts">
          <li>Sign in on Crunchyroll or YouTube with your own account. AniDachi does not share logins.</li>
          <li>Use a Crunchyroll title or a full youtube.com/watch page. Shorts, embeds, and the homepage do not sync.</li>
          <li>If the browser blocked autoplay, or an ad paused sync, click Resume sync in the player.</li>
          <li>On Free, a room you host lasts 30 minutes a day once a guest joins. Waiting alone does not use that time. Pausing the video does not stop it. A warning appears with five minutes left.</li>
        </ul>
        <div className="help-links">
          <Link href="/account/friends">Friends &amp; Groups</Link>
          <Link href="/account/billing">Subscription</Link>
          <Link href="/account/watch-library">Watch Library</Link>
        </div>
      </section>
      <OverlayUsingGuide compact />
      <section className="help-support">
        <div>
          <h2>Still need help?</h2>
          <p>
            Tell us what happened and include your browser and extension version
            when useful.
          </p>
        </div>
        <div className="help-actions">
          <Link href="/account/bug-report">Report a bug</Link>
          <Link href="/contact">Contact support</Link>
          <Link href="/account/feature-requests">Share an idea</Link>
        </div>
      </section>
    </div>
  );
}
