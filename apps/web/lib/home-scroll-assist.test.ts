import assert from "node:assert/strict";
import { test } from "node:test";
import { getHomeScrollNudge } from "./home-scroll-assist";

test("a short section aligns below the header in the direction of travel", () => {
  assert.equal(getHomeScrollNudge([{ top: 169, height: 651 }], 720, 69, 1), 100);
  assert.equal(getHomeScrollNudge([{ top: -31, height: 651 }], 720, 69, -1), -100);
  assert.equal(getHomeScrollNudge([{ top: -31, height: 651 }], 720, 69, 1), null);
});

test("a long section is helped only near its start while approaching from above", () => {
  assert.equal(getHomeScrollNudge([{ top: 150, height: 1100 }], 720, 69, 1), 81);
  assert.equal(getHomeScrollNudge([{ top: 300, height: 1100 }], 720, 69, 1), null);
  assert.equal(getHomeScrollNudge([{ top: 150, height: 1100 }], 720, 69, -1), null);
});

test("reading or leaving a long section never pulls the page back to its top", () => {
  for (const top of [69, 50, 0, -200, -700]) {
    for (const direction of [1, -1] as const) {
      assert.equal(getHomeScrollNudge([{ top, height: 1100 }], 720, 69, direction), null);
    }
  }
});

test("already aligned and distant sections keep native scrolling", () => {
  for (const top of [67, 69, 71, 250, -100]) {
    assert.equal(getHomeScrollNudge([{ top, height: 651 }], 720, 69, 1), null);
  }
});

test("the nudge is bounded on both small and large viewports", () => {
  assert.equal(getHomeScrollNudge([{ top: 189, height: 531 }], 600, 69, 1), null);
  assert.equal(getHomeScrollNudge([{ top: 209, height: 2000 }], 1200, 69, 1), 140);
  assert.equal(getHomeScrollNudge([{ top: 210, height: 2000 }], 1200, 69, 1), null);
});

test("expanding FAQ beyond the viewport switches to free scrolling inside it", () => {
  assert.equal(getHomeScrollNudge([{ top: 10, height: 651 }], 720, 69, -1), -59);
  assert.equal(getHomeScrollNudge([{ top: 10, height: 900 }], 720, 69, -1), null);
});
