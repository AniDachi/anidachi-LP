import { describe, expect, it } from "vitest";
import { overlayStyles } from "../src/styles";

describe("overlay layout pointer surfaces", () => {
  it("keeps the top bubble and rendered cameras interactive without blocking empty slots", () => {
    expect(getRule(".top-bubble")).toContain("pointer-events: auto");
    expect(getRule(".cam-stack")).toContain("pointer-events: none");
    expect(getRule(".cam-bubble")).toContain("pointer-events: auto");
  });

  it("keeps live objects below the panel and editor ghosts pointer-transparent above it", () => {
    expect(getNumericProperty(".cam-stack", "z-index")).toBeLessThan(
      getNumericProperty(".mini-panel", "z-index"),
    );
    expect(getNumericProperty(".live-chat-column", "z-index")).toBeLessThan(
      getNumericProperty(".mini-panel", "z-index"),
    );
    expect(getNumericProperty(".overlay-layout-ghost-preview", "z-index")).toBeGreaterThan(
      getNumericProperty(".mini-panel", "z-index"),
    );
    expect(getRule(".overlay-layout-ghost-preview")).toContain("pointer-events: none");
  });
});

function getRule(selector: string): string {
  const start = overlayStyles.indexOf(`${selector} {`);
  if (start < 0) {
    throw new Error(`Missing CSS rule: ${selector}`);
  }
  const end = overlayStyles.indexOf("}", start);
  if (end < 0) {
    throw new Error(`Unterminated CSS rule: ${selector}`);
  }
  return overlayStyles.slice(start, end + 1);
}

function getNumericProperty(selector: string, property: string): number {
  const rule = getRule(selector);
  const match = rule.match(new RegExp(`${property}:\\s*(\\d+)`));
  if (!match?.[1]) {
    throw new Error(`Missing ${property} in ${selector}`);
  }
  return Number(match[1]);
}
