import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomInviteView } from "../../room/[roomId]/room-invite-view";

export const metadata: Metadata = {
	title: "Local room invite preview",
	robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function RoomInvitePreviewPage() {
	if (process.env.NODE_ENV !== "development") notFound();
	return (
		<>
			<aside className="px-4 py-4 text-center text-xs text-ani-muted">
				Local preview · sample room · joining is disabled
			</aside>
			<RoomInviteView
				status="live"
				roomTitle="Frieren: Beyond Journey’s End"
				roomSubtitle="Episode 1"
				hostName="Alex"
				sourceProvider="crunchyroll"
				isParticipant={false}
				hasLaunchUrl
				initialMobile={false}
			/>
		</>
	);
}
