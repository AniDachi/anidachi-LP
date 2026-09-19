"use client";

import { useState } from "react";
import { ChromeExtensionRoomDemo } from "@/components/chrome-extension-room-demo";
import { ChromeExtensionHistoryDemo } from "@/components/chrome-extension-history-demo";
import { ChromeExtensionAsyncDemo } from "@/components/chrome-extension-async-demo";
import roomDemoStyles from "./chrome-extension-room-demo.module.css";
import { trackEvent } from "@/lib/gtag";

type DemoMode = "live" | "history" | "async";

function DemoModeToggle({
  mode,
  onChange,
}: {
  mode: DemoMode;
  onChange: (mode: DemoMode) => void;
}) {
  const options: { id: DemoMode; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "history", label: "History" },
    { id: "async", label: "Async" },
  ];

  return (
    <div className={roomDemoStyles.modeSwitcher}>
      <div className={roomDemoStyles.modeTrack} role="tablist" aria-label="Demo mode">
        {options.map((option) => {
          const selected = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={roomDemoStyles.modeOption}
              onClick={() => {
                if (option.id !== mode) {
                  onChange(option.id);
                  trackEvent("demo_mode_selected", {
                    mode: option.id,
                    placement: "see_it_in_action",
                  });
                }
              }}
            >
              <span className={roomDemoStyles.modeLabel}>
                {option.label}
                {option.id === "async" && <span className={roomDemoStyles.upcomingDot} aria-hidden="true" />}
              </span>
              {option.id === "async" && (
                <span className="sr-only"> Coming soon</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ChromeExtensionDemo() {
  const [mode, setMode] = useState<DemoMode>("live");

  return (
    <section
      id="demo"
      className="scroll-mt-20 overflow-hidden bg-ani-canvas pb-16 pt-2 text-ani-text md:pt-4 lg:pb-20"
    >
      <div className="container mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        {mode === "live" ? (
          <ChromeExtensionRoomDemo
            title="See it in action"
            controls={<DemoModeToggle mode={mode} onChange={setMode} />}
          />
        ) : mode === "history" ? (
          <ChromeExtensionHistoryDemo controls={<DemoModeToggle mode={mode} onChange={setMode} />} />
        ) : (
          <ChromeExtensionAsyncDemo controls={<DemoModeToggle mode={mode} onChange={setMode} />} />
        )}
      </div>
    </section>
  );
}
