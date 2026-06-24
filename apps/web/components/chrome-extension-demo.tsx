"use client";

import { useState, useEffect, useRef } from "react";
import { X, Mic, Link2, Mic2, Tv } from "lucide-react";
import Image from "next/image";
import { AnidachiLogo } from "@/components/anidachi-logo";

const YT_VIDEO_ID = "M_OauHnAFc8";
const YT_EMBED_SRC = `https://www.youtube-nocookie.com/embed/${YT_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YT_VIDEO_ID}&controls=0&modestbranding=1&rel=0&iv_load_policy=3`;

const EMOJI_LIST = ["🤣", "😭", "😮", "🔥", "❤️", "💀"];

const STEP_LABELS = [
  "Bubble",
  "Open panel",
  "Create room",
  "Friends join",
  "Reactions",
  "Sync",
];

type Participant = {
  id: string;
  displayName: string;
  initials: string;
  role: "host" | "guest";
  cameraEnabled: boolean;
  avatarUrl?: string;
};

type ReactionPop = {
  id: string;
  emoji: string;
  right: number;
};

const FRIENDS: Participant[] = [
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

function TopBubble({
  connected,
  count,
  onClick,
}: {
  connected: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 h-[30px] px-2 rounded-full cursor-pointer border border-white/[0.16] bg-[rgba(10,10,18,0.38)] backdrop-blur-lg shadow-[0_10px_30px_rgba(0,0,0,0.24)] pointer-events-auto transition-transform active:scale-95"
    >
      <AnidachiLogo size={20} alt="" className="w-5 h-5 shrink-0" aria-hidden />
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-orange opacity-60 motion-reduce:animate-none" />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full transition-colors duration-700 ${
              connected ? "bg-brand-orange" : "bg-[#9ca3af]"
            }`}
          />
        </span>
      <span className="text-[12px] font-semibold text-white/90 leading-none">{count}</span>
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

function CamBubble({ p, active }: { p: Participant; active: boolean }) {
  const live = p.cameraEnabled && p.avatarUrl;
  return (
    <div
      className={`
        relative w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden
        border border-white/20 bg-[rgba(15,15,28,0.54)]
        shadow-[0_10px_28px_rgba(0,0,0,0.3)]
        animate-[cam-enter_0.2s_ease-out]
        transition-all duration-200
        ${active ? "opacity-100 scale-[1.08]" : "opacity-60"}
      `}
      title={p.displayName}
    >
      <div className={`w-full h-full ${live ? "animate-[cam-live_3s_ease-in-out_infinite]" : ""}`}>
        <ParticipantAvatar p={p} />
      </div>
      {p.cameraEnabled && (
        <span className="absolute right-[3px] bottom-[3px] w-2 h-2 rounded-full bg-[#7dd3a7] border-2 border-[rgba(10,10,18,0.9)] z-10" />
      )}
    </div>
  );
}

function ReactionPop({ reaction }: { reaction: ReactionPop }) {
  return (
    <div
      className="absolute bottom-24 pointer-events-none animate-[anidachi-pop_2.6s_ease_forwards]"
      style={{ right: reaction.right }}
    >
      <span className="text-2xl" style={{ textShadow: "0 3px 14px rgba(0,0,0,0.7)" }}>
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
}) {
  const subtitle = roomActive
    ? `YouTube · ${connected ? "connected" : "connecting"}`
    : "Create a local watch room";

  const panelStyle: React.CSSProperties = {
    background: "rgba(10,10,18,0.72)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 18px 56px rgba(0,0,0,0.34)",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    color: "rgba(255,255,255,0.92)",
  };

  const btnBase =
    "inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full text-[11px] font-semibold cursor-pointer border border-white/[0.14] bg-white/[0.08] text-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-brand-orange/30 hover:border-brand-orange/50 hover:text-brand-orange-bright";
  const btnPrimary =
    "inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-full text-[11px] font-semibold cursor-pointer border-0 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90";
  const sectionLabel =
    "mt-3.5 mb-2 text-[11px] font-bold tracking-widest uppercase text-white/50 block";

  return (
    <div
      className={`
        absolute top-12 right-2.5 z-20
        w-[min(320px,calc(100%-20px))] md:w-[min(360px,calc(100%-24px))] max-h-[calc(100%-58px)] overflow-auto
        rounded-2xl p-3.5 pointer-events-auto
        origin-top-right transition-all duration-150
        ${open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}
      `}
      style={panelStyle}
      aria-hidden={!open}
    >
      <div className="flex justify-between items-start gap-3 mb-3.5">
        <div className="flex items-start gap-2 min-w-0">
          <AnidachiLogo size={28} alt="" className="mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="m-0 text-base font-bold leading-tight">Anidachi</h2>
            <div className="mt-1 text-[12px] text-white/60">{subtitle}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-[30px] h-[30px] rounded-full border border-white/[0.14] bg-white/[0.08] flex items-center justify-center cursor-pointer text-white/70 hover:text-white/90 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
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
      <div className="flex gap-2 flex-wrap">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            disabled={!roomActive}
            className="w-[30px] h-[30px] rounded-full border border-white/[0.14] bg-white/[0.08] flex items-center justify-center cursor-pointer text-base disabled:opacity-50 hover:bg-brand-orange/30 hover:border-brand-orange/50 transition-colors"
          >
            {emoji}
          </button>
        ))}
        <button type="button" disabled={!roomActive} className={`${btnBase} gap-1`}>
          <Mic size={12} />
          Voice
        </button>
      </div>

      <span className={sectionLabel}>Participants</span>
      <div>
        {(participants.length ? participants : [FRIENDS[0]]).map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2.5 py-2 border-t border-white/[0.08]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-[26px] h-[26px] rounded-full overflow-hidden flex-shrink-0 border border-white/10">
                <ParticipantAvatar p={p} size={26} />
              </span>
              <span className="text-[13px] font-semibold truncate">{p.displayName}</span>
            </div>
            <span className="text-[11px] text-white/52 flex-shrink-0">
              {p.role}
              {p.cameraEnabled ? " · cam" : ""}
            </span>
          </div>
        ))}
      </div>

      <span className={sectionLabel}>Settings</span>
      <div className="flex flex-col gap-2">
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
            className="flex items-center justify-between gap-2.5 w-full px-2.5 py-[9px] rounded-xl border border-white/10 bg-white/[0.06] cursor-pointer hover:bg-brand-orange/30 hover:border-brand-orange/40 transition-colors"
          >
            <span className="text-[13px] font-semibold">{label}</span>
            <span className="text-[12px] text-white/58">{value ? onLabel : offLabel}</span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-[1.35] text-white/48">
        Ghost Cam publishes camera only. Microphone is used only for push-to-talk reactions.
      </p>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEP_LABELS.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  active ? "bg-brand-orange scale-125" : done ? "bg-brand-orange-deep" : "bg-brand-border"
                }`}
              />
              <span
                className={`text-[9px] font-semibold tracking-wide uppercase transition-colors duration-500 leading-none ${
                  active ? "text-brand-orange" : done ? "text-brand-orange-deep" : "text-foreground/30"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`w-6 h-px mb-3 transition-colors duration-500 ${
                  done ? "bg-brand-orange-deep" : "bg-brand-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChromeExtensionDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
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
    const el = sectionRef.current;
    if (!el) {
      setVisible(true);
      return;
    }
    const ob = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.15,
    });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

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
        const r1: ReactionPop = { id: crypto.randomUUID(), emoji: "🔥", right: 56 };
        setReactions((prev) => [...prev, r1]);
        schedule(() => setReactions((prev) => prev.filter((x) => x.id !== r1.id)), 2800);
        schedule(() => {
          const r2: ReactionPop = { id: crypto.randomUUID(), emoji: "😭", right: 110 };
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
  }, [visible]);

  const handleCopyInvite = () => {
    setCopied(true);
    schedule(() => setCopied(false), 1800);
  };

  const fireReaction = (emoji: string) => {
    const r: ReactionPop = { id: crypto.randomUUID(), emoji, right: 56 };
    setReactions((prev) => [...prev, r]);
    schedule(() => setReactions((prev) => prev.filter((x) => x.id !== r.id)), 2800);
  };

  const participantCount = participants.length || 1;

  let caption =
    'The Anidachi bubble sits in the top-right corner of any video player.';
  if (showCatchUp)
    caption = "If playback drifts, a banner appears. One tap brings everyone back in sync.";
  else if (participants.length >= 3)
    caption = "Haruto joined too. Tap any emoji to fire a live reaction over the video.";
  else if (participants.length === 2)
    caption = "Natsuki joined. Camera bubbles appear in the corner for each participant.";
  else if (roomActive)
    caption = "Room created! Copy the invite link and share it with friends.";
  else if (panelOpen)
    caption = "Tap the bubble to open the panel. Hit Create room to start a session.";

  return (
    <section
      ref={sectionRef}
      className="overflow-hidden bg-background py-16 text-foreground lg:py-20"
    >
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

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[1600px]">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/15 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-brand-orange">
            Live Demo
          </div>
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">See It In Action</h2>
          <div className="mx-auto mb-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-bright" />
          <p className="mx-auto max-w-xl text-base text-foreground/70">
            The overlay sits on any Crunchyroll player. Create a room, share the
            link, you&apos;re in.
          </p>
        </div>

        <div className="max-w-7xl mx-auto w-full">
          <StepIndicator current={currentStep} />

          <div className="w-[90%] max-w-full mx-auto rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <div className="relative aspect-video bg-black">
              <iframe
                src={YT_EMBED_SRC}
                title="Anidachi demo background video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                className="absolute inset-0 h-full w-full border-0 pointer-events-none"
              />

              <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute top-2.5 right-2.5 pointer-events-auto">
                  <TopBubble
                    connected={connected}
                    count={participantCount}
                    onClick={() => setPanelOpen((o) => !o)}
                  />
                </div>

                <MiniPanel
                  open={panelOpen}
                  roomActive={roomActive}
                  connected={connected}
                  participants={participants}
                  onClose={() => setPanelOpen(false)}
                  onCreateRoom={() => {
                    setRoomActive(true);
                    schedule(() => setConnected(true), 700);
                  }}
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
                />

                {overlayVisible && participants.length > 0 && (
                  <div className="absolute right-3 bottom-3 flex flex-row-reverse items-end gap-2 pointer-events-auto">
                    {participants.map((p, i) => (
                      <CamBubble key={p.id} p={p} active={i === 0} />
                    ))}
                  </div>
                )}

                {reactionsEnabled &&
                  reactions.map((r) => <ReactionPop key={r.id} reaction={r} />)}

                {showCatchUp && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bottom-12 flex items-center gap-2.5 px-3 min-h-9 rounded-full pointer-events-auto text-[13px] font-semibold z-20"
                    style={{
                      background: "rgba(26,18,8,0.62)",
                      border: "1px solid rgba(251,191,36,0.34)",
                      backdropFilter: "blur(18px)",
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    <span>3.2s out of sync</span>
          <button
          type="button"
          onClick={() => setShowCatchUp(false)}
          className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11px] font-bold cursor-pointer border-0"
          style={{ background: "oklch(0.71 0.20 45)", color: "oklch(0.07 0.008 35)" }}
        >
                      Catch up
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-background/80 px-5 py-4 border-t border-brand-border">
              <p className="text-sm text-foreground/60 text-center min-h-[1.25rem]">{caption}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-foreground/50">
            <span className="inline-flex items-center gap-1.5">
              <Tv className="h-4 w-4 text-brand-orange/70" aria-hidden="true" />
              Any video
            </span>
            <span className="text-brand-border/80" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-brand-orange/70" aria-hidden="true" />
              One invite link
            </span>
            <span className="text-brand-border/80" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mic2 className="h-4 w-4 text-brand-orange/70" aria-hidden="true" />
              Push-to-talk reactions
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
