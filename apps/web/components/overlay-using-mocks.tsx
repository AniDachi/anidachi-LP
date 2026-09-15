import type { ReactNode } from "react";
import {
  CircleHelp,
  Copy,
  Radio,
  RefreshCw,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { OverlayInterfaceShowcase } from "@/components/overlay-interface-preview";
import { OverlayLayoutShowcase } from "@/components/overlay-layout-preview";
import { cn } from "@/lib/utils";

const TABS = ["Reactions", "Layout", "Interface", "Voice", "Room"] as const;

const REACTION_SLOTS = [
  ["1", "😂"],
  ["2", "😱"],
  ["3", "❤️"],
  ["4", "🔥"],
  ["5", "😭"],
  ["6", "👀"],
  ["7", "👏"],
  ["8", "🤯"],
  ["9", "😴"],
  ["0", "💯"],
] as const;

function Hit({
  children,
  className,
  pill = true,
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  pill?: boolean;
  padded?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex border-2 border-[#eee5d9]",
        pill ? "rounded-full" : "rounded-md",
        padded && "bg-[#0b0b0d] p-0.5",
        className,
      )}
    >
      {children}
    </span>
  );
}

function OverlayPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0d] text-left text-white",
        className,
      )}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

function SettingsTabs({ active }: { active: (typeof TABS)[number] }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-3 pt-2">
      {TABS.map((tab) => {
        const on = tab === active;
        const label = (
          <span
            className={cn(
              "inline-flex h-8 shrink-0 items-center px-0.5 text-[11px] font-semibold",
              on ? "text-[#ffeee0]" : "text-white/45",
            )}
          >
            {tab}
          </span>
        );
        return on ? (
          <Hit key={tab}>{label}</Hit>
        ) : (
          <span key={tab}>{label}</span>
        );
      })}
    </div>
  );
}

function SettingsShell({
  active,
  children,
}: {
  active: (typeof TABS)[number];
  children: ReactNode;
}) {
  return (
    <OverlayPanel>
      <p className="px-3 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">
        Settings
      </p>
      <SettingsTabs active={active} />
      <div className="px-3 py-3">{children}</div>
    </OverlayPanel>
  );
}

function OrangeFill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-full items-center justify-center rounded-full bg-gradient-to-br from-[#ffb15f] to-[#f97316] px-1 text-[11px] font-bold text-[#1c1109]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Segmented({
  options,
  selected,
  hit,
  compact = false,
}: {
  options: readonly string[];
  selected: string;
  hit?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex rounded-full border border-white/12 p-0.5">
      {options.map((opt) => {
        const on = opt === selected;
        const inner = on ? (
          <OrangeFill className={compact ? "text-[10px]" : undefined}>
            {opt}
          </OrangeFill>
        ) : (
          <span
            className={cn(
              "flex h-8 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white/45",
              compact && "text-[10px]",
            )}
          >
            {opt}
          </span>
        );
        return opt === hit ? (
          <Hit key={opt} className="min-w-0 flex-1" padded={on}>
            {inner}
          </Hit>
        ) : (
          <span key={opt} className="min-w-0 flex-1">
            {inner}
          </span>
        );
      })}
    </div>
  );
}

/** White circular radio control used to give / take a media seat. */
function MediaSeatButton({
  active,
  hit,
}: {
  active: boolean;
  hit?: boolean;
}) {
  const button = (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full",
        active
          ? "bg-[#eee5d9] text-[#0b0b0d]"
          : "border border-white/20 bg-white/[0.04] text-white/55",
      )}
    >
      <Radio className="h-4 w-4" strokeWidth={2.2} />
    </span>
  );
  return hit ? <Hit>{button}</Hit> : button;
}

export function OverlayBubbleMock() {
  return (
    <OverlayPanel>
      <div className="relative h-[148px] bg-[linear-gradient(160deg,#1a1410_0%,#0d0d0f_55%,#16120e_100%)]">
        <div className="absolute inset-x-8 top-8 h-16 rounded-md bg-white/[0.04]" />
        <div className="absolute inset-x-12 top-[4.5rem] h-6 rounded-sm bg-white/[0.03]" />
        <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10">
          <div className="h-full w-2/5 bg-[#ff8a3d]" />
        </div>
        <div className="absolute right-3 top-3">
          <Hit>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-[rgba(9,9,11,0.78)] px-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <AnidachiLogo size={18} aria-hidden />
              <span className="h-1.5 w-1.5 rounded-full bg-[#7dd3a7]" />
              <span className="text-[11px] font-semibold text-white/90">1</span>
            </span>
          </Hit>
        </div>
      </div>
    </OverlayPanel>
  );
}

export function OverlayCreateRoomMock() {
  return (
    <div className="space-y-3">
      <OverlayPanel>
        <div className="border-b border-white/[0.07] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#ff8a3d]/40 to-white/10 text-[11px] font-bold text-[#fff4ea]">
              YO
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90">You</p>
              <p className="text-[10px] font-medium text-white/45">
                Create rooms and invite friends
              </p>
            </div>
          </div>
        </div>
        <div className="px-3 py-3">
          <Hit className="w-full" padded>
            <span className="flex h-9 w-full items-center justify-center rounded-full bg-gradient-to-br from-[#ffb15f] to-[#f97316] text-[12px] font-bold text-[#1c1109]">
              Create room
            </span>
          </Hit>
        </div>
      </OverlayPanel>
      <OverlayPanel>
        <div className="flex items-center gap-1.5 px-3 py-3">
          <span className="inline-flex h-9 shrink-0 items-center rounded-full border border-red-400/25 bg-[#332325]/90 px-3 text-[11px] font-semibold text-white/85">
            Leave room
          </span>
          <Hit>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white/85">
              <Copy className="h-3.5 w-3.5" />
            </span>
          </Hit>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/40">
            <UserPlus className="h-3.5 w-3.5" />
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/40">
            <RefreshCw className="h-3.5 w-3.5" />
          </span>
        </div>
      </OverlayPanel>
    </div>
  );
}

export function OverlayInviteMock() {
  return (
    <div className="space-y-3">
      <OverlayPanel>
        <div className="flex items-center gap-1.5 px-3 py-3">
          <span className="inline-flex h-9 shrink-0 items-center rounded-full border border-red-400/25 bg-[#332325]/90 px-3 text-[11px] font-semibold text-white/85">
            Leave room
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/40">
            <Copy className="h-3.5 w-3.5" />
          </span>
          <Hit>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white/85">
              <UserPlus className="h-3.5 w-3.5" />
            </span>
          </Hit>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/40">
            <RefreshCw className="h-3.5 w-3.5" />
          </span>
        </div>
      </OverlayPanel>
      <OverlayPanel>
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white/90">
              Friends & groups
            </p>
            <p className="text-[10px] text-white/45">2 available</p>
          </div>
          <span className="grid h-7 w-7 place-items-center rounded-full text-white/40">
            <RefreshCw className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#5c3a28] text-[11px] font-bold text-[#fff4ea]">
              NA
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white/90">
                Natsuki
              </p>
              <p className="text-[10px] text-white/45">Friend</p>
            </div>
            <Hit>
              <span className="inline-flex h-7 items-center rounded-full border border-white/15 bg-white/[0.06] px-2.5 text-[10px] font-semibold text-white/90">
                Invite
              </span>
            </Hit>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-white/80">
              WK
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white/90">
                Weekend watch
              </p>
              <p className="text-[10px] text-white/45">Group · 4</p>
            </div>
            <span className="inline-flex h-7 items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[10px] font-semibold text-white/45">
              Invite
            </span>
          </div>
        </div>
      </OverlayPanel>
    </div>
  );
}

export function OverlaySeatsMock() {
  return (
    <OverlayPanel>
      <div className="flex items-start justify-between gap-3 px-3 pt-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55">
            <UsersRound className="h-3.5 w-3.5" strokeWidth={1.8} />
            People
          </p>
          <p className="mt-1 text-[10px] text-white/40">
            1/6 media seats · 0/4 cameras
          </p>
        </div>
        <p className="shrink-0 text-[10px] text-white/40">1/6 in room</p>
      </div>
      <div className="mt-2 space-y-2 px-3 pb-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#5c3a28] text-[11px] font-bold text-[#fff4ea]">
            HT
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white/90">
              <span className="truncate">Heorhi Talochka</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#ffad63]">
                Host
              </span>
            </p>
            <p className="text-[10px] text-white/50">Media seat</p>
          </div>
          <MediaSeatButton active hit />
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-white/80">
            HA
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white/90">
              Haruto
            </p>
            <p className="text-[10px] text-white/45">Chat only</p>
          </div>
          <MediaSeatButton active={false} hit />
        </div>
      </div>
    </OverlayPanel>
  );
}

export function OverlayReactionsMock() {
  return (
    <SettingsShell active="Reactions">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/90">
          Quick reactions
          <CircleHelp className="h-3.5 w-3.5 text-white/40" strokeWidth={1.8} />
        </span>
        <Hit>
          <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-[#f97316]">
            <span className="absolute right-0.5 h-3 w-3 rounded-full bg-[#fff4ea]" />
          </span>
        </Hit>
      </div>
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
        {REACTION_SLOTS.map(([key, emoji]) => (
          <span
            key={key}
            className="flex flex-col items-center gap-0.5 py-1"
          >
            <span className="text-[9px] font-semibold text-white/40">{key}</span>
            <span className="text-base leading-none">{emoji}</span>
          </span>
        ))}
      </div>
    </SettingsShell>
  );
}

export function OverlayLayoutMock() {
  return (
    <SettingsShell active="Layout">
      <OverlayLayoutShowcase />
    </SettingsShell>
  );
}

export function OverlayVoiceMock() {
  return (
    <SettingsShell active="Voice">
      <p className="mb-2 text-[10px] font-medium text-white/45">
        Microphone mode
      </p>
      <Segmented
        options={["Push to talk", "Open mic"]}
        selected="Push to talk"
        hit="Push to talk"
      />
      <div className="mt-3 flex items-center gap-2 text-[11px] text-white/55">
        Hold
        <Hit pill={false}>
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] px-2 font-mono text-xs font-semibold text-white">
            V
          </span>
        </Hit>
        to speak
      </div>
    </SettingsShell>
  );
}

export function OverlayInterfaceMock() {
  return (
    <SettingsShell active="Interface">
      <OverlayInterfaceShowcase />
    </SettingsShell>
  );
}

export function OverlayRoomMock() {
  return (
    <SettingsShell active="Room">
      <p className="text-[13px] font-semibold text-white/90">Room defaults</p>
      <p className="mt-0.5 text-[10px] text-white/45">
        Starting setup for every room.
      </p>
      <p className="mb-1.5 mt-3 text-[10px] font-medium text-white/45">
        Microphone
      </p>
      <Segmented
        compact
        options={["Last used", "Push to talk", "Open mic"]}
        selected="Push to talk"
        hit="Push to talk"
      />
      <p className="mb-1.5 mt-3 text-[10px] font-medium text-white/45">Camera</p>
      <Segmented
        compact
        options={["Last used", "Off", "On"]}
        selected="Last used"
        hit="Last used"
      />
    </SettingsShell>
  );
}
