import type { Metadata } from "next";
import { RoomSourceProviderSchema } from "@anidachi/protocol";
import { notFound } from "next/navigation";
import { InviteTicket } from "@/components/invite-ticket";
import type { InviteTicketDetails } from "@/lib/room-ticket";
import { InviteInstallPrompt } from "@/components/room-invite-extension-step";
import { InviteSignIn } from "@/components/invite-sign-in";
import { getStagingAccessConfig } from "@/lib/staging-access";
import styles from "@/components/invite-ticket.module.css";
import { RoomInviteView } from "../../room/[roomId]/room-invite-view";

export const metadata: Metadata = { title: "Room invite preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const sample = { title: "The Queen’s Gambit", episode: "S1 E1 · Openings", host: "Ads Mag", provider: "netflix" } satisfies InviteTicketDetails;
const views = { join: "Join", login: "Sign in", install: "Install" } as const;

export default async function RoomInvitePreviewPage({ searchParams }: { searchParams: Promise<{view?: string; platform?: string}> }) {
  const local = process.env.NODE_ENV === "development";
  if (!local && !(process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "staging" && (await getStagingAccessConfig()).enabled)) notFound();
  const { view, platform } = await searchParams;
  const provider = RoomSourceProviderSchema.safeParse(platform).data ?? sample.provider;
  const ticket = provider === sample.provider ? sample : {
    provider, host: sample.host, title: "Let’s pick something together", episode: null,
  };
  const state = view === "login" || view === "install" ? view : "join";
  return <>
    <nav aria-label="Preview states" className={styles.preview}>
      <span>{local ? "Local preview" : "Staging preview"}</span>
      {Object.entries(views).map(([key, label]) =>
        <a key={key} aria-current={key === state ? "page" : undefined} href={`?view=${key}&platform=${provider}`}>{label}</a>)}
    </nav>
    {state === "join" ? <RoomInviteView
      status="live" roomTitle={ticket.title} roomSubtitle={ticket.episode} sourceProvider={ticket.provider}
      hostName={ticket.host} hasLaunchUrl={Boolean(ticket.episode)} isParticipant={false} initialMobile={false}
    /> : <InviteTicket details={ticket}>
      {state === "install" ? <InviteInstallPrompt /> : <InviteSignIn emailEnabled preview returnTo="" />}
    </InviteTicket>}
  </>;
}
