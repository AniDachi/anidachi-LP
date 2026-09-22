"use client";

import type { ReactNode } from "react";
import {
  OverlayBubbleMock,
  OverlayCreateRoomMock,
  OverlayInterfaceMock,
  OverlayInviteMock,
  OverlayLayoutMock,
  OverlayMessageMock,
  OverlayReactionsMock,
  OverlayRoomMock,
  OverlaySeatsMock,
  OverlayVoiceMock,
} from "@/components/overlay-using-mocks";
import { WatchPlatformLinks } from "@/components/watch-platform-links";
import {
  EXTENSION_USING_HASH,
  extensionUsingStepAnchor,
} from "@/lib/extension-using-guide";

export function InstallStep({
  n,
  title,
  children,
  heading = "h2",
}: {
  n: number;
  title: string;
  children?: ReactNode;
  heading?: "h2" | "h3";
}) {
  const Heading = heading;
  return (
    <li
      id={extensionUsingStepAnchor(title)}
      className="scroll-mt-24 grid grid-cols-[auto_1fr] items-start gap-4"
    >
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-ani-line bg-ani-hover font-mono text-sm font-semibold text-ani-text">
        {n}
      </span>
      <div className="min-w-0">
        <Heading className="text-base font-semibold tracking-[-0.02em] text-ani-text">
          {title}
        </Heading>
        {children}
      </div>
    </li>
  );
}

export function OverlayUsingGuide({ compact = false }: { compact?: boolean }) {
  const stepHeading = compact ? "h3" : "h2";
  return (
    <section
      id={EXTENSION_USING_HASH}
      className={compact ? "help-using" : "scroll-mt-24 pt-12"}
    >
      <h2
        className={
          compact
            ? "text-balance text-2xl font-semibold tracking-[-0.03em] text-ani-text"
            : "text-balance text-4xl font-semibold tracking-[-0.035em] text-ani-text md:text-[2.75rem] md:leading-[1.08]"
        }
      >
        How to Watch Together
      </h2>
      <p className="mt-3 text-sm text-ani-muted">
        Open a Crunchyroll title or a full YouTube watch page, then try the
        player controls below. Changes stay in these examples.
      </p>
      {compact ? <WatchPlatformLinks className="mt-4 flex flex-wrap gap-2" /> : null}
      <ol className="mt-6 space-y-8">
        <InstallStep heading={stepHeading} n={1} title="Open the bubble">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            On a Crunchyroll title or a full YouTube watch page, look at the{" "}
            <span className="text-ani-text">top-right of the player</span>. Click
            the AniDachi bubble — logo, green dot, and a number.
          </p>
          <div className="mt-3">
            <OverlayBubbleMock />
          </div>
        </InstallStep>
        <InstallStep heading={stepHeading} n={2} title="Create a room">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            AniDachi detects the title. Click{" "}
            <span className="text-ani-text">Create room</span> — the orange
            button under your name. After the room starts, click the{" "}
            <span className="text-ani-text">copy</span> icon next to End room
            and send that invite. Friends open it on their own player.
          </p>
          <div className="mt-3">
            <OverlayCreateRoomMock />
          </div>
        </InstallStep>
        <InstallStep heading={stepHeading} n={3} title="Invite a friend">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Next to End room, click the{" "}
            <span className="text-ani-text">person-plus</span> icon.{" "}
            <span className="text-ani-text">Friends & groups</span> opens —
            tap <span className="text-ani-text">Invite</span> on a friend or a
            group. Copy invite still works for one-off links.
          </p>
          <div className="mt-3">
            <OverlayInviteMock />
          </div>
        </InstallStep>
        <InstallStep heading={stepHeading} n={4} title="Media seats">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            In <span className="text-ani-text">People</span>, hosts tap the
            round <span className="text-ani-text">radio</span> button on a
            person. <span className="text-ani-text">White</span> means they have
            a media seat for microphone and camera access. Grey means listening
            and chat only. Tap to give or take a seat. Up to four cameras
            can be on at once.
          </p>
          <div className="mt-3">
            <OverlaySeatsMock />
          </div>
        </InstallStep>
        <InstallStep heading={stepHeading} n={5} title="Reactions">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Reactions</span>.
            Turn <span className="text-ani-text">Quick reactions</span> on.
            Keys <span className="text-ani-text">1–0</span> each map to an
            emoji — click a slot to change it. In a room, press that number to
            send it.
          </p>
          <div className="mt-3">
            <OverlayReactionsMock />
          </div>
        </InstallStep>
        <InstallStep heading={stepHeading} n={6} title="Send a message">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            While watching in a room, press <kbd className="font-semibold text-ani-text">Enter</kbd>{" "}
            to open the message field. Type your message, then press{" "}
            <kbd className="font-semibold text-ani-text">Enter</kbd> again to send it.
          </p>
          <div className="mt-3"><OverlayMessageMock /></div>
        </InstallStep>
        <InstallStep heading={stepHeading} n={7} title="Layout">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Layout</span>.
            Drag cameras or chat in the preview to reposition them. Under{" "}
            <span className="text-ani-text">Video</span>, enlarge{" "}
            <span className="text-ani-text">Camera size</span>, then{" "}
            <span className="text-ani-text">Apply</span>.
          </p>
          <div className="mt-3">
            <OverlayLayoutMock />
          </div>
        </InstallStep>
        <InstallStep heading={stepHeading} n={8} title="Voice">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Voice</span>. Leave{" "}
            <span className="text-ani-text">Push to talk</span> selected on the
            left. Hold <span className="text-ani-text">V</span> to speak. Use
            Open mic only if you want the mic live without holding a key.
          </p>
          <div className="mt-3">
            <OverlayVoiceMock />
          </div>
        </InstallStep>
        <InstallStep heading={stepHeading} n={9} title="Interface">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Interface</span>.{" "}
            Both controls are visible by default. Choose{" "}
            <span className="text-ani-text">Auto hide</span> to reveal the main
            control near the player edge, or <span className="text-ani-text">Smart</span>{" "}
            for participant pills that appear when someone speaks or you hover
            the edge. Try the options below the preview.
          </p>
          <div className="mt-3">
            <OverlayInterfaceMock />
          </div>
        </InstallStep>
        <InstallStep heading={stepHeading} n={10} title="Room">
          <p className="mt-1 text-sm leading-relaxed text-ani-muted">
            Open Settings → <span className="text-ani-text">Room</span>.{" "}
            <span className="text-ani-text">Room defaults</span> are your
            starting mic and camera for every room. Microphone: Last used, Push
            to talk, or Open mic. Camera: Last used, Off, or On.
          </p>
          <div className="mt-3">
            <OverlayRoomMock />
          </div>
        </InstallStep>
      </ol>
    </section>
  );
}
