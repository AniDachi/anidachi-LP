import { afterEach, expect, it, vi } from "vitest";
import { attachCatalogPillDrag } from "../src/catalog-pill-drag";

const homeX = 416;
const homeY = 20;
type Position = { x: number; y: number } | null;

function mount(read: () => Promise<Position> = async () => null) {
  const root = document.createElement("div");
  const pill = document.createElement("button");
  const dock = document.createElement("span");
  root.append(pill, dock);
  document.body.append(root);
  Object.defineProperties(root, { clientWidth: { value: 500 }, clientHeight: { value: 300 } });
  Object.defineProperties(pill, { offsetWidth: { value: 72 }, offsetHeight: { value: 32 } });
  Object.defineProperties(dock, { offsetLeft: { value: homeX }, offsetTop: { value: homeY } });
  const origin = () => root.hasAttribute("data-catalog-floating")
    ? new DOMRect(parseFloat(root.style.getPropertyValue("--catalog-pill-x")), parseFloat(root.style.getPropertyValue("--catalog-pill-y")), 72, 32)
    : new DOMRect(homeX, homeY, 72, 32);
  pill.getBoundingClientRect = origin;
  pill.setPointerCapture = vi.fn();
  pill.hasPointerCapture = () => false;
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  const write = vi.fn(async (_position: Position) => {});
  const dispose = attachCatalogPillDrag(root, pill, dock, { read, write });
  const pointer = (type: string, x: number, target: EventTarget = pill) => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, button: 0, buttons: type === "pointerup" ? 0 : 1,
    pointerId: 1, isPrimary: true, clientX: x + 36, clientY: homeY + 16,
  }));
  return { pointer, origin, write, dispose };
}

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

it("keeps an outward drop inside the magnetic area, then docks on a deliberate return", () => {
  const { pointer, origin, write, dispose } = mount();
  pointer("pointerdown", homeX);
  pointer("pointermove", homeX - 24);
  pointer("pointerup", homeX - 24);
  expect(origin().x).toBeCloseTo(homeX - 24);
  expect(write).toHaveBeenCalledTimes(1);

  pointer("pointerdown", homeX - 24);
  pointer("pointermove", homeX - 36);
  pointer("pointerup", homeX - 40);
  expect(origin().x).toBeCloseTo(homeX - 40);
  pointer("pointerdown", homeX - 40);
  pointer("pointerup", homeX - 8);
  expect(origin().x).toBe(homeX);
  expect(write).toHaveBeenLastCalledWith(null);
  dispose();
});

it("allows fine adjustments near the dock and follows the final release even after capture is lost", () => {
  const { pointer, origin, write, dispose } = mount();
  pointer("pointerdown", homeX);
  pointer("pointermove", homeX - 57);
  pointer("pointerup", homeX - 45);
  expect(origin().x).toBeCloseTo(homeX - 45);

  pointer("pointerdown", homeX - 45);
  pointer("pointermove", homeX - 120);
  pointer("lostpointercapture", homeX - 120);
  pointer("pointermove", homeX - 150, document.body);
  pointer("pointerup", homeX - 156, document.body);
  expect(origin().x).toBeCloseTo(homeX - 156);
  expect(write).toHaveBeenCalledTimes(2);
  dispose();
});

it("captures on return from outside the wide field and lets the user pull away again before dropping", () => {
  const { pointer, origin, dispose } = mount();
  pointer("pointerdown", homeX);
  pointer("pointermove", homeX - 120);
  pointer("pointermove", homeX - 68);
  expect(origin().x).toBe(homeX);
  pointer("pointermove", homeX - 20);
  pointer("pointermove", homeX - 52);
  pointer("pointerup", homeX - 47);
  expect(origin().x).toBeCloseTo(homeX - 47);
  dispose();
});

it("does not replace a new drop with a late read, and restores the saved drop on remount", async () => {
  let resolve!: (value: Position) => void;
  const first = mount(() => new Promise(done => { resolve = done; }));
  first.pointer("pointerdown", homeX);
  first.pointer("pointerup", homeX - 120);
  resolve(null);
  await Promise.resolve();
  expect(first.origin().x).toBeCloseTo(homeX - 120);
  const saved = first.write.mock.calls[0]![0];
  first.dispose();
  const next = mount(async () => saved);
  await Promise.resolve();
  next.pointer("pointerdown", homeX - 120);
  next.pointer("pointermove", homeX - 180);
  next.pointer("pointercancel", homeX - 180);
  expect(next.origin().x).toBeCloseTo(homeX - 120);
  expect(next.write).not.toHaveBeenCalled();
  next.dispose();
});
