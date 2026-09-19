/* eslint-disable react/no-children-prop -- Required children props keep non-JSX createElement tests type-safe. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { dom } from "./test-helpers/account-client-dom";
import { TableOfContents } from "../components/table-of-contents";
import { SeoBelowTitleCta } from "../components/seo-below-title-cta";
import { SeoGuideAnswer, SeoGuideTitle } from "../components/seo-guide-blocks";

let container: HTMLDivElement;
let root: Root;
const oldObserver = globalThis.IntersectionObserver;
const oldScroll = window.scrollTo;
const oldKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = "";
  globalThis.IntersectionObserver = dom.IntersectionObserver as unknown as typeof IntersectionObserver;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
  globalThis.IntersectionObserver = oldObserver;
  window.scrollTo = oldScroll;
  if (oldKey === undefined) delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  else process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = oldKey;
});

test("mobile contents measures the destination after collapsing the list", async () => {
  await act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(TableOfContents, { headings: [{ id: "steps", label: "Step-by-step", level: 2 }] }),
    React.createElement("h2", { id: "steps" }, "Step-by-step"),
  )));
  const toggle = container.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
  const target = document.getElementById("steps")!;
  target.getBoundingClientRect = () => ({
    top: toggle.getAttribute("aria-expanded") === "true" ? 900 : 700,
  } as DOMRect);
  const positions: number[] = [];
  window.scrollTo = ((options: ScrollToOptions) => positions.push(options.top!)) as typeof window.scrollTo;
  await act(async () => toggle.click());
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  const item = [...container.querySelectorAll("button")].find((el) => el.textContent === "Step-by-step")!;
  await act(async () => item.click());
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.deepEqual(positions, [700 - 88]);
  const desktopItem = [...container.querySelectorAll("button")].find((el) => el.textContent === "Step-by-step")!;
  await act(async () => desktopItem.click());
  assert.deepEqual(positions, [612, 612]);
});

test("guide CTA follows the complete short answer rather than separating its heading", async () => {
  await act(async () => root.render(React.createElement(SeoBelowTitleCta, {
    pagePath: "/guides/how-to-watch-youtube-with-friends", pageTemplate: "guide",
    children: [
      React.createElement(SeoGuideTitle, { key: "title", children: "Watch YouTube with friends" }),
      React.createElement("h2", { key: "heading", id: "answer" }, "Short Answer"),
      React.createElement(SeoGuideAnswer, { key: "answer", children: React.createElement("p", null, "The complete answer.") }),
      React.createElement("h2", { key: "next", id: "steps" }, "Steps"),
    ],
  })));
  const answer = container.querySelector("#answer")!;
  assert.match(answer.nextElementSibling!.textContent!, /The complete answer/);
  assert.ok(answer.nextElementSibling!.nextElementSibling!.querySelector('a[href="/extension"]'));
  assert.equal(answer.nextElementSibling!.nextElementSibling!.nextElementSibling!.id, "steps");
});

test("legacy h1 and introduction keep their CTA after the introduction", async () => {
  await act(async () => root.render(React.createElement(SeoBelowTitleCta, {
    pagePath: "/watch-anime-together", pageTemplate: "pillar",
    children: [
      React.createElement("h1", { key: "title" }, "Title"),
      React.createElement("p", { key: "date", className: "text-xs" }, "Updated today"),
      React.createElement("p", { key: "intro", id: "intro" }, "Introduction"),
      React.createElement("h2", { key: "next", id: "next" }, "Next"),
    ],
  })));
  assert.ok(container.querySelector("#intro")!.nextElementSibling!.querySelector('a[href="/extension"]'));
});
