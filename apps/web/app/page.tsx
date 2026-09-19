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
        name="How to Watch Together with AniDachi"
        description="Install AniDachi, create a room and watch together on Crunchyroll or YouTube. Save personal watch progress with Plus or Pro."
        steps={howToSteps}
      />
    </>
  );
}
