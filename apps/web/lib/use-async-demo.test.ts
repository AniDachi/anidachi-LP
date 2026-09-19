import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ASYNC_DEMO_MESSAGE, getAsyncDemoScene, useAsyncDemo, useAsyncDemoTyping, type AsyncDemoPhase } from "./use-async-demo";

let root: Root | null = null;
let container: HTMLDivElement;
function Preview({ visible, reduced }: { visible: boolean; reduced: boolean | null }) {
  const phase = useAsyncDemo(visible, reduced);
  return React.createElement("output", { "data-scene": getAsyncDemoScene(phase) }, phase);
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

test("async preview keeps the reaction locked until the final moment and shows typing and sending before replaying the message and loops in 17.6 seconds", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  await render();
  assert.equal(container.textContent, "watching");
  for (const [delay, expected, scene] of [
    [2800, "compose", 2], [800, "writing", 2], [1500, "emoji", 2], [1200, "send", 2],
    [1100, "saved", 2], [2000, "later", 3], [1600, "catching", 3],
    [1400, "approaching", 3], [1000, "unlocked", 4], [4200, "watching", 1],
  ] as const) {
    const previous: string | null = container.textContent;
    await act(async () => context.mock.timers.tick(delay - 1));
    assert.equal(container.textContent, previous);
    await act(async () => context.mock.timers.tick(1));
    assert.equal(container.textContent, expected);
    assert.equal(container.querySelector("output")?.dataset.scene, String(scene));
  }
});

test("hidden previews cannot unlock a reaction, and mode changes discard old timers", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  await render();
  for (const delay of [2800, 800, 1500, 1200, 1100, 2000, 1600]) await act(async () => context.mock.timers.tick(delay));
  await render(false);
  await act(async () => context.mock.timers.tick(60_000));
  assert.equal(container.textContent, "catching");
  await render();
  await act(async () => context.mock.timers.tick(1400));
  assert.equal(container.textContent, "approaching");
  await act(async () => root!.unmount());
  root = null;
  await render();
  await act(async () => context.mock.timers.tick(900));
  assert.equal(container.textContent, "watching");
});

test("waits for the motion preference and shows a static readable preview with reduced motion", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  await render(true, null);
  await act(async () => context.mock.timers.tick(60_000));
  assert.equal(container.textContent, "watching");
  await render(true, true);
  await act(async () => context.mock.timers.tick(60_000));
  assert.equal(container.textContent, "unlocked");
});


test("message types only while visible, appends the selected emoji, and resets for the next viewer", async context => {
  context.mock.timers.enable({ apis: ["setInterval"] });
  function Composer({ phase, playing }: { phase: AsyncDemoPhase; playing: boolean }) {
    return React.createElement("output", null, useAsyncDemoTyping(phase, playing));
  }
  await render(false);
  const compose = async (phase: AsyncDemoPhase, playing = true) => {
    await act(async () => root!.render(React.createElement(Composer, { phase, playing })));
  };
  await compose("writing");
  await act(async () => context.mock.timers.tick(195));
  assert.equal(container.textContent, "Tha");
  await compose("writing", false);
  await act(async () => context.mock.timers.tick(1000));
  assert.equal(container.textContent, "Tha");
  await compose("writing");
  await act(async () => context.mock.timers.tick(2000));
  assert.equal(container.textContent, ASYNC_DEMO_MESSAGE);
  await compose("emoji");
  assert.equal(container.textContent, ASYNC_DEMO_MESSAGE);
  await compose("send");
  assert.equal(container.textContent, `${ASYNC_DEMO_MESSAGE} 🥹`);
  await compose("later");
  assert.equal(container.textContent, "");
  await compose("writing");
  assert.equal(container.textContent, "");
});
