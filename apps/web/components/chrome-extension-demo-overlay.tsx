"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Mic, RefreshCw, Send, Smile, UserPlus, Video } from "lucide-react";
import Image from "next/image";
import { AnidachiLogo } from "@/components/anidachi-logo";

export const EMOJI_LIST = ["😂", "😱", "❤️", "🔥", "😭", "👀"];

export type Participant = {
  id: string;
  displayName: string;
  initials: string;
  role: "host" | "guest";
  cameraEnabled: boolean;
  avatarUrl?: string;
  speaking?: boolean;
  nameColor?: string;
};

export type ReactionPop = {
  id: string;
  emoji: string;
  right: number;
};

export type LiveChatLine = {
  id: string;
  name: string;
  color: string;
  text: string;
};

export const FRIENDS: Participant[] = [
  {
    id: "1",
    displayName: "You",
    initials: "YO",
    role: "host",
    cameraEnabled: true,
    avatarUrl: "/demo/avatars/host.jpg",
    nameColor: "#ff8a3d",
  },
  {
    id: "2",
    displayName: "Natsuki",
    initials: "NA",
    role: "guest",
    cameraEnabled: false,
    avatarUrl: "/demo/avatars/natsuki.jpg",
    nameColor: "#7dd3a7",
  },
  {
    id: "3",
    displayName: "Haruto",
    initials: "HA",
    role: "guest",
    cameraEnabled: true,
    avatarUrl: "/demo/avatars/haruto.jpg",
    speaking: true,
    nameColor: "#93c5fd",
  },
];

const SETTINGS_TABS = ["Reactions", "Layout", "Voice"] as const;

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
      @keyframes demo-edge-glow {
        0%   { opacity:0; transform: translateY(-4px) scaleX(0.7); }
        30%  { opacity:0.96; transform: translateY(0) scaleX(1); }
        100% { opacity:0; transform: translateY(-2px) scaleX(0.85); }
      }
      @keyframes demo-chat-in {
        0%   { opacity:0; transform: translateY(6px); }
        100% { opacity:1; transform: translateY(0); }
      }
      @keyframes demo-composer-in {
        0%   { opacity:0; transform: translateY(10px) scale(0.98); }
        100% { opacity:1; transform: translateY(0) scale(1); }
      }
    `}</style>
  );
}

function TopBubble({
  connected,
  warning,
  count,
  onClick,
  compact = false,
  showEdgeGlow = false,
}: {
  connected: boolean;
  warning?: boolean;
  count: number;
  onClick: () => void;
  compact?: boolean;
  showEdgeGlow?: boolean;
}) {
  const syncClass = warning
    ? "bg-[#fbbf24]"
    : connected
      ? "bg-[#7dd3a7]"
      : "bg-[#9ca3af]";

  return (
    <div className="relative">
      {showEdgeGlow && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-1 right-0 h-0 w-[104px] rounded-full"
          style={{
            boxShadow:
              "0 3px 12px 6px rgba(255, 92, 20, 0.56), 0 13px 32px 12px rgba(249, 115, 22, 0.34)",
            animation: "demo-edge-glow 1.1s ease-out both",
          }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        className={`relative z-[1] flex items-center rounded-full cursor-pointer border border-white/[0.18] pointer-events-auto transition-transform active:scale-95 ${
          compact
            ? "h-7 gap-1.5 px-2 bg-[rgba(9,9,11,0.78)]"
            : "h-8 gap-[7px] px-2.5 bg-[rgba(9,9,11,0.68)] backdrop-blur-[22px]"
        }`}
        style={{
          boxShadow:
            "0 14px 34px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <AnidachiLogo
          size={compact ? 18 : 24}
          alt=""
          className={
            compact
              ? "w-[18px] h-[18px] shrink-0 rounded-full"
              : "w-6 h-6 shrink-0 rounded-full"
          }
          aria-hidden
        />
        <span className={`inline-flex h-1.5 w-1.5 rounded-full transition-colors duration-500 ${syncClass}`} />
        <span
          className={`font-semibold text-white/[0.93] leading-none ${
            compact ? "text-[11px]" : "text-[12px]"
          }`}
          style={{ fontWeight: 650 }}
        >
          {count}
        </span>
      </button>
    </div>
  );
}

function ParticipantAvatar({
  p,
  size = 44,
  className = "",
  forceAvatar = false,
}: {
  p: Participant;
  size?: number;
  className?: string;
  forceAvatar?: boolean;
}) {
  const src = forceAvatar || p.cameraEnabled ? p.avatarUrl : undefined;
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
  speaking,
  compact = false,
}: {
  p: Participant;
  speaking?: boolean;
  compact?: boolean;
}) {
  const live = p.cameraEnabled && p.avatarUrl;
  const isSpeaking = Boolean(speaking);
  return (
    <div
      className={`
        relative rounded-full
        bg-[rgba(15,15,28,0.82)]
        shadow-[0_10px_28px_rgba(0,0,0,0.3)]
        animate-[cam-enter_0.2s_ease-out]
        transition-all duration-200
        ${compact ? "w-10 h-10" : "w-12 h-12 md:w-14 md:h-14"}
        ${isSpeaking ? "opacity-100 scale-[1.06]" : "opacity-90"}
      `}
      style={{
        border: isSpeaking
          ? "2px solid rgba(125, 211, 167, 0.85)"
          : "1px solid rgba(255,255,255,0.24)",
        boxShadow: isSpeaking
          ? "0 0 0 3px rgba(125, 211, 167, 0.18), 0 10px 28px rgba(0,0,0,0.3)"
          : undefined,
      }}
      title={p.displayName}
    >
      <div className={`w-full h-full overflow-hidden rounded-full ${live ? "animate-[cam-live_3s_ease-in-out_infinite]" : ""}`}>
        <ParticipantAvatar p={p} size={compact ? 36 : 44} />
      </div>
      {isSpeaking && (
        <span
          className="absolute -bottom-0.5 -right-0.5 z-10 grid place-items-center rounded-full bg-[rgba(9,9,11,0.92)] border border-[rgba(125,211,167,0.55)] text-[#7dd3a7]"
          style={{ width: compact ? 14 : 16, height: compact ? 14 : 16 }}
        >
          <Mic size={compact ? 8 : 9} strokeWidth={2.5} />
        </span>
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

function LiveChatColumn({
  messages,
  compact = false,
}: {
  messages: LiveChatLine[];
  compact?: boolean;
}) {
  if (!messages.length) return null;
  return (
    <div
      className={`absolute pointer-events-none flex flex-col justify-end gap-1.5 overflow-hidden ${
        compact
          ? "left-[3%] bottom-[22%] w-[72%] max-h-[28%]"
          : "left-4 bottom-[22%] w-[min(280px,42%)] max-h-[38%]"
      }`}
      style={{
        maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 100%)",
      }}
    >
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          className="max-w-full"
          style={{
            animation: "demo-chat-in 180ms ease-out both",
            animationDelay: `${i * 80}ms`,
            textShadow:
              "0 1px 1px rgba(0,0,0,0.86), 0 0 2px rgba(0,0,0,0.7), 0 0 5px rgba(0,0,0,0.35)",
          }}
        >
          <span
            className={`font-bold ${compact ? "text-[11px]" : "text-[13px]"}`}
            style={{ color: msg.color }}
          >
            {msg.name}
          </span>{" "}
          <span
            className={`font-semibold text-white/[0.95] ${compact ? "text-[11px]" : "text-[13px]"}`}
          >
            {msg.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function MessageComposerPeek({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-[15] flex items-center pointer-events-none ${
        compact
          ? "bottom-[14%] w-[min(92%,280px)] gap-1.5 p-1 rounded-[14px]"
          : "bottom-14 w-[min(430px,calc(100%-36px))] gap-1.5 p-1.5 rounded-[18px]"
      }`}
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(9,9,11,0.82)",
        backdropFilter: compact ? "blur(12px)" : "blur(26px)",
        boxShadow: "0 18px 56px rgba(0,0,0,0.34)",
        animation: "demo-composer-in 220ms ease-out both",
      }}
    >
      <span
        className={`grid place-items-center rounded-full border border-white/[0.12] bg-white/[0.065] text-white/70 shrink-0 ${
          compact ? "w-7 h-7" : "w-[34px] h-[34px]"
        }`}
      >
        <Smile size={compact ? 13 : 15} />
      </span>
      <span
        className={`flex-1 min-w-0 truncate text-white/38 font-semibold ${
          compact ? "text-[11px]" : "text-[13px]"
        }`}
      >
        Say something…
      </span>
      <span
        className={`grid place-items-center rounded-full shrink-0 ${
          compact ? "w-7 h-7" : "w-8 h-8"
        }`}
        style={{
          background: "linear-gradient(135deg, #ffb15f, #f97316)",
          color: "rgba(28,17,9,0.96)",
          opacity: 0.42,
        }}
      >
        <Send size={compact ? 11 : 13} />
      </span>
    </div>
  );
}

function MiniPanel({
  open,
  roomActive,
  participants,
  onCreateRoom,
  onCopyInvite,
  onSyncNow,
  onReact,
  copied,
  speakingId,
  compact = false,
}: {
  open: boolean;
  roomActive: boolean;
  participants: Participant[];
  onCreateRoom: () => void;
  onCopyInvite: () => void;
  onSyncNow: () => void;
  onReact: (emoji: string) => void;
  copied: boolean;
  speakingId?: string | null;
  compact?: boolean;
}) {
  const people = participants.length ? participants : [FRIENDS[0]];
  const mediaSeats = Math.min(
    4,
    people.filter((p) => p.cameraEnabled).length || (roomActive ? 1 : 0),
  );

  const panelStyle: React.CSSProperties = {
    background:
      "linear-gradient(180deg, rgba(23,22,25,0.94) 0%, rgba(9,9,11,0.84) 100%), rgba(10,10,12,0.82)",
    backdropFilter: compact ? "blur(12px) saturate(1.12)" : "blur(28px) saturate(1.12)",
    WebkitBackdropFilter: compact ? "blur(12px) saturate(1.12)" : "blur(28px) saturate(1.12)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.06)",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    color: "rgba(255,255,255,0.93)",
  };

  return (
    <div
      className={`
        absolute z-20 pointer-events-auto origin-top-right transition-all duration-150 overflow-auto
        ${compact ? "top-[3.5%] right-[2.5%] w-[88%] max-h-[58%] p-3 rounded-[16px]" : "top-12 right-2.5 w-[min(324px,calc(100%-20px))] max-h-[calc(100%-58px)] p-[13px] rounded-[18px]"}
        ${open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}
      `}
      style={panelStyle}
      aria-hidden={!open}
    >
      {/* Account header */}
      <div
        className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 ${
          compact ? "mb-2.5 pb-2.5" : "mb-2.5 pb-[11px]"
        }`}
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`rounded-full overflow-hidden shrink-0 grid place-items-center font-bold text-[12px] text-white/90 ${
              compact ? "w-7 h-7" : "w-8 h-8"
            }`}
            style={{
              background:
                "linear-gradient(135deg, rgba(255,138,61,0.34), rgba(255,255,255,0.08)), rgba(255,255,255,0.06)",
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 18px rgba(0,0,0,0.18)",
            }}
          >
            {FRIENDS[0].initials}
          </span>
          <div className="min-w-0 grid gap-0.5">
            <div className="flex items-baseline gap-1 min-w-0">
              <span
                className={`truncate font-extrabold text-white/[0.93] ${
                  compact ? "text-[13px]" : "text-[14px]"
                }`}
              >
                You
              </span>
              <span
                className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10px] font-semibold text-white/72"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                Plus
              </span>
            </div>
            {roomActive ? (
              <span className={`text-white/56 ${compact ? "text-[10px]" : "text-[11px]"}`}>
                {mediaSeats} of 4 media seats
              </span>
            ) : (
              <span className={`text-white/56 ${compact ? "text-[10px]" : "text-[11px]"}`}>
                Create rooms and invite friends
              </span>
            )}
          </div>
        </div>
        {roomActive ? (
          <button
            type="button"
            className={`grid place-items-center rounded-full border border-white/[0.12] bg-white/[0.065] text-[#7dd3a7] shrink-0 ${
              compact ? "w-7 h-7" : "w-9 h-9"
            }`}
            aria-label="Camera on"
            title="Camera on"
          >
            <Video size={compact ? 12 : 14} />
          </button>
        ) : null}
      </div>

      {/* Primary action + icon row */}
      <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
        <button
          type="button"
          onClick={onCreateRoom}
          className={`flex-1 inline-flex items-center justify-center rounded-full font-bold border-0 cursor-pointer transition-opacity hover:opacity-90 ${
            compact ? "h-8 text-[11px]" : "h-9 text-[12px]"
          } ${roomActive ? "" : ""}`}
          style={
            roomActive
              ? {
                  background: "rgba(51,35,37,0.88)",
                  color: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(248,113,113,0.24)",
                }
              : {
                  background: "linear-gradient(135deg, #ffb15f, #f97316)",
                  color: "rgba(28,17,9,0.96)",
                  boxShadow: "0 10px 24px rgba(249,115,22,0.2)",
                }
          }
        >
          {roomActive ? "Leave room" : "Create room"}
        </button>
        {roomActive ? (
          <div className={`flex shrink-0 ${compact ? "gap-1" : "gap-1.5"}`} role="group" aria-label="Room actions">
            <button
              type="button"
              onClick={onCopyInvite}
              aria-label={copied ? "Invite copied" : "Copy invite"}
              title={copied ? "Invite copied" : "Copy invite"}
              className={`grid place-items-center rounded-full border cursor-pointer ${
                compact ? "w-8 h-8" : "w-9 h-9"
              }`}
              style={{
                borderColor: copied ? "rgba(52,211,153,0.38)" : "rgba(255,255,255,0.12)",
                background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.065)",
                color: copied ? "rgba(110,231,183,0.96)" : "rgba(255,255,255,0.78)",
              }}
            >
              {copied ? <Check size={compact ? 12 : 14} /> : <Copy size={compact ? 12 : 14} />}
            </button>
            <button
              type="button"
              aria-label="Invite friends and groups"
              title="Invite friends and groups"
              className={`grid place-items-center rounded-full border border-white/[0.12] bg-white/[0.065] text-white/78 cursor-pointer ${
                compact ? "w-8 h-8" : "w-9 h-9"
              }`}
            >
              <UserPlus size={compact ? 12 : 14} />
            </button>
            <button
              type="button"
              onClick={onSyncNow}
              aria-label="Sync now"
              title="Sync now"
              className={`grid place-items-center rounded-full border border-white/[0.12] bg-white/[0.065] text-white/78 cursor-pointer ${
                compact ? "w-8 h-8" : "w-9 h-9"
              }`}
            >
              <RefreshCw size={compact ? 12 : 14} />
            </button>
          </div>
        ) : null}
      </div>

      {/* People */}
      {roomActive ? (
        <>
          <div
            className={`flex items-center justify-between ${
              compact ? "mt-3 mb-1" : "mt-3.5 mb-1.5"
            }`}
          >
            <span
              className={`font-bold tracking-widest uppercase text-white/50 ${
                compact ? "text-[10px]" : "text-[11px]"
              }`}
            >
              People
            </span>
            <span className={`text-white/45 ${compact ? "text-[10px]" : "text-[11px]"}`}>
              {people.length}
            </span>
          </div>
          <div>
            {people.map((p) => {
              const speaking = speakingId === p.id || p.speaking;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 border-t border-white/[0.08] ${
                    compact ? "py-1.5" : "py-2"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`rounded-full overflow-hidden flex-shrink-0 border ${
                        compact ? "w-6 h-6" : "w-[26px] h-[26px]"
                      }`}
                      style={{
                        borderColor: speaking
                          ? "rgba(125,211,167,0.7)"
                          : "rgba(255,255,255,0.1)",
                      }}
                    >
                      <ParticipantAvatar p={p} size={compact ? 24 : 26} forceAvatar />
                    </span>
                    <span className={`font-semibold truncate ${compact ? "text-xs" : "text-[13px]"}`}>
                      {p.displayName}
                      {p.role === "host" ? (
                        <span className="text-white/45 font-medium"> · host</span>
                      ) : null}
                    </span>
                  </div>
                  <span
                    className={`flex-shrink-0 ${compact ? "text-[10px]" : "text-[11px]"} ${
                      speaking ? "text-[#7dd3a7]" : "text-white/52"
                    }`}
                  >
                    {speaking ? "speaking" : p.cameraEnabled ? "cam" : "voice"}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* Settings tabs */}
      <div className={compact ? "mt-3" : "mt-3.5"}>
        <span
          className={`block font-bold tracking-widest uppercase text-white/50 ${
            compact ? "mb-1.5 text-[10px]" : "mb-2 text-[11px]"
          }`}
        >
          Settings
        </span>
        <div
          className={`flex ${compact ? "gap-3 mb-2" : "gap-[18px] mb-2.5"}`}
          role="tablist"
          aria-label="Settings sections"
        >
          {SETTINGS_TABS.map((tab) => {
            const active = tab === "Reactions";
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                className={`relative h-8 px-0.5 text-[10.5px] font-semibold tracking-wide cursor-default ${
                  active ? "text-[rgba(255,238,224,0.96)]" : "text-white/58"
                }`}
              >
                {tab}
                {active ? (
                  <span
                    className="absolute left-1/2 bottom-0 h-0.5 w-[22px] -translate-x-1/2 rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #ffad63, #f97316)",
                      boxShadow: "0 0 8px rgba(249,115,22,0.22)",
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
          {EMOJI_LIST.map((emoji, index) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              disabled={!roomActive}
              className={`rounded-full border border-white/[0.12] bg-white/[0.065] flex items-center justify-center cursor-pointer disabled:opacity-50 active:bg-[rgba(249,115,22,0.16)] transition-colors ${
                compact ? "w-7 h-7 text-sm" : "w-[30px] h-[30px] text-base"
              }`}
              title={`${index + 1}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function getDemoCaption({
  panelOpen,
  roomActive,
  participants,
  showCatchUp,
  showComposer,
}: {
  panelOpen: boolean;
  roomActive: boolean;
  participants: Participant[];
  showCatchUp: boolean;
  showComposer?: boolean;
}): string {
  if (showCatchUp) {
    return "If playback drifts, a banner appears. One tap brings everyone back in sync.";
  }
  if (participants.length >= 3) {
    return "Live chat and reactions float over the video — tap an emoji or type in the composer.";
  }
  if (participants.length === 2) {
    return "Natsuki joined. Camera bubbles appear in the corner for each participant.";
  }
  if (showComposer && roomActive && !panelOpen) {
    return "Room is live. Chat from the composer or react without leaving the player.";
  }
  if (roomActive) {
    return "Room created! Copy the invite or invite friends from the panel.";
  }
  if (panelOpen) {
    return "Tap the bubble to open the panel. Hit Create room to start a session.";
  }
  return "The Anidachi bubble sits in the top-right corner of any Crunchyroll or YouTube player.";
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
  const [chatMessages, setChatMessages] = useState<LiveChatLine[]>([]);
  const [copied, setCopied] = useState(false);
  const [showCatchUp, setShowCatchUp] = useState(false);
  const [showEdgeGlow, setShowEdgeGlow] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!visible) return;

    const reactionRight = compact ? 36 : 56;
    const reactionRight2 = compact ? 72 : 110;

    setShowEdgeGlow(true);
    schedule(() => setShowEdgeGlow(false), 1100);

    const seq: Array<() => void> = [
      () => {
        setCurrentStep(1);
        setPanelOpen(true);
        setShowComposer(false);
      },
      () => {
        setCurrentStep(2);
        setRoomActive(true);
        schedule(() => setConnected(true), 700);
      },
      () => {
        setCurrentStep(3);
        setParticipants([FRIENDS[0], FRIENDS[1]]);
        setChatMessages([
          {
            id: "c1",
            name: "Natsuki",
            color: FRIENDS[1].nameColor ?? "#7dd3a7",
            text: "I'm in!!",
          },
        ]);
      },
      () => {
        setParticipants([
          FRIENDS[0],
          { ...FRIENDS[1], cameraEnabled: true },
          FRIENDS[2],
        ]);
        setSpeakingId("3");
        setChatMessages([
          {
            id: "c1",
            name: "Natsuki",
            color: FRIENDS[1].nameColor ?? "#7dd3a7",
            text: "I'm in!!",
          },
          {
            id: "c2",
            name: "Haruto",
            color: FRIENDS[2].nameColor ?? "#93c5fd",
            text: "that ending 😭",
          },
          {
            id: "c3",
            name: "You",
            color: FRIENDS[0].nameColor ?? "#ff8a3d",
            text: "wait for it…",
          },
        ]);
      },
      () => {
        setCurrentStep(4);
        setPanelOpen(false);
        setShowComposer(true);
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
        setShowComposer(false);
      },
      () => {
        setCurrentStep(0);
        setShowCatchUp(false);
        setPanelOpen(false);
        setRoomActive(false);
        setConnected(false);
        setParticipants([]);
        setChatMessages([]);
        setCopied(false);
        setShowComposer(false);
        setSpeakingId(null);
        setShowEdgeGlow(true);
        schedule(() => setShowEdgeGlow(false), 1100);
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
    if (roomActive) {
      setRoomActive(false);
      setConnected(false);
      setParticipants([]);
      setChatMessages([]);
      setShowComposer(false);
      setSpeakingId(null);
      return;
    }
    setRoomActive(true);
    schedule(() => setConnected(true), 700);
  };

  const caption = getDemoCaption({
    panelOpen,
    roomActive,
    participants,
    showCatchUp,
    showComposer,
  });
  const participantCount = participants.length || 1;

  return {
    panelOpen,
    setPanelOpen,
    roomActive,
    connected,
    participants,
    reactions,
    chatMessages,
    copied,
    showCatchUp,
    setShowCatchUp,
    showEdgeGlow,
    showComposer,
    speakingId,
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
  demo,
}: {
  compact?: boolean;
  /** @deprecated Kept for call-site compatibility; panel no longer shows platform label. */
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
    chatMessages,
    copied,
    showCatchUp,
    setShowCatchUp,
    showEdgeGlow,
    showComposer,
    speakingId,
    handleCopyInvite,
    handleCreateRoom,
    fireReaction,
    participantCount,
  } = demo;

  const overlayOnVideo = participants.length > 0;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div
        className={`absolute pointer-events-auto ${compact ? "top-[2%] right-[2%]" : "top-2.5 right-2.5"}`}
      >
        <TopBubble
          connected={connected}
          warning={showCatchUp}
          count={participantCount}
          onClick={() => setPanelOpen((o) => !o)}
          compact={compact}
          showEdgeGlow={showEdgeGlow && !panelOpen}
        />
      </div>

      <MiniPanel
        open={panelOpen}
        roomActive={roomActive}
        participants={participants}
        onCreateRoom={handleCreateRoom}
        onCopyInvite={handleCopyInvite}
        onSyncNow={() => {}}
        onReact={fireReaction}
        copied={copied}
        speakingId={speakingId}
        compact={compact}
      />

      {overlayOnVideo && (
        <LiveChatColumn messages={chatMessages} compact={compact} />
      )}

      {overlayOnVideo && (
        <div
          className={`absolute flex flex-row-reverse items-end pointer-events-none ${
            compact ? "right-[2.5%] bottom-[2.5%] gap-2" : "right-3 bottom-3 gap-2"
          }`}
        >
          {participants.map((p) => (
            <CamBubble
              key={p.id}
              p={p}
              speaking={speakingId === p.id || p.speaking}
              compact={compact}
            />
          ))}
        </div>
      )}

      {showComposer && roomActive && !panelOpen && !showCatchUp && (
        <MessageComposerPeek compact={compact} />
      )}

      {reactions.map((r) => (
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
            background: compact ? "rgba(26,18,8,0.88)" : "rgba(26,18,8,0.72)",
            border: "1px solid rgba(251,191,36,0.34)",
            backdropFilter: compact ? "blur(6px)" : "blur(18px)",
            color: "rgba(255,255,255,0.92)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
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
            style={{
              background: "linear-gradient(135deg, #ffb15f, #f97316)",
              color: "rgba(28,17,9,0.96)",
            }}
          >
            Catch up
          </button>
        </div>
      )}
    </div>
  );
}
