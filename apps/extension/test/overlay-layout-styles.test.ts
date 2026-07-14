import { describe, expect, it } from "vitest";
import { overlayStyles } from "../src/styles";

describe("overlay layout pointer surfaces", () => {
  it("keeps the top bubble and rendered cameras interactive without blocking empty slots", () => {
    expect(getRule(".top-bubble")).toContain("pointer-events: auto");
    expect(getRule(".cam-stack")).toContain("pointer-events: none");
    expect(getRule(".cam-bubble")).toContain("pointer-events: auto");
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
