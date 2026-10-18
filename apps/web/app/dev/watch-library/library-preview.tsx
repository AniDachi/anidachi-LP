"use client";

import { useState } from "react";
import { AccountNav } from "../../account/account-nav";
import { AnidachiLogoLink } from "@/components/anidachi-logo";
import { LibraryEmptyState } from "../../account/watch-library/library-empty-state";

export function LibraryPreview() {
  const [canRecord, setCanRecord] = useState(false);
  return <main id="main-content" className="account-workspace min-h-screen bg-background text-foreground/90">
    <header className="account-header">
      <AnidachiLogoLink size={28} />
      <div className="account-identity"><span className="account-plan">{canRecord ? "Plus" : "Free"}</span><span>Alex · Preview</span></div>
    </header>
    <label className="flex justify-center gap-2 px-4 py-3 text-xs text-ani-muted"><input type="checkbox" checked={canRecord} onChange={e => setCanRecord(e.target.checked)} />Local preview · Active Plus / trial</label>
    <div className="account-frame">
      <aside className="account-sidebar"><AccountNav /></aside>
      <section className="account-content min-w-0">
        <div className="wh-page wh-page-first-watch">
          <header className="wh-page-heading"><h1>Watch Library</h1></header>
          <LibraryEmptyState canRecord={canRecord} />
        </div>
      </section>
    </div>
  </main>;
}
