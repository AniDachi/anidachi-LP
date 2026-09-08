import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { forgetPopupView, readPopupHistoryView, readPopupView, writePopupHistoryChoice, writePopupNavigation, writePopupQuery } from "../src/popup-view-state";
import { PopupRetainedPanel, usePopupNavigation } from "../src/use-popup-navigation";

const OWNER = "account-a";
let root: Root | undefined;
let container: HTMLDivElement;
beforeEach(() => { localStorage.clear(); });
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; container?.remove(); vi.restoreAllMocks(); });

function Harness({ owner = OWNER }: { owner?: string }) {
  const shell = useRef<HTMLElement>(null);
  const [tab, select] = usePopupNavigation(owner, shell);
  return <main ref={shell}>
    <button onClick={() => select("resources")}>Watch</button>
    <button onClick={() => select("friends")}>People</button>
    <PopupRetainedPanel key={`${owner}:resources`} active={tab === "resources"} tab="resources"><input aria-label="Watch search" /></PopupRetainedPanel>
    <PopupRetainedPanel key={`${owner}:friends`} active={tab === "friends"} tab="friends"><input aria-label="People search" /></PopupRetainedPanel>
  </main>;
}
async function mount() {
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<Harness />));
}
async function click(label: string) {
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === label)!.click());
}
function scroll(top: number) {
  const shell = container.querySelector("main")!;
  shell.scrollTop = top;
  shell.dispatchEvent(new Event("scroll"));
}

it("keeps the same panel DOM and separate scroll positions while navigating", async () => {
  await mount();
  const input = container.querySelector<HTMLInputElement>('[aria-label="Watch search"]')!;
  input.value = "saved search";
  scroll(320);
  await click("People");
  expect(input.closest('[data-popup-tab]')?.hasAttribute("hidden")).toBe(true);
  expect(container.querySelector("main")!.scrollTop).toBe(0);
  scroll(80);
  await click("Watch");
  expect(container.querySelector('[aria-label="Watch search"]')).toBe(input);
  expect(input.value).toBe("saved search");
  expect(container.querySelector("main")!.scrollTop).toBe(320);
  await click("People");
  expect(container.querySelector("main")!.scrollTop).toBe(80);
});

it("restores the last tab and position when the whole popup is recreated", async () => {
  await mount(); await click("People"); scroll(140);
  await act(async () => root!.unmount()); container.remove(); root = undefined;
  await mount();
  expect(container.querySelector('[data-popup-tab="friends"]')?.hasAttribute("hidden")).toBe(false);
  expect(container.querySelector("main")!.scrollTop).toBe(140);
});

it("does not transfer navigation or mounted input state to another account", async () => {
  await mount(); await click("People"); scroll(140);
  await act(async () => root!.render(<Harness owner="account-b" />));
  expect(container.querySelector('[data-popup-tab="resources"]')?.hasAttribute("hidden")).toBe(false);
  expect(container.querySelector("main")!.scrollTop).toBe(0);
  expect(readPopupView("account-b").history).toBeUndefined();
});

it("scopes disclosure and season choices to owner and history generation", () => {
  writePopupHistoryChoice(OWNER, 1, "branches", "provider", false);
  writePopupHistoryChoice(OWNER, 1, "branches", "title", true);
  writePopupHistoryChoice(OWNER, 1, "seasons", "title", "season-two");
  expect(readPopupHistoryView(OWNER, 1)).toMatchObject({ branches: { provider: false, title: true }, seasons: { title: "season-two" } });
  expect(readPopupHistoryView("account-b", 1).branches).toEqual({});
  expect(readPopupHistoryView(OWNER, 2).branches).toEqual({});
  expect(readPopupHistoryView(OWNER).branches).toEqual({});
  writePopupHistoryChoice(OWNER, 2, "branches", "new-title", true);
  expect(readPopupHistoryView(OWNER, 2).branches).toEqual({ "new-title": true });
  expect(readPopupHistoryView(OWNER, 2).seasons).toEqual({});
  forgetPopupView(); expect(readPopupView(OWNER).history).toBeUndefined();
});

it("merges navigation and history edits without overwriting each other", () => {
  writePopupNavigation(OWNER, "resources", 150);
  writePopupHistoryChoice(OWNER, 1, "branches", "title", false);
  writePopupNavigation(OWNER, "friends", 60);
  writePopupQuery(OWNER, "search", { period: "last-7-days", fromDate: "", throughDate: "" });
  const view = readPopupView(OWNER);
  expect(view).toMatchObject({ tab: "friends", scroll: { resources: 150, friends: 60 }, history: { branches: { title: false } }, search: "search", conditions: { period: "last-7-days" } });
});

it("bounds saved choices and tolerates malformed or unavailable storage", () => {
  for (let index = 0; index < 150; index++) writePopupHistoryChoice(OWNER, 1, "branches", `title-${index}`, false);
  expect(Object.keys(readPopupHistoryView(OWNER, 1).branches)).toHaveLength(128);
  localStorage.setItem("anidachi.popupView.v1", "broken");
  expect(readPopupView(OWNER).tab).toBe("resources");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(() => writePopupNavigation(OWNER, "friends", 120)).not.toThrow();
});
