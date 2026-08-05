import { describe, expect, it } from "vitest";
import {
  getDefaultInterfacePreferences,
  parseInterfacePreferences,
  updateInterfacePreferences,
} from "../src/interface-preferences";

describe("interface preferences", () => {
  it("uses the existing behavior as the default", () => {
    expect(getDefaultInterfacePreferences()).toEqual({
      version: 1,
      mainControlVisibility: "auto-hide",
      participantPillVisibility: "smart",
    });
  });

  it("preserves a complete valid payload", () => {
    expect(
      parseInterfacePreferences({
        version: 1,
        mainControlVisibility: "always-visible",
        participantPillVisibility: "always-visible",
      }),
    ).toEqual({
      version: 1,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "always-visible",
    });
  });

  it.each([
    {
      expected: {
        version: 1,
        mainControlVisibility: "auto-hide",
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
      mainControlVisibility: "auto-hide",
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
