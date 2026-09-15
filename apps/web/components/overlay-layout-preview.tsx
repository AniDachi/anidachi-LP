"use client";

import { useEffect, useMemo, useState } from "react";
import { MousePointer2 } from "lucide-react";
import { useInView } from "@/lib/use-in-view";
import { cn } from "@/lib/utils";

type SelectedObject = "video" | "chat";

type LayoutDraft = {
  video: { right: number; bottom: number };
  chat: { left: number; top: number };
};

type CursorTarget = "rest" | "cams" | "chat" | "slider" | "apply";

type PreviewFrame = {
  applyPulse: boolean;
  cursorTarget: CursorTarget;
  cursorVisible: boolean;
  draft: LayoutDraft;
  durationMs: number;
  selected: SelectedObject;
  sizeStep: number;
};

const CAM_SIZE_STEPS = [
  { label: "Small", pct: 11 },
  { label: "Normal", pct: 13.5 },
  { label: "Large", pct: 16.5 },
  { label: "XL", pct: 19 },
] as const;

const DEFAULT_DRAFT: LayoutDraft = {
  video: { right: 5, bottom: 14 },
  chat: { left: 5, top: 46 },
};

const CAM_DRAGGED: LayoutDraft = {
  video: { right: 26, bottom: 34 },
  chat: DEFAULT_DRAFT.chat,
};

const CHAT_DRAGGED: LayoutDraft = {
  video: CAM_DRAGGED.video,
  chat: { left: 7, top: 12 },
};

const PAUSE_MS = 520;
const TRAVEL_MS = 780;
const HOLD_MS = 900;
const SIZE_TICK_MS = 520;
const APPLY_MS = 720;
const RESET_MS = 520;

const CHAT_LINES = [
  { color: "#c4a7ff", name: "Mika", text: "That scene was perfect." },
  { color: "#8bd5ca", name: "Ren", text: "Wait for the next part..." },
  { color: "#f5bde6", name: "You", text: "No way." },
] as const;

function buildFrames(): PreviewFrame[] {
  return [
    {
      draft: DEFAULT_DRAFT,
      selected: "video",
      sizeStep: 1,
      cursorTarget: "rest",
      cursorVisible: false,
      applyPulse: false,
      durationMs: PAUSE_MS,
    },
    {
      draft: DEFAULT_DRAFT,
      selected: "video",
      sizeStep: 1,
      cursorTarget: "cams",
      cursorVisible: true,
      applyPulse: false,
      durationMs: TRAVEL_MS,
    },
    {
      draft: CAM_DRAGGED,
      selected: "video",
      sizeStep: 1,
      cursorTarget: "cams",
      cursorVisible: true,
      applyPulse: false,
      durationMs: HOLD_MS,
    },
    {
      draft: CAM_DRAGGED,
      selected: "chat",
      sizeStep: 1,
      cursorTarget: "chat",
      cursorVisible: true,
      applyPulse: false,
      durationMs: TRAVEL_MS,
    },
    {
      draft: CHAT_DRAGGED,
      selected: "chat",
      sizeStep: 1,
      cursorTarget: "chat",
      cursorVisible: true,
      applyPulse: false,
      durationMs: HOLD_MS,
    },
    {
      draft: CHAT_DRAGGED,
      selected: "video",
      sizeStep: 1,
      cursorTarget: "slider",
      cursorVisible: true,
      applyPulse: false,
      durationMs: TRAVEL_MS,
    },
    {
      draft: CHAT_DRAGGED,
      selected: "video",
      sizeStep: 2,
      cursorTarget: "slider",
      cursorVisible: true,
      applyPulse: false,
      durationMs: SIZE_TICK_MS,
    },
    {
      draft: CHAT_DRAGGED,
      selected: "video",
      sizeStep: 3,
      cursorTarget: "slider",
      cursorVisible: true,
      applyPulse: false,
      durationMs: SIZE_TICK_MS,
    },
    {
      draft: CHAT_DRAGGED,
      selected: "video",
      sizeStep: 3,
      cursorTarget: "apply",
      cursorVisible: true,
      applyPulse: true,
      durationMs: APPLY_MS,
    },
    {
      draft: DEFAULT_DRAFT,
      selected: "video",
      sizeStep: 1,
      cursorTarget: "rest",
      cursorVisible: false,
      applyPulse: false,
      durationMs: RESET_MS,
    },
  ];
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function LayoutGrid({
  draft,
  sizeStep,
  selected,
}: {
  draft: LayoutDraft;
  sizeStep: number;
  selected: SelectedObject;
}) {
  const sizePct = CAM_SIZE_STEPS[sizeStep]?.pct ?? 13.5;
  // Match extension layout-video-slot-v2: circular cams sized as % of a 16:9 stage.
  const camW = `${sizePct}%`;
  const camH = `${sizePct * (16 / 9)}%`;

  return (
    <div className="relative isolate aspect-video min-h-[148px] w-full overflow-hidden rounded-lg border border-white/11 bg-[rgba(5,5,8,0.78)] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(180deg, rgba(255,255,255,0.045), transparent 54%),
            repeating-linear-gradient(
              to right,
              transparent 0,
              transparent calc(8.333% - 1px),
              rgba(255,255,255,0.04) calc(8.333% - 1px),
              rgba(255,255,255,0.04) 8.333%
            ),
            repeating-linear-gradient(
              to bottom,
              transparent 0,
              transparent calc(12.5% - 1px),
              rgba(255,255,255,0.04) calc(12.5% - 1px),
              rgba(255,255,255,0.04) 12.5%
            )
          `,
        }}
      />

      <div
        className={cn(
          "absolute z-[3] flex flex-col justify-end gap-1 overflow-hidden rounded-[7px] border px-2.5 py-2 transition-[left,top,border-color,box-shadow] duration-700",
          selected === "chat"
            ? "border-[rgba(125,184,255,0.9)] shadow-[0_0_0_2px_rgba(96,165,250,0.22),0_8px_20px_rgba(0,0,0,0.24)]"
            : "border-[rgba(125,184,255,0.42)] shadow-[0_8px_20px_rgba(0,0,0,0.24)]",
        )}
        style={{
          left: `${draft.chat.left}%`,
          top: `${draft.chat.top}%`,
          width: "36%",
          height: "38%",
          background:
            "linear-gradient(180deg, rgba(71,120,188,0.14), rgba(28,51,82,0.22)), rgba(7,12,20,0.82)",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {CHAT_LINES.map((msg) => (
          <div key={msg.name} className="min-w-0 leading-none">
            <span
              className="block truncate text-[8px] font-bold"
              style={{ color: msg.color }}
            >
              {msg.name}
            </span>
            <span className="mt-0.5 block truncate text-[7.5px] text-white/70">
              {msg.text}
            </span>
          </div>
        ))}
      </div>

      {[0, 1, 2, 3].map((index) => {
        const isLeader = index === 0;
        return (
          <div
            key={index}
            className={cn(
              "absolute rounded-full border transition-[right,bottom,width,height,border-color,box-shadow,opacity] duration-700",
              isLeader ? "z-[4]" : "z-[1] opacity-[0.42]",
              isLeader && selected === "video"
                ? "border-[rgba(255,166,92,0.92)] shadow-[0_0_0_2px_rgba(249,115,22,0.2),0_10px_22px_rgba(0,0,0,0.32)]"
                : "border-[rgba(110,231,183,0.52)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_18px_rgba(0,0,0,0.28)]",
              !isLeader && "border-[rgba(110,231,183,0.3)] shadow-none",
            )}
            style={{
              width: camW,
              height: camH,
              right: `${draft.video.right + index * (sizePct + 2.2)}%`,
              bottom: `${draft.video.bottom}%`,
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              background: isLeader
                ? "linear-gradient(145deg, rgba(52,211,153,0.32), rgba(15,118,110,0.16)), rgba(10,22,19,0.86)"
                : "linear-gradient(145deg, rgba(52,211,153,0.22), rgba(15,118,110,0.12)), rgba(10,22,19,0.7)",
            }}
          />
        );
      })}
    </div>
  );
}

export function OverlayLayoutShowcase() {
  const reducedMotion = usePrefersReducedMotion();
  const [rootRef, inView] = useInView<HTMLDivElement>();
  const frames = useMemo(() => buildFrames(), []);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
  }, []);

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
        draft: CHAT_DRAGGED,
        selected: "video" as const,
        sizeStep: 2,
        cursorTarget: "rest" as const,
        cursorVisible: false,
        applyPulse: false,
        durationMs: 0,
      })
    : (frames[frameIndex] ?? frames[0]);

  const sizeStep = frame?.sizeStep ?? 1;
  const sizeLabel = CAM_SIZE_STEPS[sizeStep]?.label ?? "Normal";
  const sliderProgress = `${(sizeStep / (CAM_SIZE_STEPS.length - 1)) * 100}%`;
  const selected = frame?.selected ?? "video";
  const draft = frame?.draft ?? DEFAULT_DRAFT;
  const sizePct = CAM_SIZE_STEPS[sizeStep]?.pct ?? 13.5;
  const cursorTarget = frame?.cursorTarget ?? "rest";

  // Grid is ~55% of showcase height; controls sit below. Cursor follows drag targets.
  const cursorPos = (() => {
    switch (cursorTarget) {
      case "cams":
        return {
          top: `${48 - draft.video.bottom * 0.35}%`,
          left: `${94 - draft.video.right - sizePct * 0.45}%`,
        };
      case "chat":
        return {
          top: `${10 + draft.chat.top * 0.4}%`,
          left: `${10 + draft.chat.left + 16}%`,
        };
      case "slider":
        return { top: "78%", left: "58%" };
      case "apply":
        return { top: "94%", left: "88%" };
      default:
        return { top: "42%", left: "48%" };
    }
  })();

  return (
    <div
      ref={rootRef}
      className="relative space-y-3"
      data-cursor-visible={String(frame?.cursorVisible ?? false)}
      aria-hidden="true"
    >
      <style>{`
        .ani-layout-preview-cursor {
          position: absolute;
          z-index: 20;
          color: rgba(255,255,255,0.92);
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.78)) drop-shadow(0 0 6px rgba(255,255,255,0.2));
          opacity: 0;
          transform: translate(-2px,-2px) rotate(-8deg) scale(0.94);
          transition:
            top 720ms cubic-bezier(0.22,1,0.36,1),
            left 720ms cubic-bezier(0.22,1,0.36,1),
            opacity 180ms ease,
            transform 720ms cubic-bezier(0.22,1,0.36,1);
          pointer-events: none;
        }
        [data-cursor-visible="true"] .ani-layout-preview-cursor {
          opacity: 1;
          transform: translate(-2px,-2px) rotate(-8deg) scale(1);
        }
      `}</style>

      <LayoutGrid draft={draft} sizeStep={sizeStep} selected={selected} />

      <div className="flex rounded-full border border-white/12 p-0.5">
        {(["video", "chat"] as const).map((option) => {
          const on = selected === option;
          return (
            <span
              key={option}
              className={cn(
                "flex h-8 flex-1 items-center justify-center rounded-full text-[11px] font-semibold capitalize transition-colors",
                on ? "bg-[#ff8a3d] text-black" : "text-white/45",
              )}
            >
              {option}
            </span>
          );
        })}
      </div>

      <div
        className={cn(
          "rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 transition-opacity",
          selected === "chat" && "opacity-45",
        )}
      >
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-medium text-white/55">Camera size</span>
          <span className="font-semibold text-white/85">{sizeLabel}</span>
        </div>
        <div className="relative mt-2 h-1 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#ff8a3d] transition-[width] duration-500"
            style={{
              width: sliderProgress,
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
          <span
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-[#ffb07a] bg-[#ff8a3d] shadow-[0_0_0_3px_rgba(255,138,61,0.18)] transition-[left] duration-500"
            style={{
              left: `max(0px, calc(${sliderProgress} - 6px))`,
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-white/35">
          <span>Small</span>
          <span>XL</span>
        </div>
      </div>

      <div className="flex justify-end">
        <span
          className={cn(
            "inline-flex h-8 items-center rounded-full bg-[#ff8a3d] px-3 text-[11px] font-bold text-black transition-[transform,box-shadow] duration-300",
            frame?.applyPulse &&
              "scale-[1.04] shadow-[0_0_0_4px_rgba(255,138,61,0.28)]",
          )}
        >
          Apply
        </span>
      </div>

      <MousePointer2
        className="ani-layout-preview-cursor h-[13px] w-[13px]"
        style={cursorPos}
      />
    </div>
  );
}
