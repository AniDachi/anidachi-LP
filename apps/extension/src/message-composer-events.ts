export const ANIDACHI_COMPOSER_OPEN_ATTR = "anidachiComposerOpen";

export const ANIDACHI_MESSAGE_COMPOSER_SHORTCUT_EVENT =
  "anidachi:message-composer-shortcut";

export const ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT = "anidachi:message-composer-submit";

export function isMessageComposerShortcutEvent(event: KeyboardEvent): boolean {
  return (
    event.code === "KeyC" &&
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.repeat
  );
}
