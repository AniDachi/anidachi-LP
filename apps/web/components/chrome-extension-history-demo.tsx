"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, EllipsisVertical, Funnel, MousePointer2, Pause, Play, Puzzle, RotateCw, Search, Settings, SlidersHorizontal } from "lucide-react";
// Styles and a stateless progress view only. Do not import the extension's
// drawer/controller: it owns authentication, storage and real resume actions.
import { popupWatchHistoryStyles } from "../../extension/src/popup-watch-history-styles";
import { extensionThemeTokens } from "../../extension/src/extension-theme";
import { PopupEpisodeProgress } from "../../extension/src/popup-episode-progress";
import { getHistoryDemoScene, useHistoryDemo, type HistoryDemoPhase } from "../lib/use-history-demo";
import frame from "./chrome-extension-room-demo.module.css";
import styles from "./chrome-extension-history-demo.module.css";

const POSTER = "/demo/anidachi-demo-background-poster.jpg";
const COPY = [
  { title: "Your place, saved", text: "Automatic tracking with Plus / Pro." },
  { title: "Open in Chrome", text: "Click AniDachi in Chrome’s extension toolbar." },
  { title: "Continue watching", text: "One click. Back to 12:34." },
];

// Fictional title and progress. Artwork reuses the licensed demo backdrop.
const DRAWER_STYLE = `
  :host { ${extensionThemeTokens} display:block; color:var(--ad-text); font-family:Inter,ui-sans-serif,system-ui,sans-serif; }
  * { box-sizing:border-box; }
  button { font:inherit; }
  .history-shell { --episode-cell-height:38px; --episode-grid-gap:6px; position:relative; height:640px; padding:16px; background:linear-gradient(180deg,#121113,#09090b); border:1px solid #ffffff24; border-radius:16px; overflow:hidden; }
  .history-profile { display:flex; align-items:center; gap:10px; height:40px; }
  .history-avatar { display:grid; place-items:center; width:36px; height:36px; border:1px solid #e5b79666; border-radius:50%; background:#5b4334; color:#eee6dc; font-size:13px; }
  .history-profile strong { font-size:14px; font-weight:600; }
  .history-plan { margin-left:6px; font-size:10px; font-weight:700; color:#e5b796; }
  .history-profile > svg { margin-left:auto; color:var(--ad-muted); }
  .history-tabs { display:flex; justify-content:space-around; margin:14px 0 10px; color:var(--ad-muted); font-size:13px; font-weight:600; }
  .history-tabs > span { position:relative; padding:8px 14px 12px; }
  .history-tabs > span:first-child { color:#eee6dc; }
  .history-tabs > span:first-child::after { content:""; position:absolute; bottom:0; left:28%; right:28%; height:2px; background:var(--ad-accent); border-radius:2px; }
  .history-search { display:flex; align-items:center; gap:12px; margin-bottom:12px; color:var(--ad-muted); }
  .history-search > div { display:flex; align-items:center; gap:8px; flex:1; height:34px; padding:0 12px; border:1px solid #ffffff26; border-radius:999px; font-size:11px; }
  .history-provider { display:flex; align-items:center; gap:10px; height:42px; margin-bottom:6px; font-size:17px; font-weight:600; }
  .history-provider > svg:first-child { width:26px; height:26px; color:var(--ad-accent); }
  .history-provider sup { align-self:flex-start; padding-top:9px; font-size:10px; color:var(--ad-accent); }
  .history-provider > svg:last-child { margin-left:auto; color:var(--ad-muted); }
  .popup-watch-main { display:grid; gap:8px; }
  .popup-watch-screen .popup-watch-item { --popup-watch-artwork-width:52px; border:1px solid #eee6dc1a; border-radius:14px; overflow:hidden; }
  .popup-watch-artwork img { display:block; width:100%; height:100%; object-fit:cover; object-position:62% center; }
  .history-detail { display:grid; grid-template-rows:0fr; opacity:0; transition:grid-template-rows 380ms ease,opacity 240ms ease; }
  .history-detail[data-open=true] { grid-template-rows:1fr; opacity:1; }
  .history-detail > div { min-height:0; overflow:hidden; }
  .popup-watch-screen .popup-watch-grid-view { margin-top:10px; }
  .popup-episode-grid { grid-template-columns:repeat(6,minmax(0,1fr)); }
  .popup-season-trigger { min-height:32px; }
  .popup-selected-resume { min-height:34px; }
  .popup-progress-track > span { display:block; height:100%; border-radius:inherit; background:var(--ad-accent); }
  .popup-watch-screen .popup-selected-episode-title { min-height:18px; }
  .history-footer { position:absolute; bottom:16px; left:16px; right:16px; border-top:1px solid #ffffff12; padding-top:12px; text-align:center; color:var(--ad-muted); font-size:10px; }
  [data-phase=resume] .popup-selected-resume { background:#fff8ee; box-shadow:0 0 0 3px #eee6dc20; }
  @media(prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; animation:none!important; } }
`;

function HistoryDrawer({ phase }: { phase: HistoryDemoPhase }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (host) setShadow(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
  }, []);
  const open = phase === "episodes" || phase === "resume";
  return <div className={styles.drawer} ref={hostRef} data-history-drawer aria-hidden="true" inert>
    {shadow && createPortal(<>
      <style>{popupWatchHistoryStyles + DRAWER_STYLE}</style>
      <div className="history-shell" data-phase={phase}>
        <div className="history-profile"><span className="history-avatar">A</span><strong>Alex <span className="history-plan">PLUS</span></strong><Settings size={19} /></div>
        <div className="history-tabs"><span>Watch</span><span>People</span><span>Inbox</span></div>
        <div className="history-search"><div><Search size={14} />Search</div><Funnel size={18} /></div>
        <div className="history-provider">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.909 13.436C2.914 7.61 7.642 2.893 13.468 2.898c5.576.005 10.137 4.339 10.51 9.819q.021-.351.022-.706C24.007 5.385 18.64.006 12.012 0S.007 5.36 0 11.988 5.36 23.994 11.988 24q.412 0 .815-.027c-5.526-.338-9.9-4.928-9.894-10.538Zm16.284.155a4.1 4.1 0 0 1-4.095-4.103 4.1 4.1 0 0 1 2.712-3.855 8.95 8.95 0 0 0-4.187-1.037 9.007 9.007 0 1 0 8.997 9.016q-.001-.847-.15-1.651a4.1 4.1 0 0 1-3.278 1.63Z" /></svg>
          <span>Crunchyroll</span><sup>1</sup><ChevronDown size={16} />
        </div>
        <section className="popup-watch-screen">
          <article className="popup-watch-item" data-open={open}>
            <div className="popup-watch-row">
              <button type="button" className="popup-watch-title-toggle" aria-expanded={open} tabIndex={-1}>
                <span className="popup-watch-artwork"><img src={POSTER} alt="" /></span>
                <span className="popup-watch-main"><strong className="popup-watch-title">A Quiet Evening</strong><span className="popup-watch-meta">3 / 12 episodes</span></span>
                <ChevronDown className="popup-watch-disclosure-icon" size={16} />
              </button>
            </div>
            <div className="history-detail" data-open={open}><div>
              <div className="popup-watch-grid-view">
                <div className="popup-season-toolbar"><span className="popup-season-trigger">Season 1 <ChevronDown size={13} /></span><span className="popup-season-counter">3 / 12 watched</span></div>
                <div className="popup-episode-grid">
                  {Array.from({ length: 12 }, (_, i) => <button key={i} type="button" className="popup-episode-cell" data-completed={i < 3} data-current={i === 3} aria-pressed={i === 3} tabIndex={-1}>
                    <span className="popup-cell-number">{String(i + 1).padStart(2, "0")}</span>
                    {i < 3 && <Check size={10} />}
                    {i === 3 && <span className="popup-cell-progress" style={{ width: "51.3%" }} />}
                  </button>)}
                </div>
                <div className="popup-selected-episode">
                  <div className="popup-selected-episode-heading"><span>Episode 04</span><span>In progress</span></div>
                  <div className="popup-selected-episode-title">Start Line</div>
                  <PopupEpisodeProgress title="Start Line" elapsed="12:34" duration="24:30" progress={754 / 1470} action="Resume" disabled={false} onOpen={() => {}} />
                </div>
              </div>
            </div></div>
          </article>
        </section>
        <div className="history-footer">Manage history</div>
      </div>
    </>, shadow)}
  </div>;
}

function Caption({ scene, className }: { scene: number; className: string }) {
  return <div className={`${frame.copyStack} ${className}`}>
    {COPY.map((copy, i) => <div key={copy.title} className={frame.sceneCopy} data-active={scene === i + 1} aria-hidden={scene !== i + 1}>
      <h3 className={frame.chapterHeading}><span className={frame.chapterCount}><span className="sr-only">Step </span>{i + 1}</span><span>{copy.title}</span></h3>
      <p>{copy.text}</p>
    </div>)}
  </div>;
}

export function ChromeExtensionHistoryDemo({ controls }: { controls: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const checkpoint = useRef(0);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updatePage = () => setPageVisible(!document.hidden);
    updateMotion(); updatePage();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updatePage);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .35 });
    if (ref.current) observer.observe(ref.current);
    return () => { media.removeEventListener("change", updateMotion); document.removeEventListener("visibilitychange", updatePage); observer.disconnect(); };
  }, []);
  useLayoutEffect(() => {
    const demo = ref.current, stage = stageRef.current, section = demo?.closest("section");
    if (!demo || !stage || !section) return;
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Main navigation"]');
    const resize = () => {
      const chrome = demo.getBoundingClientRect().top - section.getBoundingClientRect().top + (nav?.getBoundingClientRect().height ?? 72) + 24;
      demo.style.setProperty("--demo-chrome", `${Math.ceil(chrome)}px`);
      const availableWidth = window.innerWidth < 640 ? stage.clientWidth - 24 : Math.max(300, stage.clientWidth * .46);
      // Leave room for the browser toolbar and the gap below its popup.
      const scale = Math.max(.1, Math.min(1, availableWidth / 382, (stage.clientHeight - 70) / 640));
      stage.style.setProperty("--history-scale", String(scale));
      stage.style.setProperty("--history-width", `${382 * scale}px`);
      stage.style.setProperty("--history-height", `${640 * scale}px`);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(section); observer.observe(stage); if (nav) observer.observe(nav);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, []);
  const active = visible && pageVisible;
  const phase = useHistoryDemo(active, reducedMotion);
  const scene = getHistoryDemoScene(phase);
  const drawerOpen = ["library", "episodes", "resume"].includes(phase);
  useLayoutEffect(() => {
    const stage = stageRef.current, cursor = cursorRef.current;
    if (!stage || !cursor) return;
    const drawer = stage.querySelector<HTMLElement>("[data-history-drawer]");
    const target = phase === "watching" || phase === "saved"
      ? stage.querySelector<HTMLElement>("[data-history-extension]")
      : drawer?.shadowRoot?.querySelector<HTMLElement>(phase === "library" ? ".popup-watch-title-toggle" : ".popup-selected-resume");
    if (!target) return;
    // One cursor stays in stage coordinates, including the scaled popup.
    // Wait for the popup/card to finish opening before descending to its button.
    const delay = phase === "library" ? 360 : phase === "episodes" ? 420 : 0;
    let ready = delay === 0;
    const position = () => {
      if (!ready) return;
      const bounds = stage.getBoundingClientRect(), button = target.getBoundingClientRect();
      const offset = phase === "watching" ? { x: -74, y: 64 } : { x: 0, y: 0 };
      cursor.style.setProperty("--cursor-x", `${button.right - bounds.left - Math.min(18, button.width / 2) + offset.x}px`);
      cursor.style.setProperty("--cursor-y", `${button.top - bounds.top + button.height / 2 + offset.y}px`);
    };
    const timer = delay ? window.setTimeout(() => { ready = true; position(); }, delay) : undefined;
    position();
    const observer = new ResizeObserver(position);
    observer.observe(stage); observer.observe(target);
    if (drawer?.parentElement) observer.observe(drawer.parentElement);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [phase]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (phase === "saved") checkpoint.current = video.currentTime;
    if (active && reducedMotion === false && (phase === "watching" || phase === "playing")) {
      if (phase === "playing" && checkpoint.current > 0) video.currentTime = checkpoint.current;
      void video.play().catch(() => undefined);
    } else video.pause();
    return () => video.pause();
  }, [phase, active, reducedMotion]);

  return <div ref={ref} className={frame.demo} aria-label="Watch history walkthrough">
    <div className={frame.presentationHeader}>
      <h2 className={frame.presentationTitle}>See it in action</h2>
      {controls}
    </div>
    <div ref={stageRef} className={`${frame.stage} ${styles.stage}`} data-history-phase={phase}>
      <div className={`${frame.backdrop} ${styles.videoSurface}`} aria-hidden="true"><video ref={videoRef} src={visible && reducedMotion === false ? "/demo/anidachi-demo-background.mp4" : undefined} poster={POSTER} muted playsInline loop preload="none" tabIndex={-1} /></div>
      <div className={frame.shade} />
      <Caption scene={scene} className={`${frame.narrative} ${styles.narrative}`} />
      <div className={styles.browserToolbar} aria-hidden="true" inert>
        <div className={styles.browserNavigation}><ArrowLeft size={15} /><ArrowRight size={15} /><RotateCw size={14} /></div>
        <div className={styles.addressBar}><SlidersHorizontal size={12} /><span>crunchyroll.com</span></div>
        <div className={styles.extensionIcon} data-history-extension data-open={drawerOpen}>
          <img src="/Anidachi_logo.webp" alt="" />
          <span className={styles.extensionTooltip}>AniDachi</span>
        </div>
        <Puzzle size={17} /><EllipsisVertical size={16} />
      </div>
      <div className={styles.player} data-visible={!drawerOpen} aria-hidden="true">
        <span className={styles.playerEpisode}>E04 · Start Line</span>
        <div className={styles.playerTime}>{phase === "saved" ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}<strong>{phase === "watching" ? "12:31" : phase === "playing" ? "12:35" : "12:34"}</strong><span>/ 24:30</span></div>
        <div className={styles.playerTrack}><span style={{ width: phase === "watching" ? "51%" : "51.3%" }} /></div>
        <span className={styles.saved} data-visible={phase === "saved" || phase === "playing"}><Check size={13} />{phase === "playing" ? "Resumed from 12:34" : "Progress saved"}</span>
      </div>
      <div className={styles.drawerPosition} data-open={drawerOpen}><HistoryDrawer phase={phase} /></div>
      <MousePointer2 ref={cursorRef} className={styles.cursor} size={21} fill="white" stroke="#302922" strokeWidth={1.3} aria-hidden="true" />
    </div>
    <span className={frame.comingSoon} aria-hidden="true">Coming soon</span>
    <Caption scene={scene} className={frame.mobileCaption} />
  </div>;
}
