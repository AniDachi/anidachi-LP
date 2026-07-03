"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Mic2, Tv } from "lucide-react";
import { ChromeExtensionDemoMobile } from "@/components/chrome-extension-demo-mobile";
import {
  DemoOverlayKeyframes,
  DemoOverlayLayer,
  useDemoOverlaySequence,
} from "@/components/chrome-extension-demo-overlay";

const YT_VIDEO_ID = "M_OauHnAFc8";
const YT_EMBED_SRC = `https://www.youtube-nocookie.com/embed/${YT_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YT_VIDEO_ID}&controls=0&modestbranding=1&rel=0&iv_load_policy=3`;

const STEP_LABELS = [
  "Bubble",
  "Open panel",
  "Create room",
  "Friends join",
  "Reactions",
  "Sync",
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEP_LABELS.map((label, i) => {
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
            {i < STEP_LABELS.length - 1 && (
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

function DemoFeaturePills() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-foreground/50">
      <span className="inline-flex items-center gap-1.5">
        <Tv className="h-4 w-4 text-brand-orange/70" aria-hidden="true" />
        Any video
      </span>
      <span className="text-brand-border/80" aria-hidden="true">
        ·
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Link2 className="h-4 w-4 text-brand-orange/70" aria-hidden="true" />
        One invite link
      </span>
      <span className="text-brand-border/80" aria-hidden="true">
        ·
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Mic2 className="h-4 w-4 text-brand-orange/70" aria-hidden="true" />
        Push-to-talk reactions
      </span>
    </div>
  );
}

function ChromeExtensionDemoDesktop() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const demo = useDemoOverlaySequence(visible);

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
      <DemoOverlayKeyframes />
      <StepIndicator current={demo.currentStep} />

      <div className="w-[90%] max-w-full mx-auto rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
        <div className="relative aspect-video bg-black">
          <iframe
            src={YT_EMBED_SRC}
            title="Anidachi demo background video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="absolute inset-0 h-full w-full border-0 pointer-events-none"
          />
          <DemoOverlayLayer demo={demo} />
        </div>

        <div className="bg-background/80 px-5 py-4 border-t border-brand-border">
          <p className="text-sm text-foreground/60 text-center min-h-[1.25rem]">{demo.caption}</p>
        </div>
      </div>
    </div>
  );
}

export function ChromeExtensionDemo() {
  return (
    <section className="overflow-hidden bg-background py-16 text-foreground lg:py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[1600px]">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/15 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-brand-orange">
            Live Demo
          </div>
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">See It In Action</h2>
          <div className="mx-auto mb-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-bright" />
          <p className="mx-auto max-w-xl text-base text-foreground/70">
            The overlay sits on any Crunchyroll player. Create a room, share the
            link, you&apos;re in.
          </p>
        </div>

        <ChromeExtensionDemoMobile />
        <ChromeExtensionDemoDesktop />
        <DemoFeaturePills />
      </div>
    </section>
  );
}
