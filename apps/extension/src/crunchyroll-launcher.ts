import { requestAnidachiLaunchIntent } from "./anidachi-launch-intent";

const HERO_BUTTON_CLASS = "anidachi-crunchyroll-hero-launch";
const COMPACT_BUTTON_CLASS = "anidachi-crunchyroll-compact-launch";
const STYLE_ID = "anidachi-crunchyroll-launcher-style";

const WATCH_TEXT_PATTERN =
  /continue|start watching|watch now|resume|play|продолжить|начать|смотреть|воспроизвести/i;
const WATCHLIST_TEXT_PATTERN = /watchlist|список просмотра/i;

const heroLaunchers = new Map<HTMLElement, HTMLButtonElement>();
const compactLaunchers = new Map<HTMLElement, HTMLButtonElement>();

export function startCrunchyrollLauncher(): (() => void) | undefined {
  if (!location.hostname.endsWith("crunchyroll.com")) {
    return undefined;
  }

  ensureLauncherStyles();
  removeExistingLaunchers();
  const scan = () => {
    injectHeroLaunchers();
    injectCompactLaunchers();
  };
  const scanSoon = () => {
    window.setTimeout(scan, 40);
    window.setTimeout(scan, 180);
  };
  const interval = window.setInterval(scan, 1200);
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", scan);
  window.addEventListener("scroll", scan, true);
  document.addEventListener("pointerover", scanSoon, true);
  document.addEventListener("focusin", scanSoon, true);
  scan();

  return () => {
    window.clearInterval(interval);
    observer.disconnect();
    window.removeEventListener("resize", scan);
    window.removeEventListener("scroll", scan, true);
    document.removeEventListener("pointerover", scanSoon, true);
    document.removeEventListener("focusin", scanSoon, true);
    clearLaunchers(heroLaunchers);
    clearLaunchers(compactLaunchers);
  };
}

function injectHeroLaunchers(): void {
  for (const target of findHeroWatchTargets()) {
    const row = findActionRow(target);
    if (!row) {
      continue;
    }
    const anchor = findHeroAnchor(target);
    const button = getOrCreateLauncher(heroLaunchers, target, HERO_BUTTON_CLASS, "Watch with Anidachi", () =>
      launchWithAnidachi(target),
    );
    syncHeroButtonMetrics(button, target);
    if (anchor === target) {
      attachLauncherAfter(button, row, target);
    } else {
      attachLauncherBefore(button, row, anchor);
    }
    alignHeroButtonToTarget(button, target);
  }
  cleanupDetachedLaunchers(heroLaunchers);
}

function injectCompactLaunchers(): void {
  for (const group of findCompactActionGroups()) {
    const actions = getVisibleActionElements(group).filter(
      (element) =>
        !element.classList.contains(HERO_BUTTON_CLASS) &&
        !element.classList.contains(COMPACT_BUTTON_CLASS) &&
        isViewportElement(element),
    );
    const trigger = actions[0];
    const lastAction = actions.at(-1);
    if (!trigger || !lastAction || actions.length < 2) {
      continue;
    }

    const button = getOrCreateLauncher(compactLaunchers, group, COMPACT_BUTTON_CLASS, "A", () =>
      launchWithAnidachi(trigger),
    );
    attachLauncherAfter(button, group, lastAction);
  }
  cleanupDetachedLaunchers(compactLaunchers);
}

function launchWithAnidachi(trigger: HTMLElement): void {
  requestAnidachiLaunchIntent({
    autoCreateRoom: true,
    source: "crunchyroll-launcher",
  });
  trigger.click();
}

function findHeroWatchTargets(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button']"))
    .filter((element) => !element.classList.contains(HERO_BUTTON_CLASS))
    .filter(isVisibleElement)
    .filter(isViewportElement)
    .filter(isHeroContext)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const label = `${element.innerText} ${element.getAttribute("aria-label") ?? ""}`;
      return rect.width >= 140 && rect.height >= 36 && WATCH_TEXT_PATTERN.test(label);
    })
    .slice(0, 2);
}

function findHeroAnchor(target: HTMLElement): HTMLElement {
  const targetRect = target.getBoundingClientRect();
  const row = findActionRow(target);

  if (row) {
    const sameRowActions = getVisibleActionElements(row)
      .filter((element) => !element.classList.contains(HERO_BUTTON_CLASS))
      .filter((element) => !element.classList.contains(COMPACT_BUTTON_CLASS))
      .filter(isViewportElement)
      .filter((element) => isSameVisualRow(target, element));
    const watchlist = sameRowActions.find((element) =>
      WATCHLIST_TEXT_PATTERN.test(`${element.innerText} ${element.getAttribute("aria-label") ?? ""}`),
    );
    if (watchlist) {
      return watchlist;
    }

    const rightAction = sameRowActions
      .filter((element) => element !== target)
      .filter((element) => element.getBoundingClientRect().left >= targetRect.right - 4)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0];
    if (rightAction) {
      return rightAction;
    }
  }

  return target;
}

function findActionRow(target: HTMLElement): HTMLElement | null {
  let parent = target.parentElement;

  while (parent && parent !== document.body) {
    if (parent.className.toString().includes("buttons-group")) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return target.parentElement;
}

function findCompactActionGroups(): HTMLElement[] {
  const hoverFooters = Array.from(document.querySelectorAll<HTMLElement>("[class*='browse-card-hover__footer']"))
    .filter(isVisibleElement)
    .filter(isViewportElement)
    .filter((element) => getVisibleActionElements(element).length >= 2);

  if (hoverFooters.length > 0) {
    return hoverFooters.slice(0, 20);
  }

  const groups: HTMLElement[] = [];

  for (const element of document.querySelectorAll<HTMLElement>("div, section, article")) {
    if (!isVisibleElement(element)) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width > 360 || rect.height > 120 || rect.width < 90 || rect.height < 28) {
      continue;
    }

    const actions = getVisibleActionElements(element);
    if (actions.length < 2 || actions.length > 5) {
      continue;
    }

    const actionRects = actions.map((action) => action.getBoundingClientRect());
    const sameRow =
      Math.max(...actionRects.map((item) => item.top)) -
        Math.min(...actionRects.map((item) => item.top)) <
      18;
    const compact = actionRects.every(
      (item) => item.width >= 24 && item.width <= 72 && item.height >= 24 && item.height <= 72,
    );
    const alreadyNested = groups.some((group) => group.contains(element));

    if (sameRow && compact && !alreadyNested) {
      groups.push(element);
    }
  }

  return groups.slice(0, 20);
}

function getVisibleActionElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("button, a, [role='button']"))
    .filter((element) => !element.classList.contains(HERO_BUTTON_CLASS))
    .filter((element) => !element.classList.contains(COMPACT_BUTTON_CLASS))
    .filter(isVisibleElement)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width >= 24 && rect.height >= 24;
    });
}

function isVisibleElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  let current: HTMLElement | null = element;
  while (current && current !== document.documentElement) {
    const style = getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }
    current = current.parentElement;
  }

  return true;
}

function isViewportElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

function isSameVisualRow(first: HTMLElement, second: HTMLElement): boolean {
  const firstRect = first.getBoundingClientRect();
  const secondRect = second.getBoundingClientRect();
  const firstCenter = firstRect.top + firstRect.height / 2;
  const secondCenter = secondRect.top + secondRect.height / 2;
  return Math.abs(firstCenter - secondCenter) <= Math.max(18, firstRect.height * 0.45);
}

function getOrCreateLauncher(
  map: Map<HTMLElement, HTMLButtonElement>,
  key: HTMLElement,
  className: string,
  text: string,
  onLaunch: () => void,
): HTMLButtonElement {
  const existing = map.get(key);
  if (existing?.isConnected) {
    existing.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onLaunch();
    };
    return existing;
  }

  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = text;
  button.title = "Watch with Anidachi";
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onLaunch();
  };
  map.set(key, button);
  return button;
}

function attachLauncherAfter(button: HTMLButtonElement, row: HTMLElement, anchor: HTMLElement): void {
  const directAnchor = getDirectChild(row, anchor);
  const insertAfter = directAnchor ?? anchor;

  if (button.parentElement !== row) {
    row.insertBefore(button, insertAfter.nextSibling);
    return;
  }

  if (button.previousElementSibling !== insertAfter) {
    row.insertBefore(button, insertAfter.nextSibling);
  }
}

function attachLauncherBefore(button: HTMLButtonElement, row: HTMLElement, anchor: HTMLElement): void {
  const directAnchor = getDirectChild(row, anchor);
  const insertBefore = directAnchor ?? anchor;

  if (button.parentElement !== row) {
    row.insertBefore(button, insertBefore);
    return;
  }

  if (button.nextElementSibling !== insertBefore) {
    row.insertBefore(button, insertBefore);
  }
}

function syncHeroButtonMetrics(button: HTMLButtonElement, target: HTMLElement): void {
  const rect = target.getBoundingClientRect();
  const style = getComputedStyle(target);
  const height = Math.max(36, Math.round(rect.height));
  const width = Math.max(170, Math.min(230, Math.round(rect.width * 0.92)));

  button.style.setProperty("--anidachi-hero-height", `${height}px`);
  button.style.setProperty("--anidachi-hero-width", `${width}px`);
  button.style.setProperty("--anidachi-hero-margin-top", style.marginTop);
  button.style.setProperty("--anidachi-hero-margin-bottom", style.marginBottom);
}

function alignHeroButtonToTarget(button: HTMLButtonElement, target: HTMLElement): void {
  const align = () => {
    if (!button.isConnected || !target.isConnected) {
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const offset = Math.round(targetRect.top - buttonRect.top);
    button.style.setProperty("--anidachi-hero-y-offset", `${offset}px`);
  };

  align();
  window.requestAnimationFrame(align);
}

function cleanupDetachedLaunchers(map: Map<HTMLElement, HTMLButtonElement>): void {
  for (const [key, button] of map) {
    if (!key.isConnected || !button.isConnected) {
      button.remove();
      map.delete(key);
    }
  }
}

function clearLaunchers(map: Map<HTMLElement, HTMLButtonElement>): void {
  for (const button of map.values()) {
    button.remove();
  }
  map.clear();
}

function removeExistingLaunchers(): void {
  for (const element of document.querySelectorAll<HTMLElement>(
    `.${HERO_BUTTON_CLASS}, .${COMPACT_BUTTON_CLASS}`,
  )) {
    element.remove();
  }
}

function getDirectChild(parent: HTMLElement, descendant: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = descendant;
  while (current?.parentElement && current.parentElement !== parent) {
    current = current.parentElement;
  }
  return current?.parentElement === parent ? current : null;
}

function isHeroContext(element: HTMLElement): boolean {
  const classPath = getAncestorClassPath(element);
  return classPath.includes("hero") && !classPath.includes("browse-card");
}

function getAncestorClassPath(element: HTMLElement): string {
  const classes: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    classes.push(current.className.toString());
    current = current.parentElement;
  }

  return classes.join(" ").toLowerCase();
}

function ensureLauncherStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${HERO_BUTTON_CLASS} {
      align-items: center !important;
      appearance: none !important;
      background: linear-gradient(135deg, #7c3aed, #2563eb) !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-sizing: border-box !important;
      box-shadow: none !important;
      color: rgba(255, 255, 255, 0.98) !important;
      cursor: pointer !important;
      display: inline-flex !important;
      flex: 0 0 auto !important;
      font: 800 14px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      height: var(--anidachi-hero-height, 40px) !important;
      justify-content: center !important;
      letter-spacing: 0 !important;
      margin: var(--anidachi-hero-margin-top, 5px) 0 var(--anidachi-hero-margin-bottom, 5px) 0 !important;
      min-width: 0 !important;
      padding: 0 16px !important;
      pointer-events: auto !important;
      position: relative !important;
      transform: translateY(var(--anidachi-hero-y-offset, 0px)) !important;
      text-transform: none !important;
      top: 0 !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
      width: var(--anidachi-hero-width, 190px) !important;
      z-index: 2147483646 !important;
    }

    .${HERO_BUTTON_CLASS}:hover {
      background: linear-gradient(135deg, rgba(139, 92, 246, 1), rgba(59, 130, 246, 1)) !important;
      color: #ffffff !important;
    }

    .${COMPACT_BUTTON_CLASS} {
      align-items: center !important;
      appearance: none !important;
      background: transparent !important;
      border: none !important;
      color: #ff6a00 !important;
      cursor: pointer !important;
      display: inline-flex !important;
      flex: 0 0 auto !important;
      font: 900 27px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      height: 38px !important;
      justify-content: center !important;
      letter-spacing: 0 !important;
      margin: 0 !important;
      min-width: 0 !important;
      padding: 0 !important;
      pointer-events: auto !important;
      text-shadow: 0 4px 18px rgba(0, 0, 0, 0.5) !important;
      transform: translateY(-1px) !important;
      text-transform: none !important;
      vertical-align: middle !important;
      width: 38px !important;
      z-index: 2147483646 !important;
    }

    .${COMPACT_BUTTON_CLASS}:hover {
      background: transparent !important;
      color: #ffffff !important;
    }
  `;
  document.documentElement.append(style);
}
