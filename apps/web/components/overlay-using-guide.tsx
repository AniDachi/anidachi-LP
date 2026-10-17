"use client";

import type { ComponentType, ReactNode } from "react";
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
  OverlayMediaMock,
} from "@/components/overlay-using-mocks";
import { WatchPlatformLinks } from "@/components/watch-platform-links";
import {
  EXTENSION_USING_HASH,
  extensionUsingStepAnchor,
  extensionUsingSteps,
} from "@/lib/extension-using-guide";

import styles from "./extension-install.module.css";

export function InstallStep({
  n,
  title,
  children,
  heading = "h2",
  wide = false,
  example,
}: {
  n: number;
  title: string;
  children?: ReactNode;
  heading?: "h2" | "h3";
  wide?: boolean;
  example?: ReactNode;
}) {
  const Heading = heading;
  if (wide) {
    return (
      <li id={extensionUsingStepAnchor(title)} className={styles.guideStep}>
        <div className={styles.guideCopy}>
          <div className={styles.guideStepHeading}>
            <span className={styles.guideNumber}>{n}</span>
            <Heading>{title}</Heading>
          </div>
          {children}
        </div>
        <div className={styles.guideExample}>{example}</div>
      </li>
    );
  }
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
        {example ? <div className="mt-3">{example}</div> : null}
      </div>
    </li>
  );
}

const examples: Record<(typeof extensionUsingSteps)[number]["name"], ComponentType> = {
  "Open the capsule": OverlayBubbleMock,
  "Create a room": OverlayCreateRoomMock,
  "Invite a friend": OverlayInviteMock,
  "Media seats": OverlaySeatsMock,
  Reactions: OverlayReactionsMock,
  "Send a message": OverlayMessageMock,
  Layout: OverlayLayoutMock,
  "Microphone & camera": OverlayMediaMock,
  Interface: OverlayInterfaceMock,
  Room: OverlayRoomMock,
};

export function OverlayUsingGuide({
  compact = false,
  setup,
}: {
  compact?: boolean;
  setup?: ReactNode;
}) {
  return (
    <section id={EXTENSION_USING_HASH} className={compact ? "help-using" : styles.guide} aria-labelledby="using-title">
      <header className={compact ? "" : styles.guideHeader}>
        <h2 id="using-title" className={compact ? "text-balance text-2xl font-semibold tracking-[-0.03em] text-ani-text" : styles.sectionTitle}>
          {setup ? "Get started with AniDachi" : "How to watch together"}
        </h2>
        {compact ? (
          <>
            <p className="mt-3 text-sm text-ani-muted">
              Meet the controls in your player. Try the examples below.
            </p>
            <WatchPlatformLinks className="mt-4 flex flex-wrap gap-2" />
          </>
        ) : null}
      </header>
      {setup}
      <ol className={compact ? "mt-6 space-y-8" : styles.guideSteps} aria-label="Player controls">
        {extensionUsingSteps.map((step, index) => {
          const Example = examples[step.name];
          return (
            <InstallStep key={step.name} n={index + 1} title={step.name}
              heading="h3" wide={!compact} example={<Example />}>
              {step.name === "Open the capsule" ? <span id="using-open-the-bubble" className="scroll-mt-24" aria-hidden="true" /> : null}
              {step.name === "Microphone & camera" ? <span id="using-voice" className="scroll-mt-24" aria-hidden="true" /> : null}
              <p className={compact ? "mt-1 text-sm leading-relaxed text-ani-muted" : styles.guideDescription}>
                {step.text}
              </p>
            </InstallStep>
          );
        })}
      </ol>
    </section>
  );
}
