/**
 * Own keyboard sequences at document_start, before provider capture handlers.
 * React replaces only the delegate, never the position of the window listener.
 * The registration lease also supports the standalone overlay preview/tests.
 */
type KeyboardHandlers = {
  keydown(event: KeyboardEvent): void;
  keyup(event: KeyboardEvent): void;
};

const delegates = new Set<KeyboardHandlers>();
const ownedKeys = new Set<string>();
let leases = 0;
const keyId = (event: KeyboardEvent) => event.code || event.key;
const consume = (event: KeyboardEvent) => {
  event.preventDefault();
  event.stopImmediatePropagation();
};
const clearOwnedKeys = () => ownedKeys.clear();
const keydown = (event: KeyboardEvent) => {
  if (event.repeat && ownedKeys.has(keyId(event))) {
    consume(event);
    return;
  }
  for (const delegate of [...delegates]) {
    delegate.keydown(event);
    if (event.defaultPrevented) {
      ownedKeys.add(keyId(event));
      return;
    }
  }
};
const keyup = (event: KeyboardEvent) => {
  // Release held media even when focus, modifiers or composer state changed.
  for (const delegate of [...delegates]) {
    delegate.keyup(event);
    if (event.defaultPrevented) break;
  }
  if (ownedKeys.delete(keyId(event))) consume(event);
};
const keypress = (event: KeyboardEvent) => {
  if (ownedKeys.has(keyId(event))) consume(event);
};

export function installOverlayKeyboardRouter(): () => void {
  if (leases++ === 0) {
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    window.addEventListener("keypress", keypress, true);
    window.addEventListener("blur", clearOwnedKeys);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--leases > 0) return;
    window.removeEventListener("keydown", keydown, true);
    window.removeEventListener("keyup", keyup, true);
    window.removeEventListener("keypress", keypress, true);
    window.removeEventListener("blur", clearOwnedKeys);
    clearOwnedKeys();
  };
}

export function registerOverlayKeyboardHandlers(handlers: KeyboardHandlers): () => void {
  const release = installOverlayKeyboardRouter();
  delegates.add(handlers);
  return () => {
    delegates.delete(handlers);
    release();
  };
}
