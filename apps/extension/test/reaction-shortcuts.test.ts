import { describe, expect, it } from "vitest";
import {
	assignReactionShortcut,
	DEFAULT_REACTION_SHORTCUTS,
	getDefaultReactionShortcutPreferences,
	parseReactionShortcutPreferences,
	parseReactionsEnabled,
	REACTION_EMOJI_CATALOG,
	REACTIONS_ENABLED_STORAGE_KEY,
	REACTION_SHORTCUT_KEYS,
} from "../src/reaction-shortcuts";

describe("reaction shortcut preferences", () => {
	it("defines one default reaction for every 1-9 and 0 shortcut", () => {
		expect(REACTION_SHORTCUT_KEYS).toEqual([
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
			"0",
		]);
		expect(DEFAULT_REACTION_SHORTCUTS).toHaveLength(10);
		expect(getDefaultReactionShortcutPreferences()).toEqual({
			version: 1,
			emojis: DEFAULT_REACTION_SHORTCUTS,
		});
	});

	it("keeps valid stored assignments and repairs invalid slots independently", () => {
		expect(
			parseReactionShortcutPreferences({
				version: 1,
				emojis: ["🥳", "", "👀", "not-an-emoji", "😭", "🔥", "👏"],
			}),
		).toEqual({
			version: 1,
			emojis: [
				"🥳",
				DEFAULT_REACTION_SHORTCUTS[1],
				"👀",
				DEFAULT_REACTION_SHORTCUTS[3],
				"😭",
				"🔥",
				"👏",
				DEFAULT_REACTION_SHORTCUTS[7],
				DEFAULT_REACTION_SHORTCUTS[8],
				DEFAULT_REACTION_SHORTCUTS[9],
			],
		});
	});

	it("falls back to defaults for unknown preference versions", () => {
		expect(
			parseReactionShortcutPreferences({
				version: 2,
				emojis: Array.from({ length: 10 }, () => "🥳"),
			}),
		).toEqual(getDefaultReactionShortcutPreferences());
	});

	it("assigns only catalog emoji without mutating the previous preferences", () => {
		const current = getDefaultReactionShortcutPreferences();
		const updated = assignReactionShortcut(current, 9, "🥳");

		expect(updated.emojis[9]).toBe("🥳");
		expect(current.emojis[9]).toBe(DEFAULT_REACTION_SHORTCUTS[9]);
		expect(assignReactionShortcut(updated, 9, "not-an-emoji")).toBe(updated);
		expect(assignReactionShortcut(updated, 10, "😂")).toBe(updated);
	});

	it("accepts diverse entertainment, food, animal, and symbol emoji as quick reactions", () => {
		for (const emoji of ["🎬", "🎮", "🍕", "🐉", "🚀", "🏆"]) {
			const current = getDefaultReactionShortcutPreferences();
			const updated = assignReactionShortcut(current, 0, emoji);

			expect(updated.emojis[0]).toBe(emoji);
		}
	});

	it("ships a compact unique catalog that contains every default", () => {
		expect(REACTION_EMOJI_CATALOG.length).toBeGreaterThanOrEqual(80);
		expect(new Set(REACTION_EMOJI_CATALOG).size).toBe(
			REACTION_EMOJI_CATALOG.length,
		);
		expect(
			DEFAULT_REACTION_SHORTCUTS.every((emoji) =>
				REACTION_EMOJI_CATALOG.includes(emoji),
			),
		).toBe(true);
	});

	it("keeps the quick-reactions switch as a durable boolean preference", () => {
		expect(REACTIONS_ENABLED_STORAGE_KEY).toBe("local:reactionsEnabledV1");
		expect(parseReactionsEnabled(false)).toBe(false);
		expect(parseReactionsEnabled(true)).toBe(true);
		expect(parseReactionsEnabled(null)).toBe(true);
		expect(parseReactionsEnabled("false")).toBe(true);
	});
});
