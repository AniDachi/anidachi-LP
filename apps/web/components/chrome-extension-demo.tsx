"use client";

import { useEffect, useRef, useState } from "react";
import { ChromeExtensionDemoMobile } from "@/components/chrome-extension-demo-mobile";
import {
  ASYNC_STEP_LABELS,
  AsyncDemoOverlayKeyframes,
  AsyncDemoOverlayLayer,
  type DemoMode,
  useAsyncDemoOverlaySequence,
} from "@/components/chrome-extension-demo-async-overlay";
import { ChromeExtensionRoomDemo } from "@/components/chrome-extension-room-demo";
import { HomeSectionHeader } from "@/components/home-section-header";
import { trackEvent } from "@/lib/gtag";

const YT_VIDEO_ID = "M_OauHnAFc8";
const YT_EMBED_SRC = `https://www.youtube-nocookie.com/embed/${YT_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YT_VIDEO_ID}&controls=0&modestbranding=1&rel=0&iv_load_policy=3`;

const SECTION_COPY: Record<DemoMode, { headline: string; subcopy: string }> = {
  live: {
    headline: "See it in action",
    subcopy:
      "The overlay sits on any Crunchyroll or YouTube player. Create a room, share the link, you're in.",
  },
  async: {
    headline: "Async catch-up — coming soon",
    subcopy:
      "Preview of a later batch: comments and reactions pin to episode timestamps — not a live chat log. Live sync is available now.",
  },
};

function StepIndicator({
  labels,
  current,
}: {
  labels: readonly string[];
  current: number;
}) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {labels.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-2 w-2 rounded-full motion-safe:transition-colors motion-safe:duration-[200ms] ${
                  active ? "bg-ani-progress" : done ? "bg-ani-progress/60" : "bg-ani-control-border"
                }`}
              />
              <span
                className={`text-xs font-medium leading-none motion-safe:transition-colors motion-safe:duration-[200ms] ${
                  active ? "text-ani-text" : done ? "text-ani-muted" : "text-ani-muted/70"
                }`}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={`mb-3 h-px w-6 motion-safe:transition-colors motion-safe:duration-[200ms] ${
                  done ? "bg-ani-progress/60" : "bg-ani-line"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DemoModeToggle({
  mode,
  onChange,
}: {
  mode: DemoMode;
  onChange: (mode: DemoMode) => void;
}) {
  const options: { id: DemoMode; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "async", label: "Async · Coming soon" },
  ];

  return (
    <div
      className="mb-8 flex justify-center"
      role="tablist"
      aria-label="Demo mode"
    >
      <div className="inline-flex rounded-full border border-ani-control-border p-1">
        {options.map((option) => {
          const selected = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`min-h-11 rounded-full px-5 text-[13px] font-semibold motion-safe:transition-colors motion-safe:duration-[200ms] ${
                selected
                  ? "bg-ani-primary text-ani-on-primary"
                  : "text-ani-muted hover:text-ani-text"
              }`}
              onClick={() => {
                if (option.id !== mode) {
                  onChange(option.id);
                  trackEvent("demo_mode_selected", {
                    mode: option.id,
                    placement: "see_it_in_action",
                  });
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChromeExtensionDemoDesktopAsync({ visible }: { visible: boolean }) {
  const demo = useAsyncDemoOverlaySequence(visible);

  return (
    <>
      <AsyncDemoOverlayKeyframes />
      <StepIndicator labels={ASYNC_STEP_LABELS} current={demo.stepIndicatorIndex} />
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[20px] border border-ani-line bg-black">
        <div
          className={`relative aspect-video bg-black transition-[filter] duration-700 ${
            demo.dimVideo ? "brightness-[0.55]" : "brightness-100"
          }`}
        >
          <iframe
            key={`async-demo-yt-${demo.videoRestartToken}`}
            src={YT_EMBED_SRC}
            title="Anidachi async demo background video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="pointer-events-none absolute inset-0 h-full w-full border-0"
          />
          <AsyncDemoOverlayLayer demo={demo} platformLabel="Crunchyroll" />
        </div>
        <div className="border-t border-ani-line bg-ani-canvas px-5 py-4">
          <p className="min-h-[1.25rem] text-center text-sm text-ani-muted">
            {demo.caption}
          </p>
        </div>
      </div>
    </>
  );
}

function ChromeExtensionDemoDesktop() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) {
      setVisible(true);
      return;
    }
    const ob = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.15,
    });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="hidden md:block max-w-7xl mx-auto w-full">
      <ChromeExtensionDemoDesktopAsync visible={visible} />
    </div>
  );
}

export function ChromeExtensionDemo() {
  const [mode, setMode] = useState<DemoMode>("live");
  const copy = SECTION_COPY[mode];

  return (
    <section
      id="demo"
      className="overflow-hidden bg-ani-canvas pb-16 pt-2 text-ani-text md:pt-4 lg:pb-20"
    >
      <div className="container mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <HomeSectionHeader title={copy.headline} description={copy.subcopy} />

        <DemoModeToggle mode={mode} onChange={setMode} />

        {mode === "live" ? (
          <ChromeExtensionRoomDemo />
        ) : (
          <>
            <ChromeExtensionDemoMobile mode="async" />
            <ChromeExtensionDemoDesktop />
          </>
        )}
      </div>
    </section>
  );
}
