import { howToSteps } from "@/components/how-it-works";
import { HomeClient } from "@/components/home/home-client";
import {
	SoftwareApplicationJsonLd,
	FAQPageJsonLd,
	HowToJsonLd,
} from "@/components/json-ld";
import { homeFAQ } from "@/lib/home-faq";

export const revalidate = 300;

export default function Home() {
	return (
		<>
			<HomeClient />
			<SoftwareApplicationJsonLd />
			<FAQPageJsonLd questions={homeFAQ} />
			<HowToJsonLd
				name="How to Watch Together with AniDachi"
				description="Install AniDachi, sign in, and create or join a room to watch YouTube or Crunchyroll together."
				steps={howToSteps}
			/>
		</>
	);
}
