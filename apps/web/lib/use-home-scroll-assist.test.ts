import { dom } from "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test, type TestContext } from "node:test";
import * as React from "react";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useHomeScrollAssist } from "./use-home-scroll-assist";

let root: Root | null = null;
let y = 0;
let nextFrame = 0;
const frames = new Map<number, FrameRequestCallback>();
Object.defineProperties(globalThis, {
  getComputedStyle: { configurable: true, value: dom.getComputedStyle.bind(dom) },
  requestAnimationFrame: { configurable: true, value: (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  } },
  cancelAnimationFrame: { configurable: true, value: (id: number) => frames.delete(id) },
});

function Page() {
  const ref = useRef<HTMLElement>(null);
  useHomeScrollAssist(ref);
  return React.createElement("main", { ref }, React.createElement("section"));
}

async function setup(context: TestContext, enabled = true) {
  y = 0;
  frames.clear();
  context.mock.timers.enable({ apis: ["setTimeout"] });
  context.mock.method(window, "matchMedia", () => ({ matches: enabled,
    addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  context.mock.method(performance, "now", () => 0);
  context.mock.method(window, "scrollTo", (options: ScrollToOptions) => { y = options.top ?? y; });
  Object.defineProperties(window, {
    scrollY: { configurable: true, get: () => y },
    innerHeight: { configurable: true, value: 720 },
  });
  Object.defineProperties(document.documentElement, {
    scrollHeight: { configurable: true, value: 3000 },
  });
  document.documentElement.style.scrollPaddingTop = "69px";
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(React.createElement(Page)));
  context.mock.method(container.querySelector("section")!, "getBoundingClientRect",
    () => ({ top: 169 - y, height: 900 }) as DOMRect);
}

function wheel(target: EventTarget = document.body) {
  // Chrome can expose the compositor's new scrollY before delivering wheel.
  y += 20;
  target.dispatchEvent(new dom.WheelEvent("wheel", { deltaY: 20, bubbles: true }) as unknown as Event);
  window.dispatchEvent(new Event("scroll"));
}

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  frames.clear();
});

test("native wheel scrolling settles, then smoothly reaches the section below the header", async context => {
  await setup(context);
  wheel();
  context.mock.timers.tick(179);
  assert.equal(frames.size, 0);
  context.mock.timers.tick(1);
  assert.equal(frames.size, 1);
  const [id, animate] = [...frames.entries()][0];
  frames.delete(id);
  animate(160);
  assert.equal(y, 60);
  const [lastId, finish] = [...frames.entries()][0];
  frames.delete(lastId);
  finish(320);
  assert.equal(y, 100);
});

test("new keyboard input immediately cancels an in-flight nudge", async context => {
  await setup(context);
  wheel();
  context.mock.timers.tick(180);
  assert.equal(frames.size, 1);
  window.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "ArrowDown" }) as unknown as Event);
  assert.equal(frames.size, 0);
});

test("reduced motion and mobile conditions leave wheel scrolling untouched", async context => {
  await setup(context, false);
  wheel();
  context.mock.timers.tick(1000);
  assert.equal(frames.size, 0);
  assert.equal(y, 20);
});

test("a pending nudge is removed when navigating away from the homepage", async context => {
  await setup(context);
  wheel();
  await act(async () => root!.unmount());
  root = null;
  context.mock.timers.tick(1000);
  assert.equal(frames.size, 0);
});

test("scrolling a nested list does not arm page assistance", async context => {
  await setup(context);
  const nested = document.createElement("div");
  nested.style.overflowY = "auto";
  Object.defineProperties(nested, { scrollHeight: { value: 500 }, clientHeight: { value: 100 } });
  document.querySelector("section")!.append(nested);
  wheel(nested);
  context.mock.timers.tick(1000);
  assert.equal(frames.size, 0);
});
