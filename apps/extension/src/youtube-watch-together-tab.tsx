import { Play } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

export function YouTubeWatchTogetherTab({ returning, onJoin }: { returning: boolean; onJoin(): void }) {
  const tab = useRef<HTMLButtonElement>(null);
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
        display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
        line-height: 1; font-family: inherit; font-size: 12px; font-weight: 600;
        border: 1px solid #ffffff24; border-radius: 999px; background: #222224; color: #eeedeb;
        pointer-events: auto; cursor: pointer; animation: yt-tab-in .24s ease-out both;
      }
      .anidachi-overlay .top-bubble-reveal:has(> .yt-watch-together) > .top-bubble {
        opacity: 1; transform: none; pointer-events: auto; background: #101012;
      }
      .yt-watch-together:focus-visible { outline: 2px solid #ffa15a; }
      @keyframes yt-tab-in { from { opacity: 0; clip-path: inset(0 0 0 65% round 30px); } to { opacity: 1; clip-path: inset(0 round 30px); } }
      @media (prefers-reduced-motion: reduce) { .yt-watch-together { animation: none; } }
    `}</style>
    <button type="button" ref={tab} className="catalog-return-to-video yt-watch-together" onClick={onJoin}>
      <Play size={12} fill="currentColor" aria-hidden="true" />{returning ? "Back to video" : "Watch together"}
    </button>
  </>;
}
