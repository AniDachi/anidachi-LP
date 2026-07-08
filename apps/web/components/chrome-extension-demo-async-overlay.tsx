"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import Image from "next/image";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { DemoOverlayKeyframes, FRIENDS, type Participant } from "@/components/chrome-extension-demo-overlay";

export type DemoMode = "live" | "async";

export const ASYNC_STEP_LABELS = ["Watch", "React", "Later", "Unlock"] as const;

const FRIEND: Participant = {
  ...FRIENDS[1],
  displayName: "Your Friend",
  initials: "FR",
};
const YOU = FRIENDS[0];

const FRIEND_LABEL = "Your Friend";
const FRIEND_REACTION_TEXT = "NO WAY that was him the whole time??";
const REACTION_TIMESTAMP = "12:34";
/** Playhead position when the reaction unlocks (12:34 in a ~24min ep). */
const TIMELINE_PIN_PERCENT = 52;

type ActiveWatcher = "friend" | "you" | null;
type SpoilerState = "hidden" | "locked" | "unlocked";

const BEAT_TITLES = [
  "Your friend watches",
  "Your friend leaves a reaction",
  "2 days later",
  "Reaction unlocks",
] as const;

const BEAT_CAPTIONS = [
  "Your friend watches Episode 4 on their own time.",
  `They react at ${REACTION_TIMESTAMP} — the comment is pinned to that exact moment in the episode.`,
  "You press play days later. The episode starts from the beginning — their reaction waits at 12:34.",
  `You reach ${REACTION_TIMESTAMP} — their reaction appears right on cue. No spoilers, no chat scroll.`,
] as const;

export function AsyncDemoOverlayKeyframes() {
  return (
    <>
      <DemoOverlayKeyframes />
      <style>{`
        @keyframes async-pin-enter {
          0%   { opacity: 0; transform: translateY(8px) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes async-time-fade {
          0%   { opacity: 0; transform: scale(0.96); }
          20%  { opacity: 1; transform: scale(1); }
          80%  { opacity: 1; }
          100% { opacity: 0; transform: scale(1.02); }
        }
        @keyframes async-beat-title {
          0%   { opacity: 0; transform: translateY(-8px) scale(0.96); }
          12%  { opacity: 1; transform: translateY(0) scale(1); }
          82%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-4px) scale(0.98); }
        }
        @keyframes async-unlock {
          0%   { filter: blur(6px); opacity: 0.72; transform: scale(0.96); }
          45%  { filter: blur(0); opacity: 1; transform: scale(1.04); }
          100% { filter: blur(0); opacity: 1; transform: scale(1); }
        }
        @keyframes async-reaction-moment {
          0%   { opacity: 0; transform: translateY(10px) scale(0.95); }
          12%  { opacity: 1; transform: translateY(0) scale(1); }
          88%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-4px) scale(0.98); }
        }
        @keyframes async-chip-enter {
          0%   { opacity: 0; transform: translateX(-8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes async-playhead {
          0%   { width: 0%; }
          100% { width: 52%; }
        }
        @keyframes async-cursor-blink {
          0%, 45%  { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}

export function getAsyncDemoCaption(currentBeat: number): string {
  if (currentBeat >= 0 && currentBeat < BEAT_CAPTIONS.length) {
    return BEAT_CAPTIONS[currentBeat];
  }
  return BEAT_CAPTIONS[0];
}

function ParticipantAvatar({ p, size = 26 }: { p: Participant; size?: number }) {
  const src = p.avatarUrl;
  if (src) {
    return (
      <Image
        src={src}
        alt={p.displayName}
        width={size}
        height={size}
        className="object-cover w-full h-full"
        sizes={`${size}px`}
      />
    );
  }
  return (
    <div
      className="w-full h-full grid place-items-center font-extrabold text-white/90 bg-[rgba(15,15,28,0.7)]"
      style={{ fontSize: size <= 24 ? 10 : 12 }}
    >
      {p.initials}
    </div>
  );
}

function BeatTitle({
  title,
  compact = false,
}: {
  title: string | null;
  compact?: boolean;
}) {
  if (!title) return null;

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-[async-beat-title_2.6s_ease-in-out_forwards] ${
        compact ? "top-[7%]" : "top-[9%]"
      }`}
    >
      <div
        className={`rounded-full border border-white/25 font-bold text-white shadow-xl whitespace-nowrap ${
          compact ? "px-4 py-2 text-sm" : "px-5 py-2.5 text-base"
        }`}
        style={{
          background: "rgba(10,10,18,0.88)",
          backdropFilter: "blur(14px)",
        }}
      >
        {title}
      </div>
    </div>
  );
}

function WatcherChip({
  watcher,
  compact = false,
}: {
  watcher: ActiveWatcher;
  compact?: boolean;
}) {
  if (!watcher) return null;

  const participant = watcher === "friend" ? FRIEND : YOU;

  return (
    <div
      className={`absolute z-20 pointer-events-none animate-[async-chip-enter_0.4s_ease-out_forwards] ${
        compact ? "left-[3%] bottom-[8%]" : "left-4 bottom-6"
      }`}
    >
      <div
        className={`flex items-center gap-2.5 rounded-full border border-white/20 shadow-lg ${
          compact ? "pl-2 pr-3.5 py-2" : "pl-2 pr-3.5 py-2"
        }`}
        style={{
          background: "rgba(10,10,18,0.88)",
          backdropFilter: "blur(12px)",
        }}
      >
        <span
          className={`rounded-full overflow-hidden flex-shrink-0 border border-white/15 ${
            compact ? "w-8 h-8" : "w-9 h-9"
          }`}
        >
          <ParticipantAvatar p={participant} size={compact ? 32 : 36} />
        </span>
        <div className="min-w-0">
          <p className={`font-semibold text-white/95 leading-none ${compact ? "text-sm" : "text-sm"}`}>
            {participant.displayName}
          </p>
          <p className={`text-white/55 mt-0.5 ${compact ? "text-[11px]" : "text-[11px]"}`}>
            Watching Ep 4
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingCursor({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      className="inline-block w-[2px] h-[1em] ml-0.5 align-[-2px] bg-brand-orange-bright animate-[async-cursor-blink_0.9s_step-end_infinite]"
      aria-hidden
    />
  );
}

function ReactionMoment({
  visible,
  compact = false,
}: {
  visible: boolean;
  compact?: boolean;
}) {
  const [typedText, setTypedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };

    if (!visible) {
      clearTimers();
      setTypedText("");
      setTypingDone(false);
      return;
    }

    setTypedText("");
    setTypingDone(false);

    let index = 0;
    const schedule = (fn: () => void, delay: number) => {
      const id = window.setTimeout(fn, delay);
      timersRef.current.push(id);
    };

    const typeNext = () => {
      index += 1;
      setTypedText(FRIEND_REACTION_TEXT.slice(0, index));
      if (index >= FRIEND_REACTION_TEXT.length) {
        setTypingDone(true);
        return;
      }
      const delay = FRIEND_REACTION_TEXT[index - 1] === " " ? 72 : 44;
      schedule(typeNext, delay);
    };

    schedule(typeNext, 350);

    return clearTimers;
  }, [visible]);

  if (!visible) return null;

  const statusLabel = typingDone
    ? `Pinned to ${REACTION_TIMESTAMP}`
    : "Typing a reaction…";

  return (
    <div
      className={`absolute z-[25] pointer-events-none animate-[async-reaction-moment_4.8s_ease-in-out_forwards] ${
        compact
          ? "left-[3%] right-[3%] bottom-[15%]"
          : "left-1/2 -translate-x-1/2 bottom-[18%] w-[min(320px,72%)]"
      }`}
    >
      <div
        className={`rounded-2xl border border-brand-orange/35 shadow-[0_16px_40px_rgba(0,0,0,0.5)] ${
          compact ? "p-3.5" : "p-4"
        }`}
        style={{
          background: "rgba(10,10,18,0.92)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className={`rounded-full overflow-hidden flex-shrink-0 border border-white/15 ${
              compact ? "w-7 h-7" : "w-8 h-8"
            }`}
          >
            <ParticipantAvatar p={FRIEND} size={compact ? 28 : 32} />
          </span>
          <div className="min-w-0">
            <p className={`font-bold text-white/95 leading-none ${compact ? "text-sm" : "text-sm"}`}>
              {FRIEND_LABEL}
            </p>
            <p className={`text-brand-orange-bright mt-0.5 ${compact ? "text-[11px]" : "text-[11px]"}`}>
              {statusLabel}
            </p>
          </div>
        </div>
        <div
          className={`rounded-xl border border-white/12 bg-white/[0.06] min-h-[2.75rem] ${
            compact ? "px-2.5 py-2" : "px-3 py-2.5"
          }`}
        >
          <p className={`font-semibold text-white/95 leading-snug ${compact ? "text-sm" : "text-base"}`}>
            {typedText}
            <TypingCursor visible={!typingDone} />
          </p>
        </div>
        <p
          className={`text-white/50 mt-2 transition-opacity duration-300 ${
            typingDone ? "opacity-100" : "opacity-0"
          } ${compact ? "text-[10px]" : "text-[10px]"}`}
        >
          Saving to Episode 4 · {REACTION_TIMESTAMP}…
        </p>
      </div>
    </div>
  );
}

function TimelineReactionPin({
  spoilerState,
  compact = false,
}: {
  spoilerState: SpoilerState;
  compact?: boolean;
}) {
  if (spoilerState === "hidden") return null;

  const locked = spoilerState === "locked";
  const avatarSize = compact ? 30 : 36;

  return (
    <div
      className={`absolute z-[22] pointer-events-none -translate-x-1/2 ${
        locked ? "animate-[async-pin-enter_0.45s_ease-out_forwards]" : "animate-[async-unlock_0.7s_ease-out_forwards]"
      }`}
      style={{
        left: `${TIMELINE_PIN_PERCENT}%`,
        bottom: compact ? "calc(100% + 18px)" : "calc(100% + 12px)",
        width: compact ? "min(94%, 270px)" : "min(280px, 46%)",
      }}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border shadow-[0_18px_44px_rgba(0,0,0,0.55)] ${
          compact ? "p-3" : "p-3"
        } ${locked ? "border-white/20" : "border-brand-orange/40"}`}
        style={{
          background: locked
            ? "linear-gradient(145deg, rgba(18,18,28,0.94) 0%, rgba(12,12,20,0.88) 100%)"
            : "linear-gradient(145deg, rgba(22,16,12,0.96) 0%, rgba(10,10,18,0.92) 100%)",
          backdropFilter: "blur(16px)",
        }}
      >
        {!locked && (
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-orange/60 to-transparent"
            aria-hidden
          />
        )}

        <div className="flex items-start gap-2.5">
          <div className="relative shrink-0">
            <span
              className={`block rounded-full overflow-hidden border-2 ${
                locked ? "border-white/25" : "border-brand-orange/50"
              } ${compact ? "w-[30px] h-[30px]" : "w-9 h-9"}`}
            >
              <ParticipantAvatar p={FRIEND} size={avatarSize} />
            </span>
            {locked && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-[rgba(10,10,18,0.95)] border border-white/20 ${
                  compact ? "w-4 h-4" : "w-[18px] h-[18px]"
                }`}
              >
                <Lock className={compact ? "w-2 h-2 text-white/70" : "w-2.5 h-2.5 text-white/70"} aria-hidden />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className={`font-bold text-white/95 truncate ${compact ? "text-xs" : "text-xs"}`}>
                {FRIEND_LABEL}
              </p>
              <span
                className={`shrink-0 rounded-full font-bold tabular-nums ${
                  locked
                    ? "border border-white/15 bg-white/8 text-white/55"
                    : "border border-brand-orange/35 bg-brand-orange/15 text-brand-orange-bright"
                } ${compact ? "px-2 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]"}`}
              >
                {REACTION_TIMESTAMP}
              </span>
            </div>

            <div
              className={`rounded-xl border ${
                locked ? "border-white/10 bg-white/[0.04]" : "border-brand-orange/20 bg-brand-orange/[0.08]"
              } ${compact ? "px-2.5 py-2" : "px-2.5 py-2"}`}
            >
              {locked ? (
                <>
                  <p
                    className={`font-medium text-white/45 leading-snug select-none ${
                      compact ? "text-[11px]" : "text-[11px]"
                    }`}
                    style={{ filter: "blur(4px)" }}
                  >
                    {FRIEND_REACTION_TEXT}
                  </p>
                  <p className={`text-white/50 mt-1 ${compact ? "text-[10px]" : "text-[10px]"}`}>
                    Spoiler locked until you reach this moment
                  </p>
                </>
              ) : (
                <p
                  className={`font-semibold text-white/95 leading-snug ${
                    compact ? "text-[12px]" : "text-[12px]"
                  }`}
                >
                  {FRIEND_REACTION_TEXT}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`absolute left-1/2 -translate-x-1/2 rotate-45 border-r border-b ${
          locked ? "border-white/15 bg-[rgba(18,18,28,0.94)]" : "border-brand-orange/30 bg-[rgba(22,16,12,0.96)]"
        } ${compact ? "w-2.5 h-2.5 -bottom-[5px]" : "w-3 h-3 -bottom-[6px]"}`}
        aria-hidden
      />
    </div>
  );
}

function PlaybackProgressBar({
  visible,
  animate,
  spoilerState,
  compact = false,
}: {
  visible: boolean;
  animate: boolean;
  spoilerState: SpoilerState;
  compact?: boolean;
}) {
  if (!visible) return null;

  const showMarker = spoilerState !== "hidden";

  return (
    <div
      className={`absolute left-0 right-0 z-20 pointer-events-none ${
        compact ? "bottom-[3%] px-[3%]" : "bottom-3 px-4"
      }`}
    >
      <TimelineReactionPin spoilerState={spoilerState} compact={compact} />
      <div className={`relative rounded-full bg-white/15 overflow-visible ${compact ? "h-1" : "h-1"}`}>
        <div
          className={`h-full rounded-full bg-brand-orange ${
            animate ? "animate-[async-playhead_4.2s_linear_forwards]" : ""
          }`}
          style={animate ? undefined : { width: `${TIMELINE_PIN_PERCENT}%` }}
        />
        {showMarker && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[rgba(10,10,18,0.85)] ${
              spoilerState === "locked" ? "bg-white/50" : "bg-brand-orange shadow-[0_0_8px_rgba(251,146,60,0.6)]"
            } ${compact ? "w-2.5 h-2.5" : "w-2.5 h-2.5"}`}
            style={{ left: `${TIMELINE_PIN_PERCENT}%` }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

function TimePassesBanner({ visible, compact = false }: { visible: boolean; compact?: boolean }) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-black/35">
      <div
        className={`rounded-full border border-white/20 font-bold text-white/95 shadow-2xl animate-[async-time-fade_2.4s_ease-in-out_forwards] ${
          compact ? "px-4 py-2 text-sm" : "px-6 py-2.5 text-base"
        }`}
        style={{
          background: "rgba(10,10,18,0.82)",
          backdropFilter: "blur(14px)",
        }}
      >
        2 days later
      </div>
    </div>
  );
}

function PlaybackClock({
  visible,
  time,
  compact = false,
}: {
  visible: boolean;
  time: string;
  compact?: boolean;
}) {
  if (!visible) return null;

  return (
    <div
      className={`absolute z-20 rounded-lg border border-white/15 bg-black/55 font-mono font-semibold text-white/90 pointer-events-none transition-all duration-300 ${
        compact ? "left-[3%] top-[3%] px-2.5 py-1.5 text-[11px]" : "left-4 top-4 px-2.5 py-1 text-xs"
      }`}
    >
      {time}
    </div>
  );
}


function AsyncTopBubble({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 rounded-full border border-white/[0.16] shadow-[0_10px_30px_rgba(0,0,0,0.24)] pointer-events-none ${
        compact
          ? "h-8 px-2.5 bg-[rgba(10,10,18,0.82)]"
          : "h-[30px] px-2 gap-1.5 bg-[rgba(10,10,18,0.38)] backdrop-blur-lg"
      }`}
      aria-hidden
    >
      <AnidachiLogo
        size={compact ? 18 : 20}
        alt=""
        className={compact ? "w-[18px] h-[18px] shrink-0" : "w-5 h-5 shrink-0"}
        aria-hidden
      />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-orange" />
      <span
        className={`font-semibold text-white/90 leading-none ${
          compact ? "text-[12px]" : "text-[12px]"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

function resetAsyncDemoState(setters: {
  setCurrentBeat: (v: number) => void;
  setBeatTitle: (v: string | null) => void;
  setActiveWatcher: (v: ActiveWatcher) => void;
  setShowReactionMoment: (v: boolean) => void;
  setShowTimePasses: (v: boolean) => void;
  setSpoilerState: (v: SpoilerState) => void;
  setShowPlaybackClock: (v: boolean) => void;
  setPlaybackTime: (v: string) => void;
  setAnimatePlayhead: (v: boolean) => void;
  setDimVideo: (v: boolean) => void;
}) {
  setters.setCurrentBeat(0);
  setters.setBeatTitle(null);
  setters.setActiveWatcher(null);
  setters.setShowReactionMoment(false);
  setters.setShowTimePasses(false);
  setters.setSpoilerState("hidden");
  setters.setShowPlaybackClock(false);
  setters.setPlaybackTime("0:00");
  setters.setAnimatePlayhead(false);
  setters.setDimVideo(false);
}

export function useAsyncDemoOverlaySequence(
  visible: boolean,
  compact = false,
  reduceMotion = false,
) {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const schedule = (fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, delay);
    timers.current.add(id);
    return id;
  };

  const [currentBeat, setCurrentBeat] = useState(0);
  const [beatTitle, setBeatTitle] = useState<string | null>(null);
  const [activeWatcher, setActiveWatcher] = useState<ActiveWatcher>(null);
  const [showReactionMoment, setShowReactionMoment] = useState(false);
  const [showTimePasses, setShowTimePasses] = useState(false);
  const [spoilerState, setSpoilerState] = useState<SpoilerState>("hidden");
  const [showPlaybackClock, setShowPlaybackClock] = useState(false);
  const [playbackTime, setPlaybackTime] = useState("0:00");
  const [animatePlayhead, setAnimatePlayhead] = useState(false);
  const [dimVideo, setDimVideo] = useState(false);
  const [videoRestartToken, setVideoRestartToken] = useState(0);

  useEffect(() => {
    if (!visible) return;

    const setters = {
      setCurrentBeat,
      setBeatTitle,
      setActiveWatcher,
      setShowReactionMoment,
      setShowTimePasses,
      setSpoilerState,
      setShowPlaybackClock,
      setPlaybackTime,
      setAnimatePlayhead,
      setDimVideo,
    };

    if (reduceMotion) {
      setCurrentBeat(3);
      setBeatTitle(null);
      setActiveWatcher("you");
      setShowReactionMoment(false);
      setShowTimePasses(false);
      setSpoilerState("unlocked");
      setShowPlaybackClock(true);
      setPlaybackTime(REACTION_TIMESTAMP);
      setAnimatePlayhead(false);
      setDimVideo(false);
      return;
    }

    const seq: Array<() => void> = [
      // Beat 1 — Watch
      () => {
        resetAsyncDemoState(setters);
        setCurrentBeat(0);
        setBeatTitle(BEAT_TITLES[0]);
        setActiveWatcher("friend");
      },
      () => setBeatTitle(null),
      // Beat 2 — React
      () => {
        setCurrentBeat(1);
        setBeatTitle(BEAT_TITLES[1]);
        setShowReactionMoment(true);
      },
      () => setBeatTitle(null),
      () => setShowReactionMoment(false),
      // Beat 3 — Later
      () => {
        setCurrentBeat(2);
        setBeatTitle(null);
        setShowTimePasses(true);
        setDimVideo(true);
      },
      () => {
        setShowTimePasses(false);
        setDimVideo(false);
        setBeatTitle("You press play");
        setActiveWatcher("you");
        setSpoilerState("locked");
        setShowPlaybackClock(true);
        setPlaybackTime("0:00");
        setAnimatePlayhead(true);
        setVideoRestartToken((t) => t + 1);
      },
      () => setBeatTitle(null),
      () => setPlaybackTime("12:18"),
      () => setPlaybackTime("12:26"),
      () => setPlaybackTime("12:31"),
      // Beat 4 — Unlock at exact timestamp
      () => {
        setCurrentBeat(3);
        setBeatTitle(BEAT_TITLES[3]);
        setPlaybackTime(REACTION_TIMESTAMP);
        setSpoilerState("unlocked");
      },
      () => setBeatTitle(null),
      // Reset
      () => resetAsyncDemoState(setters),
    ];

    const delays = [
      700,
      2600,
      2200,
      5400,
      1200,
      1800,
      3800,
      1200,
      900,
      900,
      900,
      3200,
      2600,
      1400,
    ];

    function runStep(i: number) {
      schedule(() => {
        seq[i]?.();
        if (i + 1 < seq.length) runStep(i + 1);
        else schedule(() => runStep(0), 1000);
      }, delays[i] ?? 1500);
    }

    runStep(0);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [visible, compact, reduceMotion]);

  const caption = getAsyncDemoCaption(currentBeat);

  return {
    currentBeat,
    beatTitle,
    activeWatcher,
    showReactionMoment,
    showTimePasses,
    spoilerState,
    showPlaybackClock,
    playbackTime,
    animatePlayhead,
    dimVideo,
    videoRestartToken,
    caption,
    stepIndicatorIndex: currentBeat,
    participantCount: 2,
  };
}

export function AsyncDemoOverlayLayer({
  compact = false,
  demo,
}: {
  compact?: boolean;
  platformLabel?: string;
  demo: ReturnType<typeof useAsyncDemoOverlaySequence>;
}) {
  const {
    beatTitle,
    activeWatcher,
    showReactionMoment,
    showTimePasses,
    spoilerState,
    showPlaybackClock,
    playbackTime,
    animatePlayhead,
    participantCount,
  } = demo;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div
        className={`absolute pointer-events-none ${compact ? "top-[2%] right-[2%]" : "top-2.5 right-2.5"}`}
      >
        <AsyncTopBubble count={participantCount} compact={compact} />
      </div>

      <BeatTitle title={beatTitle} compact={compact} />
      <WatcherChip watcher={activeWatcher} compact={compact} />
      <ReactionMoment visible={showReactionMoment} compact={compact} />
      <TimePassesBanner visible={showTimePasses} compact={compact} />
      <PlaybackClock visible={showPlaybackClock} time={playbackTime} compact={compact} />
      <PlaybackProgressBar
        visible={showPlaybackClock}
        animate={animatePlayhead}
        spoilerState={spoilerState}
        compact={compact}
      />
    </div>
  );
}
