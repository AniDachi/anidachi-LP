type Point = { x: number; y: number };
type CatalogPillPosition = Point | null;

interface CatalogPillPlacement {
  read(): Promise<CatalogPillPosition>;
  write(next: CatalogPillPosition): Promise<void>;
}

export function catalogPillPlacement(provider: string): CatalogPillPlacement {
  const key = "anidachi:catalog-pill-position:v1:" + provider;
  return {
    async read() {
      const record = await chrome.storage.local.get(key);
      const point = record[key] as Partial<Point> | null | undefined;
      const valid = (n: unknown): n is number => typeof n === "number" && n >= 0 && n <= 1;
      return point && valid(point.x) && valid(point.y) ? { x: point.x, y: point.y } : null;
    },
    async write(next) {
      if (next) await chrome.storage.local.set({ [key]: next });
      else await chrome.storage.local.remove(key);
    },
  };
}

const margin = 8;
const clickSlop = 6;
const releaseRadius = 48;
const travelAtRelease = .30;
const dockCenterRadius = 12;
const capturePadding = 44;
const magneticHysteresis = 8;
const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));

function stretchedScale(dx: number, dy: number, distance: number) {
  const lengthSquared = Math.max(1, distance * distance);
  const tension = Math.min(1, distance / releaseRadius);
  const horizontal = dx * dx / lengthSquared;
  const vertical = dy * dy / lengthSquared;
  return `${1 + tension * (.20 * horizontal - .08 * vertical)} ${1 + tension * (.20 * vertical - .08 * horizontal)}`;
}

/** The dock always follows the provider's original anchor. Only catalog coordinates move. */
export function attachCatalogPillDrag(
  root: HTMLElement, pill: HTMLButtonElement, dock: HTMLElement,
  placement: CatalogPillPlacement,
) {
  const events = new AbortController();
  const options = { signal: events.signal };
  let gesture: {
    id: number; start: Point; grab: Point; moved: boolean;
    furthestFromDock: number; crossedField: boolean; snappedDistance: number | null;
    changedPlacement: boolean;
  } | null = null;
  let position: CatalogPillPosition = null;
  let restingPosition: CatalogPillPosition = null;
  let dropped = false;
  let suppressClick = false;
  let pull: Animation | undefined;
  let rangeX = 0, rangeY = 0;
  let capRadius = 0, halfStraight = 0;
  let home: Point = { x: 0, y: 0 };
  let origin: Point = { x: 0, y: 0 };
  let tracking: AbortController | undefined;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  function place(next: CatalogPillPosition) {
    position = next;
    root.toggleAttribute("data-catalog-floating", next !== null);
    if (!next) return;
    const x = margin + next.x * rangeX, y = margin + next.y * rangeY;
    root.style.setProperty("--catalog-pill-x", x + "px");
    root.style.setProperty("--catalog-pill-y", y + "px");
    root.toggleAttribute("data-catalog-panel-above", next.y > .5);
    root.toggleAttribute("data-catalog-return-right", x < 130 && x < rangeX / 2);
  }
  function measure() {
    const width = pill.offsetWidth, height = pill.offsetHeight;
    const bounds = root.getBoundingClientRect();
    origin = { x: bounds.left, y: bounds.top };
    root.style.setProperty("--catalog-pill-width", width + "px");
    root.style.setProperty("--catalog-pill-height", height + "px");
    capRadius = height / 2;
    halfStraight = Math.max(0, width / 2 - capRadius);
    rangeX = Math.max(0, root.clientWidth - width - 2 * margin);
    rangeY = Math.max(0, root.clientHeight - height - 2 * margin);
    home = { x: dock.offsetLeft, y: dock.offsetTop };
    place(position);
  }
  function wave(arriving: boolean) {
    if (reducedMotion?.matches) return;
    Array.from(dock.children).forEach((ring, i) => {
      ring.getAnimations().forEach(a => a.cancel());
      ring.animate([
        { inset: "0px", opacity: 0 },
        { opacity: arriving ? .72 : .52, offset: .16 },
        { inset: arriving ? "-12px" : "-9px", opacity: 0 },
      ], { duration: 440, delay: (arriving ? 75 : 0) + i * 85, easing: "cubic-bezier(.22,.65,.32,1)" });
    });
  }
  function distanceFromOutline(dx: number, dy: number) {
    return Math.hypot(Math.max(0, Math.abs(dx) - halfStraight), dy) - capRadius;
  }
  function down(e: PointerEvent) {
    if (e.button !== 0 || !e.isPrimary || gesture) return;
    measure();
    const rect = pill.getBoundingClientRect();
    const dx = rect.left - origin.x - home.x, dy = rect.top - origin.y - home.y;
    suppressClick = false;
    gesture = { id: e.pointerId, start: { x: e.clientX, y: e.clientY },
      grab: { x: e.clientX - rect.left, y: e.clientY - rect.top }, moved: false,
      furthestFromDock: Math.hypot(dx, dy), crossedField: distanceFromOutline(dx, dy) > capturePadding,
      snappedDistance: null, changedPlacement: false };
    // Keep following this gesture if the page takes pointer capture away from the pill.
    tracking = new AbortController();
    const track = { capture: true, signal: tracking.signal };
    window.addEventListener("pointermove", move, track);
    window.addEventListener("pointerup", finish, track);
    window.addEventListener("pointercancel", finish, track);
    window.addEventListener("blur", finishAtLastPoint, { signal: tracking.signal });
    window.addEventListener("pagehide", finishAtLastPoint, { signal: tracking.signal });
    pill.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!gesture || gesture.id !== e.pointerId) return;
    if (e.type === "pointermove" && e.buttons === 0) {
      finishAtLastPoint();
      return;
    }
    if (!gesture.moved && Math.hypot(e.clientX - gesture.start.x, e.clientY - gesture.start.y) < clickSlop) return;
    gesture.moved = true;
    root.setAttribute("data-catalog-dragging", "");
    const x = margin + clamp(e.clientX - origin.x - gesture.grab.x - margin, rangeX);
    const y = margin + clamp(e.clientY - origin.y - gesture.grab.y - margin, rangeY);
    const dx = x - home.x, dy = y - home.y;
    // Distance from the dragged pill's center to the dock's stadium outline.
    const fromDock = distanceFromOutline(dx, dy);
    const distance = Math.hypot(dx, dy);
    if (fromDock > capturePadding) gesture.crossedField = true;
    const returning = gesture.furthestFromDock - distance >= magneticHysteresis;
    // While positioning inside the field, only the dock's center is a return target.
    const capture = gesture.crossedField ? fromDock <= capturePadding : distance <= dockCenterRadius;
    if (gesture.snappedDistance !== null) gesture.snappedDistance = Math.min(gesture.snappedDistance, distance);
    if (position && capture && returning) {
      place(null);
      gesture.snappedDistance = distance;
      gesture.crossedField = false;
      gesture.changedPlacement = true;
      if (!reducedMotion?.matches) {
        pull?.cancel();
        pull = pill.animate([{ translate: dx + "px " + dy + "px" },
          { translate: "0 0" }], { duration: 220, easing: "cubic-bezier(.18,.8,.22,1)" });
      }
      wave(true);
    } else if (position || distance - (gesture.snappedDistance ?? 0) >= releaseRadius) {
      if (!position) {
        gesture.furthestFromDock = distance;
        gesture.snappedDistance = null;
        pull?.cancel();
        if (!reducedMotion?.matches) {
          const lag = Math.min(distance, releaseRadius) * (1 - travelAtRelease) / distance;
          pull = pill.animate([
            { translate: -dx * lag + "px " + -dy * lag + "px", scale: stretchedScale(dx, dy, distance) },
            { translate: "0px 0px", scale: "1" },
          ], { duration: 250, easing: "cubic-bezier(.28,.48,.22,1)" });
        }
        wave(false);
      }
      gesture.furthestFromDock = Math.max(gesture.furthestFromDock, distance);
      gesture.changedPlacement = true;
      place({ x: rangeX ? (x - margin) / rangeX : 0, y: rangeY ? (y - margin) / rangeY : 0 });
    } else if (gesture.snappedDistance === null && !reducedMotion?.matches) {
      const remainingPull = 1 - distance / releaseRadius;
      const travel = travelAtRelease + .28 * remainingPull * remainingPull;
      pill.style.translate = dx * travel + "px " + dy * travel + "px";
      pill.style.scale = stretchedScale(dx, dy, distance);
    }
    if (position) {
      pill.style.removeProperty("translate");
      pill.style.removeProperty("scale");
    }
  }
  function finish(e: PointerEvent) {
    if (!gesture || gesture.id !== e.pointerId) return;
    // Only a normal release carries a final pointer position. On cancellation, keep the last rendered one.
    if (e.type === "pointerup") move(e);
    finishAtLastPoint();
  }
  function finishAtLastPoint() {
    if (!gesture) return;
    const { id, moved, changedPlacement } = gesture;
    gesture = null;
    tracking?.abort();
    suppressClick = moved;
    if (changedPlacement) {
      dropped = true;
      restingPosition = position;
      void placement.write(position).catch(() => {});
    } else {
      place(restingPosition);
    }
    root.removeAttribute("data-catalog-dragging");
    pill.style.removeProperty("translate");
    pill.style.removeProperty("scale");
    if (pill.hasPointerCapture(id)) pill.releasePointerCapture(id);
  }
  pill.addEventListener("pointerdown", down, options);
  pill.addEventListener("click", e => {
    if (suppressClick && e.detail > 0) { e.preventDefault(); e.stopImmediatePropagation(); }
    suppressClick = false;
  }, { ...options, capture: true });
  measure();
  void placement.read().then(previous => {
    if (events.signal.aborted || dropped) return;
    restingPosition = previous;
    if (!gesture) place(previous);
  }).catch(() => {});
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
  resize?.observe(root);
  resize?.observe(pill);
  return () => {
    finishAtLastPoint();
    events.abort();
    resize?.disconnect();
    pull?.cancel();
    pill.style.removeProperty("translate");
    for (const key of ["dragging", "floating", "panel-above", "return-right"]) root.removeAttribute("data-catalog-" + key);
    for (const key of ["x", "y", "width", "height"]) root.style.removeProperty("--catalog-pill-" + key);
  };
}
