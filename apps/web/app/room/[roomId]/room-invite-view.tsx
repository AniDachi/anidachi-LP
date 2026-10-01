import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { ArrowRight } from "lucide-react";
import type { RoomSourceProvider } from "@anidachi/protocol";
import { RoomInviteHelp } from "./room-invite-help";
import styles from "./room-invite.module.css";
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
	hostName: string;
	sourceProvider?: RoomSourceProvider;
	joinAction?: string;
	isParticipant: boolean;
	hasLaunchUrl: boolean;
	initialMobile: boolean;
};

/** Shared invite presentation. Admission and authorization remain in the real route. */
export function RoomInviteView({
	status,
	roomTitle,
	roomSubtitle,
	hostName,
	sourceProvider,
	joinAction,
	isParticipant,
	hasLaunchUrl,
	initialMobile,
}: RoomInviteViewProps) {
	const platform =
		sourceProvider === "crunchyroll"
			? "Crunchyroll"
			: sourceProvider === "youtube"
				? "YouTube"
				: null;
	const ctaLabel =
		isParticipant && hasLaunchUrl ? "Open watchroom" : "Join room";
	return (
		<main id="main-content" className={styles.page}>
			<div className={styles.content}>
				<header>
					<p className={styles.invitation}>
						Watch together with <strong>{hostName}</strong>
					</p>
					<h1 className={styles.title}>{roomTitle}</h1>
					<div className={styles.metadata}>
						{platform && <span>{platform}</span>}
						{roomSubtitle && <span>{roomSubtitle}</span>}
						<span className={styles.status}>
							<i aria-hidden="true" />
							{status === "live" ? "Live room" : "Lobby"}
						</span>
					</div>
				</header>

				<div className={styles.join}>
					<form action={joinAction} method="POST">
						<button
							type={joinAction ? "submit" : "button"}
							className={styles.primary}
						>
							{ctaLabel}
							<ArrowRight size={18} aria-hidden="true" />
						</button>
					</form>
					<p className={styles.nextStep}>Join free. No subscription needed.</p>
				</div>

				<RoomMobileHandoff
					variant={isParticipant && hasLaunchUrl ? "joined" : "ready"}
					initialMobile={initialMobile}
				/>
				<RoomInviteHelp hasLaunchUrl={hasLaunchUrl} />
			</div>
		</main>
	);
}
