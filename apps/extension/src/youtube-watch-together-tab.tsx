import { Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const INTRO_DURATION_MS = 2600;

export function YouTubeWatchTogetherTab({ returning, onJoin }: { returning: boolean; onJoin(): void }) {
  const tab = useRef<HTMLButtonElement>(null);
  const [introducing, setIntroducing] = useState(true);
  const label = returning ? "Back to video" : "Watch together";

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroducing(false), INTRO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    const button = tab.current;
    const pill = button?.parentElement?.querySelector<HTMLElement>(".top-bubble");
    if (!button || !pill) return;
    const measure = () => { if (pill.offsetWidth > 0) button.style.setProperty("--capsule-width", pill.offsetWidth + "px"); };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(pill);
    return () => observer?.disconnect();
  }, []);
  return <>
    <style>{`
      .yt-watch-together {
        position: absolute; top: var(--top-bubble-top,10px); right: var(--top-bubble-right,10px);
        height: 32px; padding: 0 calc(var(--capsule-width,78px) + 7px) 0 10px;
        display: inline-flex; align-items: center; white-space: nowrap;
        line-height: 1; font-family: inherit; font-size: 12px; font-weight: 600;
        border: 1px solid #ffffff24; border-radius: 999px; background: #222224; color: #eeedeb;
        --yt-entry-clip: inset(0 0 0 calc(100% - var(--capsule-width,78px)) round 999px);
        --yt-open-motion: 560ms cubic-bezier(.22, 1, .36, 1);
        --yt-copy-offset: 12px;
        pointer-events: auto; cursor: pointer; animation: yt-tab-in var(--yt-open-motion);
      }
      [data-catalog-floating][data-catalog-return-right] .yt-watch-together {
        --yt-entry-clip: inset(0 calc(100% - var(--capsule-width,78px)) 0 0 round 999px);
        --yt-copy-offset: -12px;
      }
      .yt-watch-label {
        display: grid; grid-template-columns: 0fr; overflow: hidden;
        transition: grid-template-columns 330ms cubic-bezier(.4, 0, .25, 1);
      }
      .yt-watch-label > span {
        min-width: 0; text-indent: 5px;
        opacity: 0; transform: translateX(var(--yt-copy-offset));
        transition: transform 340ms cubic-bezier(.22, 1, .36, 1), opacity 130ms ease;
      }
      .yt-watch-together:is([data-intro], :hover, :focus-visible) .yt-watch-label,
      .top-bubble-reveal:has(> .top-bubble:is(:hover, :focus-visible)) .yt-watch-label {
        grid-template-columns: 1fr; transition: grid-template-columns var(--yt-open-motion);
        @starting-style { grid-template-columns: 0fr; }
        & > span {
          opacity: 1; transform: translateX(0);
          transition-duration: 340ms; transition-delay: 105ms;
          @starting-style { opacity: 0; transform: translateX(var(--yt-copy-offset)); }
        }
      }
      .anidachi-overlay .top-bubble-reveal:has(> .yt-watch-together) > .top-bubble {
        opacity: 1; transform: none; pointer-events: auto; background: #101012;
      }
      .yt-watch-together:focus-visible { outline: 2px solid #ffa15a; }
      @keyframes yt-tab-in {
        from { clip-path: var(--yt-entry-clip); }
        to { clip-path: inset(0 round 999px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .yt-watch-together { animation: none; }
        .yt-watch-together .yt-watch-label, .yt-watch-together .yt-watch-label > span {
          transition: none !important;
        }
      }
    `}</style>
    <button type="button" ref={tab} className="catalog-return-to-video yt-watch-together"
      aria-label={label} data-intro={introducing || undefined} onClick={onJoin}>
      <Play size={12} fill="currentColor" aria-hidden="true" />
      <span className="yt-watch-label" aria-hidden="true"><span>{label}</span></span>
    </button>
  </>;
}
