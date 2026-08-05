import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_PANEL_CATEGORY,
  SETTINGS_PANEL_CATEGORIES,
} from "../src/settings-panel-navigation";

describe("settings panel navigation", () => {
  it("places interface controls between layout and voice", () => {
    expect(SETTINGS_PANEL_CATEGORIES.map((category) => category.id)).toEqual([
      "reactions",
      "layout",
      "interface",
      "voice",
      "debug",
    ]);
  });

  it("opens settings on reactions by default", () => {
    expect(DEFAULT_SETTINGS_PANEL_CATEGORY).toBe("reactions");
  });
});
