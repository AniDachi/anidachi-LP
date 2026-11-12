import { Chrome, LogIn, Play, Users, MessageSquare, Clock3 } from "lucide-react";
import { HomeSectionHeader } from "@/components/home-section-header";
import { CHROME_WEB_STORE_URL, CHROME_WEB_STORE_URL_DE } from "@/lib/install-cta";
import type { PageLocale } from "@/lib/locale/ui-strings";
import { InstallLink } from "@/components/install-link";

const steps = [
  {
    icon: Chrome,
    title: "Install AniDachi",
    description: "Get the extension from the Chrome Web Store.",
  },
  {
    icon: LogIn,
    title: "Sign in",
    description: "Open the extension and sign in to your AniDachi account.",
  },
  {
    icon: Play,
    title: "Open a video",
    description: "Choose something to watch on YouTube, Crunchyroll, or Netflix.",
  },
  {
    icon: Users,
    title: "Create or join a room",
    description:
      "Create a room and share the link, or join a friend's room.",
  },
  {
    icon: MessageSquare,
    title: "Watch together",
    description: "Watch in sync, chat and share reactions.",
  },
];

/** German steps for /de, same order and icons as the English list. */
const stepsDe = [
  { icon: Chrome, title: "AniDachi installieren", description: "Hol dir die Erweiterung im Chrome Web Store." },
  { icon: LogIn, title: "Anmelden", description: "Öffne die Erweiterung und melde dich bei deinem AniDachi-Konto an." },
  { icon: Play, title: "Video öffnen", description: "Such dir etwas auf YouTube, Crunchyroll oder Netflix aus." },
  { icon: Users, title: "Raum erstellen oder beitreten", description: "Erstelle einen Raum und teile den Link, oder tritt dem Raum eines Freundes bei." },
  { icon: MessageSquare, title: "Zusammen schauen", description: "Schaut synchron, chattet und reagiert gemeinsam." },
];

const COPY = {
  en: { heading: "How AniDachi works", storeBefore: "Get the extension from the", asyncTitle: "Async catch-up", soon: "Coming soon", asyncBody: "Catch up with friends on your own schedule." },
  de: { heading: "So funktioniert AniDachi", storeBefore: "Hol dir die Erweiterung im", asyncTitle: "Zeitversetzt nachholen", soon: "Bald verfügbar", asyncBody: "Hol mit Freunden nach, wann es dir passt." },
} as const;

export function HowItWorks({ locale = "en" }: { locale?: PageLocale } = {}) {
  const copy = COPY[locale];
  const list = locale === "de" ? stepsDe : steps;
  return (
    <section id="how-it-works" className="bg-ani-canvas py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <HomeSectionHeader title={copy.heading} />

        <ol id="extension" className="mx-auto max-w-2xl space-y-0">
          {list.map((step, i) => (
            <li key={step.title} className="flex gap-4 sm:gap-5">
              <div className="flex shrink-0 flex-col items-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ani-control-border font-semibold tabular-nums text-sm text-ani-text">
                  {i + 1}
                </span>
                {i < list.length - 1 ? (
                  <span
                    className="my-1 w-px flex-1 bg-ani-line"
                    aria-hidden
                  />
                ) : null}
              </div>

              <div
                className={`min-w-0 flex-1 ${i === list.length - 1 ? "pb-0" : "pb-8"}`}
              >
                <div className="mb-1.5 flex items-center gap-2.5">
                  <step.icon
                    className="h-4 w-4 shrink-0 text-ani-progress"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-ani-text">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[0.95rem] leading-relaxed text-ani-muted">
                  {i === 0 ? (
                    <>
                      {copy.storeBefore}{" "}
                      <InstallLink
                        href={locale === "de" ? CHROME_WEB_STORE_URL_DE : CHROME_WEB_STORE_URL}
                        storePlacement="home_how_it_works"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ani-progress underline-offset-4 hover:underline"
                      >
                        Chrome Web Store
                      </InstallLink>.
                    </>
                  ) : (
                    step.description
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <aside
          aria-labelledby="async-coming-soon"
          className="mx-auto mt-8 max-w-2xl border-t border-ani-line pt-6"
        >
          <div className="pl-[3.25rem] sm:pl-14">
            <div className="flex flex-wrap items-center gap-2.5">
              <Clock3
                className="h-4 w-4 shrink-0 text-ani-progress"
                aria-hidden="true"
              />
              <h3
                id="async-coming-soon"
                className="min-w-0 text-lg font-semibold tracking-[-0.02em] text-ani-text"
              >
                {copy.asyncTitle}
              </h3>
              <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-ani-control-border px-2.5 py-1 text-xs font-medium text-ani-muted">
                {copy.soon}
              </span>
            </div>
            <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ani-muted">
              {copy.asyncBody}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export const howToSteps = steps.map((s) => ({
  name: s.title,
  text: s.description,
}));

export const howToStepsDe = stepsDe.map((s) => ({
  name: s.title,
  text: s.description,
}));
