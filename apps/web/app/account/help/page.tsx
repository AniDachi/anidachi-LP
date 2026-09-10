import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Puzzle, Users } from "lucide-react";
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
        <p>Quick paths for setting up a watch night and keeping your group organized.</p>
      </header>
      <div className="help-grid">
        <section><Puzzle aria-hidden /><h2>Set up the extension</h2><p>Install AniDachi in desktop Chrome, open a supported Crunchyroll or YouTube watch page, then create a room.</p><Link href="/watch-party-starter">Open the setup guide <ArrowRight size={15} aria-hidden /></Link></section>
        <section><BookOpen aria-hidden /><h2>Manage watch history</h2><p>Resume saved titles, filter your library, and update episode progress from your account.</p><Link href="/account/watch-library">Open Watch Library <ArrowRight size={15} aria-hidden /></Link></section>
        <section><Users aria-hidden /><h2>Watch with your group</h2><p>Add friends, organize private groups, and use room invitations for each watch session.</p><Link href="/account/friends">Open Friends &amp; Groups <ArrowRight size={15} aria-hidden /></Link></section>
      </div>
      <section className="help-support">
        <div><h2>Still need help?</h2><p>Tell us what happened and include your browser and extension version when useful.</p></div>
        <div className="help-actions"><Link href="/contact">Contact support</Link><Link href="/account/feature-requests">Share an idea</Link></div>
      </section>
    </div>
  );
}
