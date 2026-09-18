import { Chrome, Search, Users, MessageSquare } from "lucide-react";
import Link from "next/link";
import { HomeSectionHeader } from "@/components/home-section-header";
import { INSTALL_HUB_PATH } from "@/lib/install-cta";

const steps = [
  {
    icon: Chrome,
    title: "Install the Chrome Extension",
    description:
      "Download the official zip from AniDachi (~2 minutes). Load unpacked in Chrome Developer mode — works with your Crunchyroll or YouTube session.",
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
      "Create a room and share the invite link. Each friend joins in desktop Chrome with the AniDachi extension installed.",
  },
  {
    icon: MessageSquare,
    title: "Watch together",
    description:
      "Watch in sync, chat, and send reactions while everyone is in the room together.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-ani-canvas py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <HomeSectionHeader
          title="How AniDachi works"
          description="From install to your first shared episode in under two minutes."
        />

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
                    className="h-4 w-4 text-ani-progress"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-ani-text">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[0.95rem] leading-relaxed text-ani-muted">
                  {i === 0 ? (
                    <>
                      Download the official zip from{" "}
                      <Link
                        href={INSTALL_HUB_PATH}
                        className="font-medium text-ani-progress underline-offset-4 hover:underline"
                      >
                        the install page
                      </Link>{" "}
                      (~2 minutes). Load unpacked in Chrome Developer mode —
                      works with your Crunchyroll or YouTube session.
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
          <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-4 sm:gap-x-5">
            <span className="col-start-2 mb-2 inline-flex justify-self-start rounded-full border border-ani-control-border px-2.5 py-1 text-xs font-medium text-ani-muted">
              Coming soon
            </span>
            <span
              aria-hidden="true"
              className="col-start-1 row-start-2 flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-ani-control-border text-sm font-semibold tabular-nums text-ani-muted"
            >
              5
            </span>
            <h3
              id="async-coming-soon"
              className="col-start-2 row-start-2 text-lg font-semibold tracking-[-0.02em] text-ani-text"
            >
              Async catch-up
            </h3>
            <p className="col-start-2 mt-1.5 text-[0.95rem] leading-relaxed text-ani-muted">
              Coming soon in a later batch: mark episodes at your pace, leave
              reactions, and chat so friends can catch up on their schedule.
              Live sync is available now.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export const howToSteps = [
  {
    name: steps[0].title,
    text: "Open /extension, download the official zip, unzip it, and Load unpacked in Chrome Developer mode (~2 minutes).",
  },
  ...steps.slice(1).map((s) => ({
    name: s.title,
    text: s.description,
  })),
];
