import { howToSteps } from "@/components/how-it-works";
import { HomeClient } from "@/components/home/home-client";
import {
  SoftwareApplicationJsonLd,
  FAQPageJsonLd,
  HowToJsonLd,
} from "@/components/json-ld";
import { homeFAQ } from "@/lib/home-faq";
import { countSurveyLeads } from "@/lib/kreatli-crm/survey-lead-shared";
import { readContacts } from "@/lib/kreatli-crm/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  let waitlistCount: number | null = null;
  try {
    const contacts = await readContacts();
    waitlistCount = countSurveyLeads(contacts);
  } catch (e) {
    console.error("[home] Failed to load waitlist count:", e);
  }

  return (
    <>
      <HomeClient waitlistCount={waitlistCount} />
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
