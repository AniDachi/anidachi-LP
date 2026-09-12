import { ANIDACHI_EMOJI_CATALOG } from "./emoji-catalog";

export const REACTION_SHORTCUTS_STORAGE_KEY =
	"local:reactionShortcutsV1" as const;
export const REACTIONS_ENABLED_STORAGE_KEY =
	"local:reactionsEnabledV1" as const;
export const REACTION_SHORTCUTS_VERSION = 1 as const;

export const REACTION_SHORTCUT_KEYS = [
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
] as const;

export const DEFAULT_REACTION_SHORTCUTS = [
	"😂",
	"😱",
	"❤️",
	"🔥",
	"😭",
	"👀",
	"👏",
	"🤯",
	"😮‍💨",
	"💯",
] as const;

export const REACTION_EMOJI_CATALOG = ANIDACHI_EMOJI_CATALOG;

export interface ReactionShortcutPreferencesV1 {
	version: typeof REACTION_SHORTCUTS_VERSION;
	emojis: readonly string[];
}

export function getDefaultReactionShortcutPreferences(): ReactionShortcutPreferencesV1 {
	return {
		version: REACTION_SHORTCUTS_VERSION,
		emojis: [...DEFAULT_REACTION_SHORTCUTS],
	};
}

export function parseReactionShortcutPreferences(
	value: unknown,
): ReactionShortcutPreferencesV1 {
	const defaults = getDefaultReactionShortcutPreferences();
	if (
		!isRecord(value) ||
		value.version !== REACTION_SHORTCUTS_VERSION ||
		!Array.isArray(value.emojis)
	) {
		return defaults;
	}
	const storedEmojis = value.emojis;

	return {
		version: REACTION_SHORTCUTS_VERSION,
		emojis: DEFAULT_REACTION_SHORTCUTS.map((fallback, index) => {
			const candidate = storedEmojis[index];
			return typeof candidate === "string" && isReactionEmoji(candidate)
				? candidate
				: fallback;
		}),
	};
}

export function assignReactionShortcut(
	current: ReactionShortcutPreferencesV1,
	index: number,
	emoji: string,
): ReactionShortcutPreferencesV1 {
	if (
		!Number.isInteger(index) ||
		index < 0 ||
		index >= REACTION_SHORTCUT_KEYS.length ||
		!isReactionEmoji(emoji)
	) {
		return current;
	}

	if (current.emojis[index] === emoji) {
		return current;
	}

	const emojis = [...current.emojis];
	emojis[index] = emoji;
	return {
		version: REACTION_SHORTCUTS_VERSION,
		emojis,
	};
}

export function reactionShortcutIndexFromCode(code: string): number | null {
	const match = code.match(/^Digit([0-9])$/) ?? code.match(/^Numpad([0-9])$/);
	if (!match) {
		return null;
	}

	const digit = Number(match[1]);
	return digit === 0 ? 9 : digit - 1;
}

export function parseReactionsEnabled(value: unknown): boolean {
	return typeof value === "boolean" ? value : true;
}

function isReactionEmoji(value: string): boolean {
	return (REACTION_EMOJI_CATALOG as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
