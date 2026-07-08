"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import Image from "next/image";
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

const VIDEO_SRC = "/demo/anidachi-demo-mobile.mp4";
const POSTER_SRC = "/demo/anidachi-demo-mobile-poster.jpg";

const LIVE_CAPTION_PHASES = [
  { label: "Bubble", maxStep: 1 },
  { label: "Room", maxStep: 3 },
  { label: "Together", maxStep: 5 },
] as const;

function liveCaptionPhaseIndex(currentStep: number): number {
  if (currentStep <= 1) return 0;
  if (currentStep <= 3) return 1;
  return 2;
}

function asyncCaptionPhaseIndex(currentBeat: number): number {
  return Math.min(Math.max(currentBeat, 0), ASYNC_STEP_LABELS.length - 1);
}

function ChromeExtensionDemoMobileLive({ visible }: { visible: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const phaseIndex = liveCaptionPhaseIndex(demo.currentStep);

  return (
    <>
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
            {LIVE_CAPTION_PHASES.map((phase, i) => (
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
    </>
  );
}

function ChromeExtensionDemoMobileAsync({ visible }: { visible: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const demo = useAsyncDemoOverlaySequence(visible, true, reduceMotion);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visible || videoFailed || reduceMotion) return;
    video.currentTime = 0;
    void playVideo();
  }, [demo.videoRestartToken, visible, videoFailed, reduceMotion, playVideo]);

  const phaseIndex = asyncCaptionPhaseIndex(demo.currentBeat);

  return (
    <>
      <AsyncDemoOverlayKeyframes />
      <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black">
        <div
          className={`relative aspect-[9/16] bg-black transition-[filter] duration-700 ${
            demo.dimVideo ? "brightness-[0.55]" : "brightness-100"
          }`}
        >
          {videoFailed ? (
            <Image
              src={POSTER_SRC}
              alt="Anidachi async demo preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 90vw, 360px"
              priority
            />
          ) : (
            <video
              key={`async-demo-mobile-${demo.videoRestartToken}`}
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              src={VIDEO_SRC}
              poster={POSTER_SRC}
              muted
              playsInline
              loop
              preload={visible ? "auto" : "metadata"}
              aria-label="Anidachi async watch demo"
              onError={() => setVideoFailed(true)}
            />
          )}

          <AsyncDemoOverlayLayer demo={demo} compact platformLabel="Crunchyroll" />

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
            {ASYNC_STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === phaseIndex ? "w-5 bg-brand-orange" : "w-1.5 bg-brand-border"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function ChromeExtensionDemoMobile({ mode }: { mode: DemoMode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="md:hidden mx-auto w-full max-w-[360px] px-1">
      {mode === "live" ? (
        <ChromeExtensionDemoMobileLive key="live" visible={visible} />
      ) : (
        <ChromeExtensionDemoMobileAsync key="async" visible={visible} />
      )}
    </div>
  );
}
