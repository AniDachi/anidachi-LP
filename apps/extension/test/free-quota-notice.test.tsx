import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
});
