import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { InviteTicket } from "@/components/invite-ticket";
import type { RoomSourceProvider } from "@anidachi/protocol";
import { RoomInviteExtensionStep } from "@/components/room-invite-extension-step";
import { RoomInviteHelp } from "./room-invite-help";
import styles from "@/components/invite-ticket.module.css";
import { RoomMobileHandoff } from "./room-mobile-handoff";

export function RoomInviteShell({ children }: { children: React.ReactNode }) {
	return (
		<AuthPageShell maxWidth="max-w-md">
			<AuthPageCard>
				<div className="mb-6 flex justify-center">
					<AnidachiLogo size={48} />
				</div>
				{children}
			</AuthPageCard>
		</AuthPageShell>
	);
}

type RoomInviteViewProps = {
	status: string;
	roomTitle: string;
	roomSubtitle: string | null;
	hostName: string | null;
	sourceProvider?: RoomSourceProvider;
	joinAction?: string;
	extensionId?: string | null;
	isParticipant: boolean;
	hasLaunchUrl: boolean;
	initialMobile: boolean;
};

/** Shared invite presentation. Admission and authorization remain in the real route. */
export function RoomInviteView({
	roomTitle,
	roomSubtitle,
	hostName,
	sourceProvider,
	joinAction,
	extensionId,
	isParticipant,
	hasLaunchUrl,
	initialMobile,
}: RoomInviteViewProps) {
  const ctaLabel = isParticipant && hasLaunchUrl ? "Open watchroom" : "Join room";
  return (
    <InviteTicket details={{title: roomTitle, host: hostName, episode: roomSubtitle, provider: sourceProvider}}
      footer={joinAction && <RoomInviteHelp showInstallLink={!extensionId || initialMobile} hasLaunchUrl={hasLaunchUrl} />}>
      <RoomInviteExtensionStep extensionId={extensionId} initialMobile={initialMobile}>
        <form action={joinAction} method="POST">
          <button type={joinAction ? "submit" : "button"} disabled={!joinAction} className={styles.primary}>
            {ctaLabel}
          </button>
        </form>
        <RoomMobileHandoff variant={isParticipant && hasLaunchUrl ? "joined" : "ready"} initialMobile={initialMobile} />
      </RoomInviteExtensionStep>
    </InviteTicket>
  );
}
