import { EMOJI_PALETTE } from "./constants";

export type HotkeyAction =
  | { type: "fire-start" }
  | { type: "fire-stop" }
  | { type: "voice-start" }
  | { type: "voice-stop" }
  | { type: "reaction"; emoji: string };

export interface HotkeyState {
  roomActive: boolean;
  panelOpen: boolean;
  reactionsEnabled: boolean;
  experimentalSuperReactionsEnabled?: boolean;
}

export type HotkeyEventLike = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "repeat" | "shiftKey" | "target" | "type"
> & {
  composedPath?: () => EventTarget[];
};

export function getHotkeyAction(event: HotkeyEventLike, state: HotkeyState): HotkeyAction | null {
  if (!state.roomActive || hasBlockedModifier(event) || isEditableEventTarget(event)) {
    return null;
  }

  if (!event.shiftKey && isVoiceKey(event)) {
    if (event.type === "keydown" && !event.repeat) {
      return { type: "voice-start" };
    }

    if (event.type === "keyup") {
      return { type: "voice-stop" };
    }
  }

  if (state.reactionsEnabled) {
    const emoji = getEmojiHotkey(event);
    if (emoji === "🔥") {
      if (!state.experimentalSuperReactionsEnabled) {
        return event.type === "keydown" ? { type: "reaction", emoji } : null;
      }

      if (event.type === "keydown" && !event.repeat) {
        return { type: "fire-start" };
      }

      if (event.type === "keyup") {
        return { type: "fire-stop" };
      }
    }

    if (event.type === "keydown" && emoji) {
      return { type: "reaction", emoji };
    }
  }

  return null;
}

function hasBlockedModifier(event: HotkeyEventLike): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

function isVoiceKey(event: HotkeyEventLike): boolean {
  return event.code === "KeyV" || event.key.toLowerCase() === "v";
}

function getEmojiHotkey(event: HotkeyEventLike): string | null {
  if (event.repeat) {
    return null;
  }

  const digitMatch = event.code.match(/^Digit([1-6])$/) ?? event.code.match(/^Numpad([1-6])$/);
  const index = digitMatch ? Number(digitMatch[1]) - 1 : Number.NaN;
  return Number.isInteger(index) ? (EMOJI_PALETTE[index] ?? null) : null;
}

function isEditableEventTarget(event: HotkeyEventLike): boolean {
  const path = event.composedPath?.() ?? [event.target].filter(Boolean);
  return path.some((target) => target instanceof HTMLElement && isEditableElement(target));
}

function isEditableElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable ||
    element.getAttribute("role") === "textbox"
  );
}
