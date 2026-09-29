import { Chrome, LogIn, Play, Users, MessageSquare } from "lucide-react";
import { HomeSectionHeader } from "@/components/home-section-header";
import { CHROME_WEB_STORE_URL } from "@/lib/install-cta";

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
    description: "Choose something to watch on YouTube or Crunchyroll.",
  },
  {
    icon: Users,
    title: "Create or join a room",
    description:
      "Host with Plus or Pro and share the link. Friends join free.",
  },
  {
    icon: MessageSquare,
    title: "Watch together",
    description: "Watch in sync, chat and share reactions.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-ani-canvas py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <HomeSectionHeader title="How AniDachi works" />

        <ol id="extension" className="mx-auto max-w-2xl space-y-0">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4 sm:gap-5">
              <div className="flex shrink-0 flex-col items-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ani-control-border font-semibold tabular-nums text-sm text-ani-text">
                  {i + 1}
                </span>
                {i < steps.length - 1 ? (
                  <span
                    className="my-1 w-px flex-1 bg-ani-line"
                    aria-hidden
                  />
                ) : null}
              </div>

              <div
                className={`min-w-0 flex-1 ${i === steps.length - 1 ? "pb-0" : "pb-8"}`}
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
                      Get the extension from the{" "}
                      <a
                        href={CHROME_WEB_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ani-progress underline-offset-4 hover:underline"
                      >
                        Chrome Web Store
                      </a>.
                    </>
                  ) : (
                    step.description
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>

      </div>
    </section>
  );
}

export const howToSteps = steps.map((s) => ({
  name: s.title,
  text: s.description,
}));
