type Point = { x: number; y: number };
export type CatalogPillPosition = Point | null;

const margin = 8;
const clickSlop = 6;
const releaseRadius = 36;
const captureRadius = 24;
const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));

/** The dock always follows the provider's original anchor. Only catalog coordinates move. */
export function attachCatalogPillDrag(
  root: HTMLElement, pill: HTMLButtonElement, dock: HTMLElement,
  saved: { current: CatalogPillPosition },
) {
  const events = new AbortController();
  const options = { signal: events.signal };
  let gesture: { id: number; start: Point; grab: Point; original: CatalogPillPosition; moved: boolean } | null = null;
  let position = saved.current;
  let suppressClick = false;
  let pull: Animation | undefined;
  let rangeX = 0, rangeY = 0;
  let home: Point = { x: 0, y: 0 };
  let origin: Point = { x: 0, y: 0 };
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
        { transform: "scale(.55)", opacity: 0 },
        { opacity: arriving ? .65 : .45, offset: .16 },
        { transform: "scale(2.3)", opacity: 0 },
      ], { duration: 500, delay: i * 85, easing: "cubic-bezier(.2,.65,.32,1)" });
    });
  }
  function down(e: PointerEvent) {
    if (e.button !== 0 || !e.isPrimary || gesture) return;
    measure();
    const rect = pill.getBoundingClientRect();
    suppressClick = false;
    gesture = { id: e.pointerId, start: { x: e.clientX, y: e.clientY },
      grab: { x: e.clientX - rect.left, y: e.clientY - rect.top }, original: position, moved: false };
    pill.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!gesture || gesture.id !== e.pointerId) return;
    if (!gesture.moved && Math.hypot(e.clientX - gesture.start.x, e.clientY - gesture.start.y) < clickSlop) return;
    gesture.moved = true;
    root.setAttribute("data-catalog-dragging", "");
    const x = margin + clamp(e.clientX - origin.x - gesture.grab.x - margin, rangeX);
    const y = margin + clamp(e.clientY - origin.y - gesture.grab.y - margin, rangeY);
    const distance = Math.hypot(x - home.x, y - home.y);
    if (position && distance <= captureRadius) {
      place(null);
      if (!reducedMotion?.matches) {
        pull?.cancel();
        pull = pill.animate([{ translate: (x - home.x) + "px " + (y - home.y) + "px" },
          { translate: "0 0" }], { duration: 190, easing: "cubic-bezier(.18,.8,.22,1)" });
      }
      wave(true);
    } else if (position || distance >= releaseRadius) {
      if (!position) {
        pull?.cancel();
        if (!reducedMotion?.matches) pull = pill.animate([{ scale: ".96" }, { scale: "1.045", offset: .55 }, { scale: "1" }], { duration: 210, easing: "ease-out" });
        wave(false);
      }
      place({ x: rangeX ? (x - margin) / rangeX : 0, y: rangeY ? (y - margin) / rangeY : 0 });
    } else if (!reducedMotion?.matches) {
      pill.style.translate = (x - home.x) * .2 + "px " + (y - home.y) * .2 + "px";
    }
    if (position) pill.style.removeProperty("translate");
  }
  function finish(e: PointerEvent) {
    if (!gesture || gesture.id !== e.pointerId) return;
    const { original, moved } = gesture;
    gesture = null;
    suppressClick = moved;
    if (e.type === "pointerup") saved.current = position;
    else { pull?.cancel(); place(original); }
    root.removeAttribute("data-catalog-dragging");
    pill.style.removeProperty("translate");
    if (pill.hasPointerCapture(e.pointerId)) pill.releasePointerCapture(e.pointerId);
  }
  pill.addEventListener("pointerdown", down, options);
  pill.addEventListener("pointermove", move, options);
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) pill.addEventListener(name, finish, options);
  pill.addEventListener("click", e => {
    if (suppressClick && e.detail > 0) { e.preventDefault(); e.stopImmediatePropagation(); }
    suppressClick = false;
  }, { ...options, capture: true });
  measure();
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
  resize?.observe(root);
  resize?.observe(pill);
  return () => {
    events.abort();
    resize?.disconnect();
    if (gesture && pill.hasPointerCapture(gesture.id)) pill.releasePointerCapture(gesture.id);
    pull?.cancel();
    pill.style.removeProperty("translate");
    for (const key of ["dragging", "floating", "panel-above", "return-right"]) root.removeAttribute("data-catalog-" + key);
    for (const key of ["x", "y", "width"]) root.style.removeProperty("--catalog-pill-" + key);
  };
}
