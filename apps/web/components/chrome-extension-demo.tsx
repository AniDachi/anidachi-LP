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
import {
  DemoOverlayKeyframes,
  DemoOverlayLayer,
  useDemoOverlaySequence,
} from "@/components/chrome-extension-demo-overlay";
import { HomeSectionHeader } from "@/components/home-section-header";
import { trackEvent } from "@/lib/gtag";

const YT_VIDEO_ID = "M_OauHnAFc8";
const YT_EMBED_SRC = `https://www.youtube-nocookie.com/embed/${YT_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YT_VIDEO_ID}&controls=0&modestbranding=1&rel=0&iv_load_policy=3`;

const LIVE_STEP_LABELS = [
  "Bubble",
  "Open panel",
  "Create room",
  "Friends join",
  "Reactions",
  "Sync",
];

const SECTION_COPY: Record<DemoMode, { headline: string; subcopy: string }> = {
  live: {
    headline: "See it in action",
    subcopy:
      "The overlay sits on any Crunchyroll or YouTube player. Create a room, share the link, you're in.",
  },
  async: {
    headline: "Catch up without losing the moment",
    subcopy:
      "Comments and reactions pin to episode timestamps — not a live chat log.",
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
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  active ? "bg-brand-orange scale-125" : done ? "bg-brand-orange-deep" : "bg-brand-border"
                }`}
              />
              <span
                className={`text-[9px] font-semibold tracking-wide uppercase transition-colors duration-500 leading-none ${
                  active ? "text-brand-orange" : done ? "text-brand-orange-deep" : "text-foreground/30"
                }`}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={`w-6 h-px mb-3 transition-colors duration-500 ${
                  done ? "bg-brand-orange-deep" : "bg-brand-border"
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
    { id: "async", label: "Async" },
  ];

  return (
    <div
      className="mb-8 flex justify-center"
      role="tablist"
      aria-label="Demo mode"
    >
      <div className="inline-flex rounded-full border border-brand-border bg-brand-surface p-1">
        {options.map((option) => {
          const selected = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                selected
                  ? "border border-brand-orange bg-brand-orange/10 text-brand-orange"
                  : "border border-transparent text-foreground/60 hover:text-foreground"
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

function ChromeExtensionDemoDesktopLive({ visible }: { visible: boolean }) {
  const demo = useDemoOverlaySequence(visible);

  return (
    <>
      <DemoOverlayKeyframes />
      <StepIndicator labels={LIVE_STEP_LABELS} current={demo.currentStep} />
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-brand-border/80 bg-black shadow-[0_24px_80px_-32px_oklch(0.71_0.20_45_/_0.35)]">
        <div className="relative aspect-video bg-black">
          <iframe
            src={YT_EMBED_SRC}
            title="Anidachi live demo background video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="pointer-events-none absolute inset-0 h-full w-full border-0"
          />
          <DemoOverlayLayer demo={demo} />
        </div>
        <div className="border-t border-brand-border bg-background/90 px-5 py-4">
          <p className="min-h-[1.25rem] text-center text-sm text-foreground/60">
            {demo.caption}
          </p>
        </div>
      </div>
    </>
  );
}

function ChromeExtensionDemoDesktopAsync({ visible }: { visible: boolean }) {
  const demo = useAsyncDemoOverlaySequence(visible);

  return (
    <>
      <AsyncDemoOverlayKeyframes />
      <StepIndicator labels={ASYNC_STEP_LABELS} current={demo.stepIndicatorIndex} />
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-brand-border/80 bg-black shadow-[0_24px_80px_-32px_oklch(0.71_0.20_45_/_0.35)]">
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
        <div className="border-t border-brand-border bg-background/90 px-5 py-4">
          <p className="min-h-[1.25rem] text-center text-sm text-foreground/60">
            {demo.caption}
          </p>
        </div>
      </div>
    </>
  );
}

function ChromeExtensionDemoDesktop({ mode }: { mode: DemoMode }) {
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
      {mode === "live" ? (
        <ChromeExtensionDemoDesktopLive key="live" visible={visible} />
      ) : (
        <ChromeExtensionDemoDesktopAsync key="async" visible={visible} />
      )}
    </div>
  );
}

export function ChromeExtensionDemo() {
  const [mode, setMode] = useState<DemoMode>("live");
  const copy = SECTION_COPY[mode];

  return (
    <section
      id="demo"
      className="overflow-hidden bg-background pb-16 pt-2 text-foreground md:pt-4 lg:pb-20"
    >
      <div className="container mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <HomeSectionHeader title={copy.headline} description={copy.subcopy} />

        <DemoModeToggle mode={mode} onChange={setMode} />

        <ChromeExtensionDemoMobile key={mode} mode={mode} />
        <ChromeExtensionDemoDesktop mode={mode} />
      </div>
    </section>
  );
}
