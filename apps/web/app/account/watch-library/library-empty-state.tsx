"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Chrome } from "lucide-react";
import { InstallLink } from "@/components/install-link";
import { INSTALL_HUB_PATH } from "@/lib/install-cta";
import { EXTENSION_USING_HASH } from "@/lib/extension-using-guide";

/** Presentation only; callers must establish that the whole library is empty. */
export function LibraryEmptyState({ canRecord }: { canRecord: boolean }) {
  return <section className="wh-first-watch" aria-labelledby="library-empty-title">
    <Image className="wh-first-watch-icon" src="/illustrations/watch-library-book.png" width={148} height={148} sizes="(max-width: 600px) 104px, 148px" alt="" />
    <h2 id="library-empty-title">Your watch library<br /><span>starts here.</span></h2>
    <p className="wh-first-watch-description">Install AniDachi to watch with friends<br className="wh-first-watch-break" /> and keep track of your progress.</p>
    <InstallLink className="wh-first-watch-install" href={INSTALL_HUB_PATH}>
      <Chrome size={26} strokeWidth={1.8} aria-hidden />Install AniDachi
    </InstallLink>
    <div className="wh-first-watch-note">
      <p>{canRecord ? "Turn on Allow recording in the extension to save your progress." : "Saving progress requires Plus or Pro."}</p>
      <Link href={canRecord ? `${INSTALL_HUB_PATH}#${EXTENSION_USING_HASH}` : "/pricing"}>
        {canRecord ? "Set up your library" : "View plans"}<ArrowRight size={17} aria-hidden />
      </Link>
    </div>
  </section>;
}
