"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AudioLines, MousePointer2, VolumeX } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { useInView } from "@/lib/use-in-view";
import { cn } from "@/lib/utils";

type MainMode = "auto-hide" | "always-visible";
type PillMode = "smart" | "always-visible";

type PreviewMoment =
  | "idle"
  | "proximity"
  | "main-visible"
  | "speaking"
  | "interaction";

type CursorTarget = "rest" | "main-edge" | "rail-edge" | "participant-pill";

type PillPresentation = "hidden" | "compact" | "peek" | "expanded";

type PreviewFrame = {
  cursorTarget: CursorTarget;
  cursorVisible: boolean;
  durationMs: number;
  moment: PreviewMoment;
};

const PREVIEW_PAUSE_MS = 480;
const PREVIEW_CURSOR_TRAVEL_MS = 820;
const PREVIEW_CUE_MS = 320;
const PREVIEW_REVEAL_MS = 420;
const PREVIEW_HOLD_MS = 980;
const PREVIEW_CURSOR_FADE_MS = 200;
const PREVIEW_RESET_MS = 460;

const NAMES = ["Mika", "Ren", "Niko"] as const;
const INITIALS = ["MI", "RE", "NI"] as const;

function Hit({
  children,
  className,
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border-2 border-[#eee5d9]",
        padded && "bg-[#0b0b0d] p-0.5",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SegmentedChoice({
  options,
  value,
  onChange,
}: {
  options: readonly { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex rounded-full border border-white/12 p-0.5">
      {options.map((opt) => {
        const on = opt.value === value;
        const inner = (
          <button
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex h-8 w-full items-center justify-center rounded-full px-1 text-[11px] font-semibold transition-colors",
              on
                ? "bg-gradient-to-br from-[#ffb15f] to-[#f97316] font-bold text-[#1c1109]"
                : "text-white/45 hover:text-white/70",
            )}
          >
            {opt.label}
          </button>
        );
        return on ? (
          <Hit key={opt.value} className="min-w-0 flex-1" padded>
            {inner}
          </Hit>
        ) : (
          <span key={opt.value} className="min-w-0 flex-1">
            {inner}
          </span>
        );
      })}
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function resolvePreviewFrames(
  main: MainMode,
  pills: PillMode,
): readonly PreviewFrame[] {
  const frames: PreviewFrame[] = [
    {
      cursorTarget: "rest",
      cursorVisible: false,
      durationMs: PREVIEW_PAUSE_MS,
      moment: "idle",
    },
  ];

  if (main === "auto-hide") {
    frames.push(
      {
        cursorTarget: "main-edge",
        cursorVisible: true,
        durationMs: PREVIEW_CURSOR_TRAVEL_MS,
        moment: "idle",
      },
      {
        cursorTarget: "main-edge",
        cursorVisible: true,
        durationMs: PREVIEW_CUE_MS,
        moment: "proximity",
      },
      {
        cursorTarget: "main-edge",
        cursorVisible: true,
        durationMs: PREVIEW_REVEAL_MS + PREVIEW_HOLD_MS,
        moment: "main-visible",
      },
      {
        cursorTarget: "main-edge",
        cursorVisible: false,
        durationMs: PREVIEW_CURSOR_FADE_MS,
        moment: "main-visible",
      },
      {
        cursorTarget: "rest",
        cursorVisible: false,
        durationMs: PREVIEW_RESET_MS,
        moment: "idle",
      },
    );
  }

  frames.push(
    {
      cursorTarget: "rest",
      cursorVisible: false,
      durationMs: PREVIEW_HOLD_MS,
      moment: "speaking",
    },
    {
      cursorTarget: "rest",
      cursorVisible: false,
      durationMs: PREVIEW_RESET_MS,
      moment: "idle",
    },
  );

  const participantTarget =
    pills === "smart" ? "rail-edge" : "participant-pill";
  frames.push(
    {
      cursorTarget: participantTarget,
      cursorVisible: true,
      durationMs: PREVIEW_CURSOR_TRAVEL_MS,
      moment: "idle",
    },
    {
      cursorTarget: participantTarget,
      cursorVisible: true,
      durationMs: PREVIEW_HOLD_MS,
      moment: "interaction",
    },
    {
      cursorTarget: participantTarget,
      cursorVisible: false,
      durationMs: PREVIEW_CURSOR_FADE_MS,
      moment: "interaction",
    },
    {
      cursorTarget: "rest",
      cursorVisible: false,
      durationMs: PREVIEW_RESET_MS,
      moment: "idle",
    },
  );

  return frames;
}

function pillPresentation({
  index,
  moment,
  pills,
  railExpanded,
}: {
  index: number;
  moment: PreviewMoment;
  pills: PillMode;
  railExpanded: boolean;
}): PillPresentation {
  if (index === 0 && moment === "interaction") return "expanded";
  if (railExpanded) return "peek";
  if (pills === "always-visible") return "compact";
  if (index === 0 && moment === "speaking") return "compact";
  return "hidden";
}

function InterfacePreviewStage({
  main,
  pills,
}: {
  main: MainMode;
  pills: PillMode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [rootRef, inView] = useInView<HTMLDivElement>();
  const frames = useMemo(
    () => resolvePreviewFrames(main, pills),
    [main, pills],
  );
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
  }, [main, pills]);

  useEffect(() => {
    if (reducedMotion || !inView) return;
    const frame = frames[frameIndex] ?? frames[0];
    if (!frame) return;
    const timeout = window.setTimeout(() => {
      setFrameIndex((i) => (i + 1) % frames.length);
    }, frame.durationMs);
    return () => window.clearTimeout(timeout);
  }, [frameIndex, frames, inView, reducedMotion]);

  const frame = reducedMotion
    ? ({
        cursorTarget: "rest" as const,
        cursorVisible: false,
        durationMs: 0,
        moment: "interaction" as const,
      })
    : (frames[frameIndex] ?? frames[0]);

  const moment = frame?.moment ?? "idle";
  const mainPinned = main === "always-visible";
  const mainVisible =
    mainPinned || moment === "main-visible" || reducedMotion;
  const mainGlow = !mainPinned && moment === "proximity";
  const railExpanded = pills === "smart" && moment === "interaction";

  return (
    <div
      ref={rootRef}
      className="relative isolate aspect-video min-h-[154px] w-full overflow-hidden rounded-lg border border-white/12 bg-[#08090c]"
      data-cursor-target={frame?.cursorTarget ?? "rest"}
      data-cursor-visible={String(frame?.cursorVisible ?? false)}
      aria-hidden="true"
    >
      <style>{`
        .ani-iface-preview-cursor {
          position: absolute;
          z-index: 6;
          top: 68%;
          left: 42%;
          color: rgba(255,255,255,0.9);
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.78)) drop-shadow(0 0 6px rgba(255,255,255,0.2));
          opacity: 0;
          transform: translate(-2px,-2px) rotate(-8deg) scale(0.94);
          transition:
            top 740ms cubic-bezier(0.22,1,0.36,1),
            left 740ms cubic-bezier(0.22,1,0.36,1),
            opacity 180ms ease,
            transform 740ms cubic-bezier(0.22,1,0.36,1);
          pointer-events: none;
        }
        [data-cursor-visible="true"] .ani-iface-preview-cursor {
          opacity: 1;
          transform: translate(-2px,-2px) rotate(-8deg) scale(1);
        }
        [data-cursor-target="main-edge"] .ani-iface-preview-cursor {
          top: 4px;
          left: calc(100% - 22px);
        }
        [data-cursor-target="rail-edge"] .ani-iface-preview-cursor {
          top: 57px;
          left: calc(100% - 4px);
        }
        [data-cursor-target="participant-pill"] .ani-iface-preview-cursor {
          top: 57px;
          left: calc(100% - 34px);
        }
      `}</style>

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.5)), radial-gradient(circle at 72% 28%, rgba(255,255,255,0.055), transparent 34%), linear-gradient(132deg, #18181b 0%, #101012 48%, #09090b 100%)",
        }}
      />

      <div
        className={cn(
          "absolute right-0 top-0 z-[2] h-0 w-[76px] origin-right rounded-full transition-[opacity,transform] duration-[180ms] ease-out",
          mainGlow
            ? "translate-y-0 scale-x-100 opacity-[0.94]"
            : "-translate-y-1 scale-x-[0.72] opacity-0",
        )}
        style={{
          boxShadow:
            "0 3px 10px 5px rgba(255,92,20,0.48), 0 12px 26px 10px rgba(249,115,22,0.22)",
        }}
      />

      <div
        className={cn(
          "absolute right-2 top-2 z-[3] flex h-6 min-w-[52px] items-center gap-1.5 rounded-full border border-white/15 bg-[rgba(9,9,11,0.76)] px-1.5 pl-1 backdrop-blur-md transition-[opacity,transform] duration-[220ms]",
          mainVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-[34px] opacity-0",
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow:
            "0 10px 26px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.07)",
        }}
      >
        <AnidachiLogo size={18} aria-hidden />
        <span className="h-[5px] w-[5px] rounded-full bg-[#6ee7b7] shadow-[0_0_8px_rgba(110,231,183,0.42)]" />
        <span className="text-[9px] font-bold text-white/90">3</span>
      </div>

      <div className="absolute right-0 top-[43px] z-[3] grid justify-items-end gap-1.5">
        {[0, 1, 2].map((index) => {
          const presentation = reducedMotion
            ? index === 0
              ? "expanded"
              : "peek"
            : pillPresentation({
                index,
                moment,
                pills,
                railExpanded,
              });
          const speaking = index === 0 && moment === "speaking";
          return (
            <div
              key={index}
              className={cn(
                "relative flex h-[27px] items-center gap-1.5 overflow-hidden rounded-l-full border border-r-0 transition-[width,opacity,transform,background,border-color] duration-[220ms]",
                presentation === "hidden" &&
                  "w-0 translate-x-4 border-transparent bg-transparent opacity-0",
                presentation === "compact" && "w-11 translate-x-0 opacity-100",
                presentation === "peek" && "w-[68px] translate-x-0 opacity-100",
                presentation === "expanded" &&
                  "w-[112px] translate-x-0 opacity-100",
                presentation !== "hidden" &&
                  "border-white/12 bg-[rgba(13,13,16,0.76)] backdrop-blur-md",
                speaking &&
                  "border-[rgba(125,211,167,0.64)] bg-[linear-gradient(90deg,rgba(34,197,94,0.14),rgba(13,13,16,0.76))]",
              )}
              style={{
                transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <span className="ml-0.5 grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full bg-white/15 text-[7px] font-extrabold text-white/80">
                {INITIALS[index]}
              </span>
              <span className="min-w-0 flex-1 leading-none">
                <strong className="block truncate text-[8px] font-bold text-white/90">
                  {NAMES[index]}
                </strong>
                <small className="block truncate text-[6.5px] font-semibold text-white/40">
                  {speaking ? "Speaking" : "In room"}
                </small>
              </span>
              {speaking ? (
                <AudioLines className="mr-1.5 h-2.5 w-2.5 shrink-0 text-[#6ee7b7]" />
              ) : null}
              {index === 1 ? (
                <VolumeX className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-[rgba(18,18,22,0.9)] p-px text-red-400" />
              ) : null}
            </div>
          );
        })}
      </div>

      <MousePointer2 className="ani-iface-preview-cursor h-[13px] w-[13px]" />
    </div>
  );
}

export function OverlayInterfaceShowcase() {
  const [main, setMain] = useState<MainMode>("auto-hide");
  const [pills, setPills] = useState<PillMode>("smart");
  const onMain = useCallback((value: string) => {
    setMain(value as MainMode);
  }, []);
  const onPills = useCallback((value: string) => {
    setPills(value as PillMode);
  }, []);

  return (
    <div className="space-y-3">
      <InterfacePreviewStage main={main} pills={pills} />
      <div>
        <p className="mb-2 text-[10px] font-medium text-white/45">
          Main control
        </p>
        <SegmentedChoice
          value={main}
          onChange={onMain}
          options={[
            { label: "Auto hide", value: "auto-hide" },
            { label: "Always visible", value: "always-visible" },
          ]}
        />
      </div>
      <div>
        <p className="mb-2 text-[10px] font-medium text-white/45">
          Participant pills
        </p>
        <SegmentedChoice
          value={pills}
          onChange={onPills}
          options={[
            { label: "Smart", value: "smart" },
            { label: "Always visible", value: "always-visible" },
          ]}
        />
      </div>
    </div>
  );
}
