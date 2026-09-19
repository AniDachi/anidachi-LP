"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getAsyncDemoScene, useAsyncDemo } from "../lib/use-async-demo";
import { AsyncScene } from "./chrome-extension-async-scene";
import frame from "./chrome-extension-room-demo.module.css";
import styles from "./chrome-extension-async-demo.module.css";

const COPY = [
  { title: "Watch on your time", text: "Emma starts Episode 4. No schedules to match." },
  { title: "Leave a message", text: "Type, react and send. Saved at 12:34." },
  { title: "Catch up later", text: "Alex watches two days later. Reactions stay hidden." },
  { title: "Share the same moment", text: "At 12:34, Emma’s reaction appears. No spoilers." },
];

function Caption({ scene, className }: { scene: number; className: string }) {
  return <div className={`${frame.copyStack} ${styles.caption} ${className}`}>
    {COPY.map((copy, index) => <div key={copy.title} className={frame.sceneCopy} data-active={scene === index + 1} aria-hidden={scene !== index + 1}>
      <h3 className={frame.chapterHeading}><span className={frame.chapterCount}><span className="sr-only">Step </span>{index + 1}</span><span>{copy.title}</span></h3>
      <p>{copy.text}</p>
    </div>)}
  </div>;
}

export function ChromeExtensionAsyncDemo({ controls }: { controls: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReducedMotion(media.matches);
    const visibility = () => setPageVisible(!document.hidden);
    motion(); visibility();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .35 });
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); media.removeEventListener("change", motion); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useLayoutEffect(() => {
    const demo = ref.current, section = demo?.closest("section");
    if (!demo || !section) return;
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Main navigation"]');
    const resize = () => {
      const chrome = demo.getBoundingClientRect().top - section.getBoundingClientRect().top + (nav?.getBoundingClientRect().height ?? 72) + 24;
      demo.style.setProperty("--demo-chrome", `${Math.ceil(chrome)}px`);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(section); if (nav) observer.observe(nav);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, []);
  const active = visible && pageVisible;
  const phase = useAsyncDemo(active, reducedMotion);
  const scene = getAsyncDemoScene(phase);
  const playing = active && reducedMotion === false;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing && scene !== 2 && phase !== "later") void video.play().catch(() => undefined);
    else video.pause();
    return () => video.pause();
  }, [playing, phase, scene]);

  return <div ref={ref} className={frame.demo} aria-label="Async catch-up preview — coming soon">
    <div className={frame.presentationHeader}>
      <h2 className={frame.presentationTitle}>See it in action</h2>{controls}
    </div>
    <div className={frame.stage} data-async-phase={phase} data-paused={!playing}>
      <div className={frame.backdrop} aria-hidden="true"><video ref={videoRef} src={visible && reducedMotion === false ? "/demo/anidachi-demo-background.mp4" : undefined} poster="/demo/anidachi-demo-background-poster.jpg" muted playsInline loop preload="none" tabIndex={-1} /></div>
      <div className={frame.shade} aria-hidden="true" />
      <Caption scene={scene} className={`${frame.narrative} ${styles.narrative}`} />
      <AsyncScene phase={phase} playing={playing} />
    </div>
    <span className={frame.comingSoon} aria-hidden="true">Coming soon</span>
    <Caption scene={scene} className={frame.mobileCaption} />
  </div>;
}
