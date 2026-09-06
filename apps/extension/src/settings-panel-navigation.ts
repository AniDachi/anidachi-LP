export type SettingsPanelCategory =
  | "reactions"
  | "layout"
  | "interface"
  | "voice"
  | "room"
  | "debug";

export const DEFAULT_SETTINGS_PANEL_CATEGORY: SettingsPanelCategory = "reactions";

export const SETTINGS_PANEL_CATEGORIES: ReadonlyArray<{
  id: SettingsPanelCategory;
  label: string;
}> = [
  { id: "reactions", label: "Reactions" },
  { id: "layout", label: "Layout" },
  { id: "interface", label: "Interface" },
  { id: "voice", label: "Voice" },
  { id: "room", label: "Room" },
];
