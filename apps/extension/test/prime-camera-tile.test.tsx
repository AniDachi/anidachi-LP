// @vitest-environment happy-dom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {expect,it,vi} from "vitest";
import {PrimeCameraTile} from "../src/prime-media-session";
import {mediaAccessChannel} from "../src/prime-media-access";

it("keeps a blank frame hidden and authorizes only the current extension frame", async () => {
  const origin = "chrome-extension://test";
  const send = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("ticket");
  vi.stubGlobal("chrome", {runtime: {getURL: (path: string) => origin + "/" + path, sendMessage: send}});
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<PrimeCameraTile participantId="guest" fallback="VG" />));
    const frame = host.querySelector("iframe")!;
    const target = {postMessage: vi.fn()};
    Object.defineProperty(frame, "contentWindow", {configurable: true, value: target});
    const notify = (action: string, sender = origin) => act(async () => {
      const event = new MessageEvent("message", {
        source: target as unknown as Window, origin: sender, data: {channel: mediaAccessChannel, action},
      });
      Object.defineProperty(event, "isTrusted", {value: true});
      window.dispatchEvent(event);
    });
    await act(async () => { frame.dispatchEvent(new Event("load")); });
    expect(frame.hasAttribute("data-prime-camera-playing")).toBe(false);
    expect(host.textContent).toContain("VG");
    await notify("request", "https://www.primevideo.com");
    await notify("playing", "https://www.primevideo.com");
    expect(send).not.toHaveBeenCalled();
    expect(frame.hasAttribute("data-prime-camera-playing")).toBe(false);
    await notify("request");
    expect(target.postMessage).not.toHaveBeenCalled();
    await notify("request");
    expect(target.postMessage).toHaveBeenCalledWith({channel: mediaAccessChannel, ticket: "ticket"}, origin);
    await notify("playing");
    expect(frame.hasAttribute("data-prime-camera-playing")).toBe(true);
    await act(async () => { frame.dispatchEvent(new Event("load")); });
    expect(frame.hasAttribute("data-prime-camera-playing")).toBe(false);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
