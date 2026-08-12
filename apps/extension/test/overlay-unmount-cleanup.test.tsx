import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOverlayUnmountCleanup } from "../src/overlay-unmount-cleanup";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function CleanupHarness({
  stopMicrophonePublication,
}: {
  stopMicrophonePublication: () => void;
}) {
  useOverlayUnmountCleanup({
    stopMicrophonePublication,
  });
  return null;
}

describe("overlay unmount cleanup", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("uses the latest callback and stops microphone publication only on unmount", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    const firstStopMicrophonePublication = vi.fn();
    const latestStopMicrophonePublication = vi.fn();

    await act(async () => {
      root.render(
        <CleanupHarness stopMicrophonePublication={firstStopMicrophonePublication} />,
      );
    });

    await act(async () => {
      root.render(
        <CleanupHarness stopMicrophonePublication={latestStopMicrophonePublication} />,
      );
    });

    expect(firstStopMicrophonePublication).not.toHaveBeenCalled();
    expect(latestStopMicrophonePublication).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    expect(firstStopMicrophonePublication).not.toHaveBeenCalled();
    expect(latestStopMicrophonePublication).toHaveBeenCalledTimes(1);
  });
});
