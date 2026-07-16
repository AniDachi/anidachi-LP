import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_PANEL_CATEGORY,
  SETTINGS_PANEL_CATEGORIES,
} from "../src/settings-panel-navigation";

describe("settings panel navigation", () => {
  it("places reactions first and layout second", () => {
    expect(SETTINGS_PANEL_CATEGORIES.map((category) => category.id)).toEqual([
      "reactions",
      "layout",
      "voice",
      "debug",
    ]);
  });

  it("opens settings on reactions by default", () => {
    expect(DEFAULT_SETTINGS_PANEL_CATEGORY).toBe("reactions");
  });
});
