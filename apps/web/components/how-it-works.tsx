import { Chrome, Search, Users, MessageSquare } from "lucide-react";
import { HomeSectionHeader } from "@/components/home-section-header";

const steps = [
  {
    icon: Chrome,
    title: "Install the Chrome Extension",
    description:
      "Add AniDachi to Chrome in seconds — works with your Crunchyroll or YouTube session.",
  },
  {
    icon: Search,
    title: "Detect What You’re Watching",
    description:
      "Open a Crunchyroll anime or a YouTube video and AniDachi identifies the title and episode (or video) for the room.",
  },
  {
    icon: Users,
    title: "Create a Watchroom",
    description:
      "One click creates a shared room. Share the invite link — friends join from any device.",
  },
  {
    icon: MessageSquare,
    title: "Track Progress & Chat Async",
    description:
      "Mark episodes at your pace, leave reactions, and chat — friends catch up on their schedule.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-brand-surface py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <HomeSectionHeader
          title="How AniDachi works"
          description="From install to your first shared episode in under two minutes."
        />

        <ol id="extension" className="mx-auto max-w-2xl space-y-0">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4 sm:gap-5">
              <div className="flex shrink-0 flex-col items-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-orange/15 font-mono text-sm font-semibold tabular-nums text-brand-orange-bright">
                  {i + 1}
                </span>
                {i < steps.length - 1 ? (
                  <span
                    className="my-1 w-px flex-1 bg-brand-border"
                    aria-hidden
                  />
                ) : null}
              </div>

              <div
                className={`min-w-0 flex-1 ${i === steps.length - 1 ? "pb-0" : "pb-8"}`}
              >
                <div className="mb-1.5 flex items-center gap-2.5">
                  <step.icon
                    className="h-4 w-4 text-brand-orange/80"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[0.95rem] leading-relaxed text-foreground/70">
                  {step.description}
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
