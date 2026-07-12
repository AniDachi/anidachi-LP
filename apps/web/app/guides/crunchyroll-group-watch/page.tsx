import { getGuideMetadata, PseoGuidePage } from "@/lib/pseo-new-guides";

export const metadata = getGuideMetadata("crunchyroll-group-watch");

export default function Page() {
	return <PseoGuidePage slug="crunchyroll-group-watch" />;
}
