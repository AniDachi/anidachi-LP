"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import Image from "next/image";
import {
  DemoOverlayKeyframes,
  DemoOverlayLayer,
  useDemoOverlaySequence,
} from "@/components/chrome-extension-demo-overlay";

const VIDEO_SRC = "/demo/anidachi-demo-mobile.mp4";
const POSTER_SRC = "/demo/anidachi-demo-mobile-poster.jpg";

const CAPTION_PHASES = [
  { label: "Bubble", maxStep: 1 },
  { label: "Room", maxStep: 3 },
  { label: "Together", maxStep: 5 },
] as const;

function captionPhaseIndex(currentStep: number): number {
  if (currentStep <= 1) return 0;
  if (currentStep <= 3) return 1;
  return 2;
}

export function ChromeExtensionDemoMobile() {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const demo = useDemoOverlaySequence(visible, true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const playVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setShowPlayButton(false);
    } catch {
      setShowPlayButton(true);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visible || videoFailed) return;

    if (reduceMotion) {
      video.pause();
      setShowPlayButton(true);
      return;
    }

    void playVideo();
  }, [visible, reduceMotion, videoFailed, playVideo]);

  const phaseIndex = captionPhaseIndex(demo.currentStep);

  return (
    <div ref={rootRef} className="md:hidden mx-auto w-full max-w-[360px] px-1">
      <DemoOverlayKeyframes />
      <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black">
        <div className="relative aspect-[9/16] bg-black">
          {videoFailed ? (
            <Image
              src={POSTER_SRC}
              alt="Anidachi overlay demo preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 90vw, 360px"
              priority
            />
          ) : (
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              src={VIDEO_SRC}
              poster={POSTER_SRC}
              muted
              playsInline
              loop
              preload={visible ? "auto" : "metadata"}
              aria-label="Anidachi watch party demo"
              onError={() => setVideoFailed(true)}
            />
          )}

          <DemoOverlayLayer demo={demo} compact platformLabel="Crunchyroll" />

          {showPlayButton && !videoFailed && (
            <button
              type="button"
              onClick={() => void playVideo()}
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/25"
              aria-label="Play demo video"
            >
              <span className="flex h-[14%] min-h-10 max-h-14 aspect-square items-center justify-center rounded-full bg-brand-orange text-primary-foreground shadow-lg">
                <Play className="h-[45%] w-[45%] min-h-5 min-w-5 fill-current" aria-hidden />
              </span>
            </button>
          )}
        </div>

        <div className="bg-background/80 px-5 py-4 border-t border-brand-border">
          <p className="text-sm text-foreground/60 text-center min-h-[2.5rem]">{demo.caption}</p>
          <div className="mt-3 flex items-center justify-center gap-2" aria-hidden>
            {CAPTION_PHASES.map((phase, i) => (
              <span
                key={phase.label}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === phaseIndex ? "w-5 bg-brand-orange" : "w-1.5 bg-brand-border"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
