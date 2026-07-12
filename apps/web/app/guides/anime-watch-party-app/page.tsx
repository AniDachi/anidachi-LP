import { getGuideMetadata, PseoGuidePage } from "@/lib/pseo-new-guides";

export const metadata = getGuideMetadata("anime-watch-party-app");

export default function Page() {
	return <PseoGuidePage slug="anime-watch-party-app" />;
}
