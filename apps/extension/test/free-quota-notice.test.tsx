import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { WEB_HTTP_BASE } from "../src/constants";
import { FreeQuotaNotice } from "../src/free-quota-notice";

describe("Free quota notice", () => {
  it("links to pricing when free time is exhausted", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<FreeQuotaNotice
      state={{ ownerUserId: "user-a", kind: "exhausted", remainingSeconds: 3600 }}
      onRetry={() => {}}
    />);
    const link = host.querySelector("a");
    expect(link?.textContent).toBe("View plans");
    expect(link?.href).toBe(new URL("/pricing", WEB_HTTP_BASE).href);
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toContain("noopener");
  });

  it("lets an exhausted host retry a failed compact limit check without losing the join hint", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const host = document.createElement("div"), root = createRoot(host), retry = vi.fn();
    try {
      await act(async () => root.render(<FreeQuotaNotice compact
        state={{ ownerUserId: "user-a", kind: "unavailable", remainingSeconds: null }} onRetry={retry} />));
      expect(host.textContent).toContain("Free time unavailable");
      expect(host.textContent).not.toContain("Today's free time is used up");
      expect(host.textContent).toContain("Couldn't check your free time.");
      expect(host.textContent).toContain("You can still join a friend's room.");
      const button = host.querySelector<HTMLButtonElement>(".free-quota-retry");
      expect(button?.textContent).toBe("Retry");
      await act(async () => button!.click());
      expect(retry).toHaveBeenCalledTimes(1);

      await act(async () => root.render(<FreeQuotaNotice compact
        state={{ ownerUserId: "user-a", kind: "checking", remainingSeconds: null }} onRetry={retry} />));
      expect(host.textContent).toContain("Checking your limit");
      expect(host.querySelector(".free-quota-retry")).toBeNull();
    } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
  });
});
