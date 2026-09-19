import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getHistoryDemoScene, useHistoryDemo } from "./use-history-demo";

let root: Root | null = null;
let container: HTMLDivElement;
function Preview({ visible, reduced }: { visible: boolean; reduced: boolean | null }) {
  const phase = useHistoryDemo(visible, reduced);
  return React.createElement("output", { "data-scene": getHistoryDemoScene(phase) }, phase);
}
async function render(visible = true, reduced: boolean | null = false) {
  if (!root) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  await act(async () => root!.render(React.createElement(Preview, { visible, reduced })));
}
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

test("history demo saves, opens the title, resumes, and loops in 11.3 seconds", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  await render();
  assert.equal(container.textContent, "watching");
  for (const [delay, expected, scene] of [
    [1900, "saved", 1], [1300, "library", 2], [1700, "episodes", 2],
    [2700, "resume", 3], [800, "playing", 3], [2900, "watching", 1],
  ] as const) {
    const previous: string | null = container.textContent;
    await act(async () => context.mock.timers.tick(delay - 1));
    assert.equal(container.textContent, previous);
    await act(async () => context.mock.timers.tick(1));
    assert.equal(container.textContent, expected);
    assert.equal(container.querySelector("output")?.dataset.scene, String(scene));
  }
});

test("an offscreen demo stops advancing and resumes without skipping the open title", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  await render();
  await act(async () => context.mock.timers.tick(1900));
  await act(async () => context.mock.timers.tick(1300));
  await render(false);
  await act(async () => context.mock.timers.tick(60_000));
  assert.equal(container.textContent, "library");
  await render();
  await act(async () => context.mock.timers.tick(1700));
  assert.equal(container.textContent, "episodes");
});

test("motion preference is resolved before autoplay and reduced motion keeps the readable grid", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  await render(true, null);
  await act(async () => context.mock.timers.tick(60_000));
  assert.equal(container.textContent, "watching");
  await render(true, true);
  await act(async () => context.mock.timers.tick(60_000));
  assert.equal(container.textContent, "episodes");
  assert.equal(container.querySelector("output")?.dataset.scene, "2");
});
