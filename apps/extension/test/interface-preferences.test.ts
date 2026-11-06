import { describe, expect, it } from "vitest";
import {
  getDefaultInterfacePreferences,
  parseInterfacePreferences,
  updateInterfacePreferences,
} from "../src/interface-preferences";

describe("interface preferences", () => {
  it("keeps the main control visible and participant pills Smart on first install", () => {
    expect(getDefaultInterfacePreferences()).toEqual({
      version: 1,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "smart",
    });
  });

  it.each(["smart", "always-visible"] as const)("preserves saved %s participant pills", (participantPillVisibility) => {
    expect(parseInterfacePreferences({ version: 1, participantPillVisibility }))
      .toEqual({ version: 1, mainControlVisibility: "always-visible", participantPillVisibility });
  });

  it.each(["auto-hide", "always-visible"] as const)("preserves a saved %s choice", (mainControlVisibility) => {
    expect(
      parseInterfacePreferences({
        version: 1,
        mainControlVisibility,
        participantPillVisibility: "smart",
      }),
    ).toEqual({
      version: 1,
      mainControlVisibility,
      participantPillVisibility: "smart",
    });
  });

  it.each([
    {
      expected: {
        version: 1,
        mainControlVisibility: "always-visible",
        participantPillVisibility: "always-visible",
      },
      name: "main control visibility",
      value: {
        version: 1,
        mainControlVisibility: "visible",
        participantPillVisibility: "always-visible",
      },
    },
    {
      expected: {
        version: 1,
        mainControlVisibility: "always-visible",
        participantPillVisibility: "smart",
      },
      name: "participant pill visibility",
      value: {
        version: 1,
        mainControlVisibility: "always-visible",
        participantPillVisibility: "hidden",
      },
    },
  ])("falls back invalid $name independently", ({ expected, value }) => {
    expect(parseInterfacePreferences(value)).toEqual(expected);
  });

  it.each([
    undefined,
    null,
    [],
    "preferences",
    {},
    {
      version: 2,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "always-visible",
    },
  ])("returns defaults for unsupported input %#", (value) => {
    expect(parseInterfacePreferences(value)).toEqual(getDefaultInterfacePreferences());
  });

  it("normalizes patches without mutating the current object", () => {
    const current = getDefaultInterfacePreferences();
    const next = updateInterfacePreferences(current, {
      participantPillVisibility: "always-visible",
    });

    expect(next).toEqual({
      version: 1,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "always-visible",
    });
    expect(next).not.toBe(current);
    expect(current.participantPillVisibility).toBe("smart");
  });

  it("returns independent default objects", () => {
    expect(getDefaultInterfacePreferences()).not.toBe(getDefaultInterfacePreferences());
    expect(parseInterfacePreferences(null)).not.toBe(parseInterfacePreferences(null));
  });
});
