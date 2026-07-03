"use client";

import { useEffect, useRef, useState } from "react";
import { X, Mic } from "lucide-react";
import Image from "next/image";
import { AnidachiLogo } from "@/components/anidachi-logo";

export const EMOJI_LIST = ["🤣", "😭", "😮", "🔥", "❤️", "💀"];

export type Participant = {
  id: string;
  displayName: string;
  initials: string;
  role: "host" | "guest";
  cameraEnabled: boolean;
  avatarUrl?: string;
};

export type ReactionPop = {
  id: string;
  emoji: string;
  right: number;
};

export const FRIENDS: Participant[] = [
  {
    id: "1",
    displayName: "You",
    initials: "YO",
    role: "host",
    cameraEnabled: true,
    avatarUrl: "/demo/avatars/host.jpg",
  },
  {
    id: "2",
    displayName: "Natsuki",
    initials: "NA",
    role: "guest",
    cameraEnabled: false,
    avatarUrl: "/demo/avatars/natsuki.jpg",
  },
  {
    id: "3",
    displayName: "Haruto",
    initials: "HA",
    role: "guest",
    cameraEnabled: true,
    avatarUrl: "/demo/avatars/haruto.jpg",
  },
];

export function DemoOverlayKeyframes() {
  return (
    <style>{`
      @keyframes anidachi-pop {
        0%   { opacity:0; transform: translate3d(-4px,10px,0) scale(0.82); }
        16%  { opacity:1; transform: translate3d(0,0,0) scale(1); }
        78%  { opacity:1; }
        100% { opacity:0; transform: translate3d(10px,-42px,0) scale(0.92); }
      }
      @keyframes cam-enter {
        0%   { opacity:0; transform: translateY(8px) scale(0.8); }
        100% { opacity:1; transform: translateY(0) scale(1); }
      }
      @keyframes cam-live {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.04); }
      }
    `}</style>
  );
}

function TopBubble({
  connected,
  count,
  onClick,
  compact = false,
}: {
  connected: boolean;
  count: number;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full cursor-pointer border border-white/[0.16] shadow-[0_10px_30px_rgba(0,0,0,0.24)] pointer-events-auto transition-transform active:scale-95 ${
        compact
          ? "h-7 px-2 bg-[rgba(10,10,18,0.82)]"
          : "h-[30px] px-2 gap-1.5 bg-[rgba(10,10,18,0.38)] backdrop-blur-lg"
      }`}
    >
      <AnidachiLogo
        size={compact ? 18 : 20}
        alt=""
        className={compact ? "w-[18px] h-[18px] shrink-0" : "w-5 h-5 shrink-0"}
        aria-hidden
      />
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-orange opacity-60 motion-reduce:animate-none" />
        <span
          className={`relative inline-flex h-2 w-2 rounded-full transition-colors duration-700 ${
            connected ? "bg-brand-orange" : "bg-[#9ca3af]"
          }`}
        />
      </span>
      <span
        className={`font-semibold text-white/90 leading-none ${
          compact ? "text-[11px]" : "text-[12px]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ParticipantAvatar({
  p,
  size = 44,
  className = "",
}: {
  p: Participant;
  size?: number;
  className?: string;
}) {
  const src = p.cameraEnabled ? p.avatarUrl : undefined;
  if (src) {
    return (
      <Image
        src={src}
        alt={p.displayName}
        width={size}
        height={size}
        className={`object-cover w-full h-full ${className}`}
        sizes={`${size}px`}
      />
    );
  }
  return (
    <div
      className={`w-full h-full grid place-items-center font-extrabold text-white/90 bg-[rgba(15,15,28,0.7)] ${className}`}
      style={{ fontSize: size <= 28 ? 10 : 13 }}
    >
      {p.initials}
    </div>
  );
}

function CamBubble({
  p,
  active,
  compact = false,
}: {
  p: Participant;
  active: boolean;
  compact?: boolean;
}) {
  const live = p.cameraEnabled && p.avatarUrl;
  return (
    <div
      className={`
        relative rounded-full overflow-hidden
        border border-white/20 bg-[rgba(15,15,28,0.54)]
        shadow-[0_10px_28px_rgba(0,0,0,0.3)]
        animate-[cam-enter_0.2s_ease-out]
        transition-all duration-200
        ${compact ? "w-10 h-10" : "w-12 h-12 md:w-14 md:h-14"}
        ${active ? "opacity-100 scale-[1.08]" : "opacity-60"}
      `}
      title={p.displayName}
    >
      <div className={`w-full h-full ${live ? "animate-[cam-live_3s_ease-in-out_infinite]" : ""}`}>
        <ParticipantAvatar p={p} size={compact ? 36 : 44} />
      </div>
      {p.cameraEnabled && (
        <span className="absolute right-[2px] bottom-[2px] w-1.5 h-1.5 rounded-full bg-[#7dd3a7] border border-[rgba(10,10,18,0.9)] z-10" />
      )}
    </div>
  );
}

function ReactionPop({
  reaction,
  compact = false,
}: {
  reaction: ReactionPop;
  compact?: boolean;
}) {
  return (
    <div
      className={`absolute pointer-events-none animate-[anidachi-pop_2.6s_ease_forwards] ${
        compact ? "bottom-16" : "bottom-24"
      }`}
      style={{ right: reaction.right }}
    >
      <span
        className={compact ? "text-xl" : "text-2xl"}
        style={{ textShadow: "0 3px 14px rgba(0,0,0,0.7)" }}
      >
        {reaction.emoji}
      </span>
    </div>
  );
}

function MiniPanel({
  open,
  roomActive,
  connected,
  participants,
  onClose,
  onCreateRoom,
  onCopyInvite,
  onSyncNow,
  onReact,
  copied,
  ghostCam,
  setGhostCam,
  reactionsEnabled,
  setReactionsEnabled,
  overlay,
  setOverlay,
  compact = false,
  platformLabel = "YouTube",
}: {
  open: boolean;
  roomActive: boolean;
  connected: boolean;
  participants: Participant[];
  onClose: () => void;
  onCreateRoom: () => void;
  onCopyInvite: () => void;
  onSyncNow: () => void;
  onReact: (emoji: string) => void;
  copied: boolean;
  ghostCam: boolean;
  setGhostCam: (v: boolean) => void;
  reactionsEnabled: boolean;
  setReactionsEnabled: (v: boolean) => void;
  overlay: boolean;
  setOverlay: (v: boolean) => void;
  compact?: boolean;
  platformLabel?: string;
}) {
  const subtitle = roomActive
    ? `${platformLabel} · ${connected ? "connected" : "connecting"}`
    : "Create a local watch room";

  const panelStyle: React.CSSProperties = compact
    ? {
        background: "rgba(10,10,18,0.9)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.34)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        color: "rgba(255,255,255,0.92)",
      }
    : {
        background: "rgba(10,10,18,0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 18px 56px rgba(0,0,0,0.34)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        color: "rgba(255,255,255,0.92)",
      };

  const btnBase = compact
    ? "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[10px] font-semibold cursor-pointer border border-white/[0.14] bg-white/[0.08] text-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:bg-brand-orange/30"
    : "inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full text-[11px] font-semibold cursor-pointer border border-white/[0.14] bg-white/[0.08] text-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-brand-orange/30 hover:border-brand-orange/50 hover:text-brand-orange-bright";
  const btnPrimary = compact
    ? "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[10px] font-semibold cursor-pointer border-0 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity active:opacity-90"
    : "inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full text-[11px] font-semibold cursor-pointer border-0 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90";
  const sectionLabel = compact
    ? "mt-3 mb-1.5 text-[10px] font-bold tracking-widest uppercase text-white/50 block"
    : "mt-3.5 mb-2 text-[11px] font-bold tracking-widest uppercase text-white/50 block";

  return (
    <div
      className={`
        absolute z-20 rounded-2xl pointer-events-auto origin-top-right transition-all duration-150 overflow-auto
        ${compact ? "top-[3.5%] right-[2.5%] w-[88%] max-h-[58%] p-3" : "top-12 right-2.5 w-[min(320px,calc(100%-20px))] md:w-[min(360px,calc(100%-24px))] max-h-[calc(100%-58px)] p-3.5"}
        ${open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}
      `}
      style={panelStyle}
      aria-hidden={!open}
    >
      <div className={`flex justify-between items-start gap-2 ${compact ? "mb-3" : "mb-3.5"}`}>
        <div className="flex items-start gap-2 min-w-0">
          <AnidachiLogo
            size={compact ? 24 : 28}
            alt=""
            className="mt-0.5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0">
            <h2 className={`m-0 font-bold leading-tight ${compact ? "text-[13px]" : "text-base"}`}>
              Anidachi
            </h2>
            <div className={`text-white/60 ${compact ? "mt-0.5 text-[11px]" : "mt-1 text-[12px]"}`}>
              {subtitle}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`rounded-full border border-white/[0.14] bg-white/[0.08] flex items-center justify-center cursor-pointer text-white/70 active:text-white/90 transition-colors shrink-0 ${
            compact ? "w-7 h-7" : "w-[30px] h-[30px]"
          }`}
        >
          <X size={compact ? 13 : 14} />
        </button>
      </div>

      <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
        <button
          type="button"
          onClick={onCreateRoom}
          className={btnPrimary}
          style={{ background: "oklch(0.71 0.20 45)", color: "oklch(0.07 0.008 35)" }}
        >
          {roomActive ? "New room" : "Create room"}
        </button>
        <button type="button" onClick={onCopyInvite} disabled={!roomActive} className={btnBase}>
          {copied ? "Copied!" : "Copy invite"}
        </button>
        <button type="button" onClick={onSyncNow} disabled={!roomActive} className={btnBase}>
          Sync now
        </button>
      </div>

      <span className={sectionLabel}>Reactions</span>
      <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            disabled={!roomActive}
            className={`rounded-full border border-white/[0.14] bg-white/[0.08] flex items-center justify-center cursor-pointer disabled:opacity-50 active:bg-brand-orange/30 transition-colors ${
              compact ? "w-7 h-7 text-sm" : "w-[30px] h-[30px] text-base"
            }`}
          >
            {emoji}
          </button>
        ))}
        <button type="button" disabled={!roomActive} className={`${btnBase} gap-1`}>
          <Mic size={compact ? 10 : 12} />
          Voice
        </button>
      </div>

      <span className={sectionLabel}>Participants</span>
      <div>
        {(participants.length ? participants : [FRIENDS[0]]).map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-2 border-t border-white/[0.08] ${
              compact ? "py-1.5" : "py-2"
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`rounded-full overflow-hidden flex-shrink-0 border border-white/10 ${
                  compact ? "w-6 h-6" : "w-[26px] h-[26px]"
                }`}
              >
                <ParticipantAvatar p={p} size={compact ? 24 : 26} />
              </span>
              <span className={`font-semibold truncate ${compact ? "text-xs" : "text-[13px]"}`}>
                {p.displayName}
              </span>
            </div>
            <span className={`text-white/52 flex-shrink-0 ${compact ? "text-[10px]" : "text-[11px]"}`}>
              {p.role}
              {p.cameraEnabled ? " · cam" : ""}
            </span>
          </div>
        ))}
      </div>

      <span className={sectionLabel}>Settings</span>
      <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
        {(
          [
            { label: "Ghost Cam", value: ghostCam, set: setGhostCam },
            { label: "Reactions", value: reactionsEnabled, set: setReactionsEnabled },
            {
              label: "Overlay",
              value: overlay,
              set: setOverlay,
              onLabel: "Visible",
              offLabel: "Hidden",
            },
          ] as Array<{
            label: string;
            value: boolean;
            set: (v: boolean) => void;
            onLabel?: string;
            offLabel?: string;
          }>
        ).map(({ label, value, set, onLabel = "On", offLabel = "Off" }) => (
          <button
            key={label}
            type="button"
            onClick={() => set(!value)}
            className={`flex items-center justify-between w-full rounded-xl border border-white/10 bg-white/[0.06] cursor-pointer active:bg-brand-orange/30 active:border-brand-orange/40 transition-colors ${
              compact ? "gap-2 px-2 py-1.5" : "gap-2.5 px-2.5 py-[9px]"
            }`}
          >
            <span className={`font-semibold ${compact ? "text-xs" : "text-[13px]"}`}>
              {label}
            </span>
            <span className={`text-white/58 ${compact ? "text-[11px]" : "text-[12px]"}`}>
              {value ? onLabel : offLabel}
            </span>
          </button>
        ))}
      </div>

      {!compact && (
        <p className="mt-3 text-[11px] leading-[1.35] text-white/48">
          Ghost Cam publishes camera only. Microphone is used only for push-to-talk reactions.
        </p>
      )}
    </div>
  );
}

export function getDemoCaption({
  panelOpen,
  roomActive,
  participants,
  showCatchUp,
}: {
  panelOpen: boolean;
  roomActive: boolean;
  participants: Participant[];
  showCatchUp: boolean;
}): string {
  if (showCatchUp) {
    return "If playback drifts, a banner appears. One tap brings everyone back in sync.";
  }
  if (participants.length >= 3) {
    return "Haruto joined too. Tap any emoji to fire a live reaction over the video.";
  }
  if (participants.length === 2) {
    return "Natsuki joined. Camera bubbles appear in the corner for each participant.";
  }
  if (roomActive) {
    return "Room created! Copy the invite link and share it with friends.";
  }
  if (panelOpen) {
    return "Tap the bubble to open the panel. Hit Create room to start a session.";
  }
  return "The Anidachi bubble sits in the top-right corner of any video player.";
}

export function useDemoOverlaySequence(visible: boolean, compact = false) {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const schedule = (fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, delay);
    timers.current.add(id);
    return id;
  };

  const [panelOpen, setPanelOpen] = useState(false);
  const [roomActive, setRoomActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [reactions, setReactions] = useState<ReactionPop[]>([]);
  const [copied, setCopied] = useState(false);
  const [showCatchUp, setShowCatchUp] = useState(false);
  const [ghostCam, setGhostCam] = useState(true);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!visible) return;

    const reactionRight = compact ? 36 : 56;
    const reactionRight2 = compact ? 72 : 110;

    const seq: Array<() => void> = [
      () => {
        setCurrentStep(1);
        setPanelOpen(true);
      },
      () => {
        setCurrentStep(2);
        setRoomActive(true);
        schedule(() => setConnected(true), 700);
      },
      () => {
        setCurrentStep(3);
        setParticipants([FRIENDS[0], FRIENDS[1]]);
      },
      () => {
        setParticipants([
          FRIENDS[0],
          { ...FRIENDS[1], cameraEnabled: true },
          FRIENDS[2],
        ]);
      },
      () => {
        setCurrentStep(4);
        const r1: ReactionPop = { id: crypto.randomUUID(), emoji: "🔥", right: reactionRight };
        setReactions((prev) => [...prev, r1]);
        schedule(() => setReactions((prev) => prev.filter((x) => x.id !== r1.id)), 2800);
        schedule(() => {
          const r2: ReactionPop = { id: crypto.randomUUID(), emoji: "😭", right: reactionRight2 };
          setReactions((prev) => [...prev, r2]);
          schedule(() => setReactions((prev) => prev.filter((x) => x.id !== r2.id)), 2800);
        }, 600);
      },
      () => {
        setCurrentStep(5);
        setShowCatchUp(true);
      },
      () => {
        setCurrentStep(0);
        setShowCatchUp(false);
        setPanelOpen(false);
        setRoomActive(false);
        setConnected(false);
        setParticipants([]);
        setCopied(false);
      },
    ];

    const delays = [800, 2000, 2000, 1800, 2000, 2000, 2500];

    function runStep(i: number) {
      schedule(() => {
        seq[i]?.();
        if (i + 1 < seq.length) runStep(i + 1);
        else schedule(() => runStep(0), 1200);
      }, delays[i]);
    }

    runStep(0);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [visible, compact]);

  const handleCopyInvite = () => {
    setCopied(true);
    schedule(() => setCopied(false), 1800);
  };

  const fireReaction = (emoji: string) => {
    const r: ReactionPop = {
      id: crypto.randomUUID(),
      emoji,
      right: compact ? 36 : 56,
    };
    setReactions((prev) => [...prev, r]);
    schedule(() => setReactions((prev) => prev.filter((x) => x.id !== r.id)), 2800);
  };

  const handleCreateRoom = () => {
    setRoomActive(true);
    schedule(() => setConnected(true), 700);
  };

  const caption = getDemoCaption({ panelOpen, roomActive, participants, showCatchUp });
  const participantCount = participants.length || 1;

  return {
    panelOpen,
    setPanelOpen,
    roomActive,
    connected,
    participants,
    reactions,
    copied,
    showCatchUp,
    setShowCatchUp,
    ghostCam,
    setGhostCam,
    reactionsEnabled,
    setReactionsEnabled,
    overlayVisible,
    setOverlayVisible,
    currentStep,
    schedule,
    handleCopyInvite,
    handleCreateRoom,
    fireReaction,
    caption,
    participantCount,
  };
}

export function DemoOverlayLayer({
  compact = false,
  platformLabel = "YouTube",
  demo,
}: {
  compact?: boolean;
  platformLabel?: string;
  demo: ReturnType<typeof useDemoOverlaySequence>;
}) {
  const {
    panelOpen,
    setPanelOpen,
    roomActive,
    connected,
    participants,
    reactions,
    copied,
    showCatchUp,
    setShowCatchUp,
    ghostCam,
    setGhostCam,
    reactionsEnabled,
    setReactionsEnabled,
    overlayVisible,
    setOverlayVisible,
    handleCopyInvite,
    handleCreateRoom,
    fireReaction,
    participantCount,
  } = demo;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div
        className={`absolute pointer-events-auto ${compact ? "top-[2%] right-[2%]" : "top-2.5 right-2.5"}`}
      >
        <TopBubble
          connected={connected}
          count={participantCount}
          onClick={() => setPanelOpen((o) => !o)}
          compact={compact}
        />
      </div>

      <MiniPanel
        open={panelOpen}
        roomActive={roomActive}
        connected={connected}
        participants={participants}
        onClose={() => setPanelOpen(false)}
        onCreateRoom={handleCreateRoom}
        onCopyInvite={handleCopyInvite}
        onSyncNow={() => {}}
        onReact={fireReaction}
        copied={copied}
        ghostCam={ghostCam}
        setGhostCam={setGhostCam}
        reactionsEnabled={reactionsEnabled}
        setReactionsEnabled={setReactionsEnabled}
        overlay={overlayVisible}
        setOverlay={setOverlayVisible}
        compact={compact}
        platformLabel={platformLabel}
      />

      {overlayVisible && participants.length > 0 && (
        <div
          className={`absolute flex flex-row-reverse items-end pointer-events-auto ${
            compact ? "right-[2.5%] bottom-[2.5%] gap-2" : "right-3 bottom-3 gap-2"
          }`}
        >
          {participants.map((p, i) => (
            <CamBubble key={p.id} p={p} active={i === 0} compact={compact} />
          ))}
        </div>
      )}

      {reactionsEnabled &&
        reactions.map((r) => (
          <ReactionPop key={r.id} reaction={r} compact={compact} />
        ))}

      {showCatchUp && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 flex flex-nowrap items-center rounded-full pointer-events-auto font-semibold z-20 ${
            compact
              ? "bottom-[12%] gap-2 px-3 py-1.5 text-[11px] leading-none max-w-[calc(100%-12px)]"
              : "bottom-12 gap-2.5 px-3 min-h-9 text-[13px]"
          }`}
          style={{
            background: compact ? "rgba(26,18,8,0.88)" : "rgba(26,18,8,0.62)",
            border: "1px solid rgba(251,191,36,0.34)",
            backdropFilter: compact ? "blur(6px)" : "blur(18px)",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          <span className="shrink-0 whitespace-nowrap">
            {compact ? "3.2s behind" : "3.2s out of sync"}
          </span>
          <button
            type="button"
            onClick={() => setShowCatchUp(false)}
            className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full font-bold cursor-pointer border-0 leading-none ${
              compact ? "h-7 px-3 text-[11px]" : "h-[26px] px-2.5 text-[11px]"
            }`}
            style={{ background: "oklch(0.71 0.20 45)", color: "oklch(0.07 0.008 35)" }}
          >
            Catch up
          </button>
        </div>
      )}
    </div>
  );
}
