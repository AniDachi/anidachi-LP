import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_PANEL_CATEGORY,
  SETTINGS_PANEL_CATEGORIES,
} from "../src/settings-panel-navigation";

describe("settings panel navigation", () => {
  it("keeps the user-facing settings menu focused on four product sections", () => {
    expect(SETTINGS_PANEL_CATEGORIES.map((category) => category.id)).toEqual([
      "reactions",
      "layout",
      "interface",
      "voice",
    ]);
  });

  it("opens settings on reactions by default", () => {
    expect(DEFAULT_SETTINGS_PANEL_CATEGORY).toBe("reactions");
  });
});
