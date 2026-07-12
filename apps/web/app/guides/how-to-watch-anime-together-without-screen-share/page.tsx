import { getGuideMetadata, PseoGuidePage } from "@/lib/pseo-new-guides";

export const metadata = getGuideMetadata(
	"how-to-watch-anime-together-without-screen-share",
);

export default function Page() {
	return (
		<PseoGuidePage slug="how-to-watch-anime-together-without-screen-share" />
	);
}
