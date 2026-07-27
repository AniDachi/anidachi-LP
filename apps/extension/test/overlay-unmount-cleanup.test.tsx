import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOverlayUnmountCleanup } from "../src/overlay-unmount-cleanup";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function CleanupHarness({
  stopMicrophonePublication,
  stopVoiceCapture,
}: {
  stopMicrophonePublication: () => void;
  stopVoiceCapture: (send?: boolean) => void;
}) {
  useOverlayUnmountCleanup({
    stopMicrophonePublication,
    stopVoiceCapture,
  });
  return null;
}

describe("overlay unmount cleanup", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("does not stop microphone publication when unrelated callback identities change", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    const stopMicrophonePublication = vi.fn();
    const firstStopVoiceCapture = vi.fn();
    const latestStopVoiceCapture = vi.fn();

    await act(async () => {
      root.render(
        <CleanupHarness
          stopMicrophonePublication={stopMicrophonePublication}
          stopVoiceCapture={firstStopVoiceCapture}
        />,
      );
    });

    await act(async () => {
      root.render(
        <CleanupHarness
          stopMicrophonePublication={stopMicrophonePublication}
          stopVoiceCapture={latestStopVoiceCapture}
        />,
      );
    });

    expect(stopMicrophonePublication).not.toHaveBeenCalled();
    expect(firstStopVoiceCapture).not.toHaveBeenCalled();
    expect(latestStopVoiceCapture).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    expect(stopMicrophonePublication).toHaveBeenCalledTimes(1);
    expect(firstStopVoiceCapture).not.toHaveBeenCalled();
    expect(latestStopVoiceCapture).toHaveBeenCalledWith(false);
  });
});
