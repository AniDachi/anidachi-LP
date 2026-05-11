import { howToSteps } from "@/components/how-it-works";
import { HomeClient } from "@/components/home/home-client";
import {
  SoftwareApplicationJsonLd,
  FAQPageJsonLd,
  HowToJsonLd,
} from "@/components/json-ld";
import { homeFAQ } from "@/lib/home-faq";

export default function Home() {
  return (
    <>
      <HomeClient />
      <SoftwareApplicationJsonLd />
      <FAQPageJsonLd questions={homeFAQ} />
      <HowToJsonLd
        name="How to Watch Anime Together with AniDachi"
        description="Set up shared anime watchrooms on Crunchyroll in 5 easy steps."
        steps={howToSteps}
      />
    </>
  );
}
