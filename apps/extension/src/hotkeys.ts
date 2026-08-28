import type { VoiceMode } from "./media-types";
import {
  DEFAULT_REACTION_SHORTCUTS,
  reactionShortcutIndexFromCode,
} from "./reaction-shortcuts";

export type HotkeyAction =
  | { type: "fire-start" }
  | { type: "fire-stop" }
  | { type: "message-composer-open" }
  | { type: "voice-start" }
  | { type: "voice-stop" }
  | { type: "reaction"; emoji: string };

export interface HotkeyState {
  roomActive: boolean;
  panelOpen: boolean;
  reactionsEnabled: boolean;
  reactionShortcuts?: readonly string[];
  experimentalSuperReactionsEnabled?: boolean;
  voiceMode: VoiceMode;
}

export type HotkeyEventLike = Pick<
  KeyboardEvent,
  | "altKey"
  | "code"
  | "ctrlKey"
  | "isComposing"
  | "key"
  | "metaKey"
  | "repeat"
  | "shiftKey"
  | "target"
  | "type"
> & {
  composedPath?: () => EventTarget[];
};

export function getHotkeyAction(event: HotkeyEventLike, state: HotkeyState): HotkeyAction | null {
  if (!state.roomActive || hasBlockedModifier(event) || isEditableEventTarget(event)) {
    return null;
  }

  if (isMessageComposerOpenKey(event)) {
    return { type: "message-composer-open" };
  }

  if (state.voiceMode === "push-to-talk" && !event.shiftKey && isVoiceKey(event)) {
    if (event.type === "keydown" && !event.repeat) {
      return { type: "voice-start" };
    }

    if (event.type === "keyup") {
      return { type: "voice-stop" };
    }
  }

  if (state.reactionsEnabled) {
    const emoji = getEmojiHotkey(event, state.reactionShortcuts);
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

export function shouldCaptureReactionShortcutEvent(
  event: HotkeyEventLike,
  state: HotkeyState,
): boolean {
  return (
    state.roomActive &&
    state.reactionsEnabled &&
    !hasBlockedModifier(event) &&
    !isEditableEventTarget(event) &&
    reactionShortcutIndexFromCode(event.code) !== null
  );
}

export function shouldStopVoiceTalkOnWindowBlur(voiceMode: VoiceMode): boolean {
  return voiceMode === "push-to-talk";
}

export function isPushToTalkReleaseEvent(
  event: Pick<HotkeyEventLike, "code" | "key" | "type">,
  state: {
    held: boolean;
    voiceMode: VoiceMode;
  },
): boolean {
  return (
    state.held && state.voiceMode === "push-to-talk" && event.type === "keyup" && isVoiceKey(event)
  );
}

function hasBlockedModifier(event: HotkeyEventLike): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

function isVoiceKey(event: Pick<HotkeyEventLike, "code" | "key">): boolean {
  return event.code === "KeyV" || event.key.toLowerCase() === "v";
}

function isMessageComposerOpenKey(event: HotkeyEventLike): boolean {
  return (
    event.type === "keydown" &&
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.repeat &&
    !event.isComposing
  );
}

function getEmojiHotkey(
  event: HotkeyEventLike,
  reactionShortcuts: readonly string[] = DEFAULT_REACTION_SHORTCUTS,
): string | null {
  if (event.repeat) {
    return null;
  }

  const index = reactionShortcutIndexFromCode(event.code);
  if (index === null) {
    return null;
  }

  return reactionShortcuts[index] ?? DEFAULT_REACTION_SHORTCUTS[index] ?? null;
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
