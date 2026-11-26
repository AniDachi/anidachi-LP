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
  const pointer = (type: string, x: number) => pill.dispatchEvent(new PointerEvent(type, {
    button: 0, pointerId: 1, isPrimary: true, clientX: x + 36, clientY: homeY + 16,
  }));
  return { pointer, origin, write, dispose };
}

afterEach(() => vi.restoreAllMocks());

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
  pointer("pointerup", homeX - 25);
  expect(origin().x).toBe(homeX);
  expect(write).toHaveBeenLastCalledWith(null);
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
