import {
  Chrome,
  Search,
  Users,
  MessageSquare,
  MousePointer,
  FolderSyncIcon as Sync,
} from "lucide-react";

const steps = [
  {
    icon: Chrome,
    title: "Install the Chrome Extension",
    description:
      "Add AniDachi to Chrome in seconds — works with your existing Crunchyroll account.",
  },
  {
    icon: Search,
    title: "Detect Anime Automatically",
    description:
      "Open any title on Crunchyroll and AniDachi identifies the show, season, and episode.",
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

const extensionHighlights = [
  {
    icon: Chrome,
    title: "Auto detection",
    description: "Finds anime on Crunchyroll — no URL pasting.",
  },
  {
    icon: MousePointer,
    title: "One-click rooms",
    description: "Create a watchroom and share the invite instantly.",
  },
  {
    icon: Sync,
    title: "Stay in sync",
    description: "Playback stays aligned when you watch live together.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-brand-surface py-16 lg:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/15 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-brand-orange">
            Setup
          </div>
          <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
            How AniDachi Works
          </h2>
          <div className="mx-auto mb-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-bright" />
          <p className="mx-auto max-w-xl text-base text-foreground/70">
            From install to your first shared episode in under two minutes.
          </p>
        </div>

        <ol className="mx-auto max-w-3xl space-y-4">
          {steps.map((step, i) => (
            <li
              key={i}
              className="group flex animate-fade-in-up gap-4 sm:gap-5"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex shrink-0 flex-col items-center pt-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-background text-sm font-bold text-foreground/80 transition-all duration-300 group-hover:border-brand-orange group-hover:bg-brand-orange group-hover:text-primary-foreground">
                  {i + 1}
                </span>
                {i < steps.length - 1 ? (
                  <span
                    className="mt-2 min-h-4 w-px flex-1 bg-brand-border transition-colors duration-300 group-hover:bg-brand-orange/40"
                    aria-hidden
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 rounded-lg border border-brand-border bg-background p-5 transition-all duration-300 hover:shadow-lg group-hover:-translate-y-0.5 group-hover:border-brand-orange/50">
                <div className="mb-1 flex items-center gap-3">
                  <step.icon
                    className="h-5 w-5 text-foreground/50 transition-colors duration-300 group-hover:text-brand-orange"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-semibold text-foreground transition-colors duration-300 group-hover:text-brand-orange">
                    {step.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-foreground/70">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div id="extension" className="mx-auto mt-10 max-w-4xl">
          <div className="grid gap-4 sm:grid-cols-3">
            {extensionHighlights.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-brand-border bg-background p-4 text-center"
              >
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-orange/15">
                  <item.icon
                    className="h-5 w-5 text-brand-orange"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-foreground/60">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export const howToSteps = steps.map((s) => ({
  name: s.title,
  text: s.description,
}));
