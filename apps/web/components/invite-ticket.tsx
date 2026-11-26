import type { InviteTicketDetails } from "@/lib/room-ticket";
import { useId, type ReactNode } from "react";
import { ANIDACHI_LOGO_SRC } from "@/lib/brand";
import type { RoomSourceProvider } from "@anidachi/protocol";
import { ProviderLogo } from "../../extension/src/provider-logo";
import { InviteTicketMotion } from "./invite-ticket-motion";
import { InviteTicketTitle } from "./invite-ticket-title";
import styles from "./invite-ticket.module.css";

const platforms = {
  crunchyroll: { name: "Crunchyroll" },
  disneyplus: { name: "Disney+", wordmark: "disneyplus.svg" },
  hbomax: { name: "HBO Max", wordmark: "hbomax.png" },
  netflix: { name: "Netflix", wordmark: "netflix.svg" },
  primevideo: { name: "Prime Video", wordmark: "primevideo.svg" },
  youtube: { name: "YouTube", wordmark: "youtube-wordmark.svg" },
} satisfies Record<RoomSourceProvider, { name: string; wordmark?: string }>;

function WatchPlatform({ provider }: { provider: RoomSourceProvider }) {
  const platform = platforms[provider];
  return (
    <p className={styles.platform} data-platform={provider}>
      {"wordmark" in platform ? (
        <img className={styles.wordmark} src={`/platforms/${platform.wordmark}`} alt={platform.name} />
      ) : (
        <span className={styles.brandName}>
          <ProviderLogo provider={provider} label={platform.name} />
          {platform.name}
        </span>
      )}
    </p>
  );
}

function GoldLeafPattern() {
  const id = useId();
  return (
    <svg className={styles.paperPattern} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${id}-tile`} width="62" height="62" patternUnits="userSpaceOnUse">
          <image href={ANIDACHI_LOGO_SRC} x="6" y="5" width="20" height="20" />
          <image href={ANIDACHI_LOGO_SRC} x="37" y="36" width="20" height="20" />
        </pattern>
        <mask id={`${id}-mask`} x="0" y="0" width="100%" height="100%" maskUnits="userSpaceOnUse">
          <rect width="100%" height="100%" fill={`url(#${id}-tile)`} />
        </mask>
        <rect id={`${id}-imprint`} width="100%" height="100%" mask={`url(#${id}-mask)`} />
        <linearGradient id={`${id}-leaf`} x1="0%" y1="50%" x2="38%" y2="10%" spreadMethod="reflect">
          <stop stopColor="#b88636" />
          <stop offset=".36" stopColor="#e8bd60" />
          <stop offset=".52" stopColor="#fff0ad" />
          <stop offset=".65" stopColor="#e7bc66" />
          <stop offset="1" stopColor="#b77e29" />
        </linearGradient>
      </defs>
      <use href={`#${id}-imprint`} x=".35" y=".65" fill="#fff0bd" />
      <use href={`#${id}-imprint`} x="-.35" y="-.65" fill="#8d4e1f" />
      <use href={`#${id}-imprint`} fill={`url(#${id}-leaf)`} />
    </svg>
  );
}

export function InviteTicket({ details, children, footer }: { details: InviteTicketDetails; children: ReactNode; footer?: ReactNode }) {
  const { title, host, episode, provider } = details;
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.frame}>
        <InviteTicketMotion face={<>
            <GoldLeafPattern />
            <p className={styles.host}>
              {host ? <><strong>{host}</strong> invited you to watch together</> : "You’re invited to watch together"}
            </p>
            <InviteTicketTitle title={title} />
            {episode && <p className={styles.episode}>{episode}</p>}
            {provider && <WatchPlatform provider={provider} />}
        </>}>
          <div className={styles.actions}>{children}</div>
        </InviteTicketMotion>
        {footer}
      </div>
    </main>
  );
}
