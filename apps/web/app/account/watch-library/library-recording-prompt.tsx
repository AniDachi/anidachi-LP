"use client";

import Image from "next/image";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { CHROME_WEB_STORE_URL } from "@/lib/install-cta";

export function LibraryRecordingPrompt({ empty, installed, canRecord }: {
  empty: boolean;
  installed: boolean | null;
  canRecord: boolean;
}) {
  let description = "Your saved titles and progress will appear here.";
  let action = null;
  const linkClass = empty ? "wh-first-watch-install" : "wh-recording-link";

  if (installed === false) {
    description = "Install the AniDachi extension to connect this browser to your watch library.";
    action = <InstallLink className={linkClass} href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer">Install AniDachi</InstallLink>;
  } else if (installed && !canRecord) {
    description = "With Plus or Pro, AniDachi saves new titles and your watch progress automatically.";
    action = <Link className={linkClass} href="/pricing">View plans</Link>;
  } else if (installed) {
    description = "Turn on Allow recording in AniDachi, then start watching. Your progress will appear here.";
  }

  if (!empty) {
    return action && <aside className="wh-recording-prompt">
      <p>{description}</p>{action}
    </aside>;
  }
  return <section className="wh-first-watch" aria-labelledby="library-empty-title">
    <Image className="wh-first-watch-icon" src="/illustrations/watch-library-book.png" width={148} height={148} sizes="(max-width: 600px) 104px, 148px" alt="" />
    <h2 id="library-empty-title">Your watch library<br /><span>starts here.</span></h2>
    <p className="wh-first-watch-description">{description}</p>
    {action}
  </section>;
}
