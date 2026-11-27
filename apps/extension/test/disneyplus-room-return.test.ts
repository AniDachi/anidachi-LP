import { afterEach, expect, it, vi } from "vitest";
import { finishDisneyRoomReturn, returnToDisneyPlayer } from "../src/source-adapters/disneyplus/room-return";
import { discardUnrelatedDisneyLaunch, handleDisneyPlusCatalogHandoff } from "../src/source-adapters/disneyplus/catalog-handoff";
import { getStoredAuthTokens } from "../src/auth-tokens";

vi.mock("../src/auth-tokens", () => ({ getStoredAuthTokens: vi.fn() }));
const origin = "https://www.disneyplus.com";
const episode = "bf0248ad-9a12-4362-bb67-2ec72f128114";
const series = "ebb4d292-6d2c-4b93-98e6-b03406954151";
const intent = { roomId: "room-a", sessionId: "guest-a", playback: episode };
const signal = () => new AbortController().signal;

function page(path: string) {
  (window as unknown as { happyDOM: { setURL(href: string): void } }).happyDOM.setURL(origin + path);
}
function link(kind: string, href: string, label = "") {
  const anchor = document.createElement("a");
  anchor.dataset.testid = kind;
  anchor.href = href;
  anchor.textContent = label;
  document.body.append(anchor);
  return vi.spyOn(anchor, "click").mockImplementation(() => {});
}
function setupBridge() {
  const store: Record<string, unknown> = {};
  const sender = () => ({ id: "extension", frameId: 0, url: location.href, origin, tab: { id: 7 } }) as chrome.runtime.MessageSender;
  vi.mocked(getStoredAuthTokens).mockResolvedValue({ user: { id: "test" }, authSessionId: "signed-in" } as NonNullable<Awaited<ReturnType<typeof getStoredAuthTokens>>>);
  const sendMessage = vi.fn((message: Parameters<typeof handleDisneyPlusCatalogHandoff>[0]) => handleDisneyPlusCatalogHandoff(message, sender()));
  vi.stubGlobal("chrome", { runtime: { id: "extension", sendMessage }, storage: { session: {
    set: async (values: Record<string, unknown>) => Object.assign(store, values),
    get: async () => store, remove: async (key: string) => { delete store[key]; },
  } } });
  return sendMessage;
}
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps a host Sync pending when the series page remounts before its episode links load", async () => {
  const send = setupBridge();
  const destination = origin + "/play/" + episode;
  page("/home");
  await send({ type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "prepare-return", payload: intent });
  page("/browse/entity-" + series);
  const firstMount = new AbortController();
  await finishDisneyRoomReturn(document, intent, firstMount.signal, null);
  firstMount.abort();
  await finishDisneyRoomReturn(document, intent, signal(), null);
  const other = link("playback-action-button", "/play/" + series, "CONTINUE");
  const play = link("set-item", destination);
  await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
  expect(other).not.toHaveBeenCalled();
});

it("does not launch a stale return after the signed-in guest changes while the links load", async () => {
  const send = setupBridge();
  page("/home");
  await send({ type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "prepare-return", payload: intent });
  page("/browse/entity-" + series);
  await finishDisneyRoomReturn(document, intent, signal(), null);
  vi.mocked(getStoredAuthTokens).mockResolvedValue(null);
  const play = link("set-item", "/play/" + episode);
  await vi.waitFor(() => expect(send.mock.calls.filter(([m]) => m.action === "read-return")).toHaveLength(2));
  expect(play).not.toHaveBeenCalled();
});

it("waits for Disney to reveal its existing episode link", async () => {
  const send = setupBridge();
  page("/pt-br/home");
  await send({ type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "prepare-return", payload: intent });
  page("/pt-br/browse/entity-" + series);
  const region = document.createElement("section");
  region.setAttribute("aria-hidden", "true");
  document.body.append(region);
  const play = link("set-item", "/pt-br/play/" + episode);
  region.append(document.querySelector("a")!);
  await finishDisneyRoomReturn(document, intent, signal(), null);
  expect(play).not.toHaveBeenCalled();
  region.removeAttribute("aria-hidden");
  await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
});

it("uses the native localized host episode even when Continue is for a different episode", async () => {
  page("/pt-br/browse/entity-" + series);
  const resume = link("playback-action-button", "/pt-br/play/" + series, "CONTINUAR");
  const restart = link("playback-action-button", "/pt-br/play/" + episode);
  const foreign = link("set-item", "https://example.org/play/" + episode);
  const target = link("set-item", "/pt-br/play/" + episode);
  const send = setupBridge();
  await returnToDisneyPlayer(document, origin + "/play/" + episode, intent, signal());
  expect(target).toHaveBeenCalledOnce();
  for (const other of [resume, restart, foreign]) expect(other).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ action: "prepare-return" }));
  // Disney briefly attaches a player, then returns the guest to the series details.
  page("/pt-br/play/" + episode);
  const binding = new AbortController();
  await finishDisneyRoomReturn(document, intent, binding.signal, document.createElement("video"));
  binding.abort();
  page("/pt-br/browse/entity-" + series);
  await finishDisneyRoomReturn(document, intent, signal(), null);
  expect(target).toHaveBeenCalledTimes(2);
});

it("completes an explicit catalog return once after Disney redirects and renders its play action", async () => {
  page("/pt-br/home");
  const send = setupBridge();
  const assign = vi.fn();
  const destination = origin + "/pt-br/play/" + episode;
  const home = { location: { href: location.href, assign }, querySelectorAll: () => [] } as unknown as Document;
  await returnToDisneyPlayer(home, destination, intent, signal());
  expect(assign).toHaveBeenCalledWith(destination);
  page("/pt-br/browse/entity-" + series);
  await finishDisneyRoomReturn(document, intent, signal(), null);
  const restart = link("playback-action-button", destination);
  const play = link("playback-action-button", destination, "CONTINUAR");
  await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
  await finishDisneyRoomReturn(document, intent, signal(), null);
  expect(play).toHaveBeenCalledOnce();
  expect(restart).not.toHaveBeenCalled();

  const prepare = () => send({ type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "prepare-return", payload: intent });
  await prepare();
  await finishDisneyRoomReturn(document, { ...intent, roomId: "new-room" }, signal(), null);
  await finishDisneyRoomReturn(document, intent, signal(), null);
  await prepare();
  page("/pt-br/play/" + episode);
  const player = document.createElement("video");
  Object.defineProperty(player, "readyState", { value: 3 });
  await finishDisneyRoomReturn(document, intent, signal(), player);
  page("/pt-br/browse/entity-" + series);
  await finishDisneyRoomReturn(document, intent, signal(), null);
  expect(play).toHaveBeenCalledOnce();
});

it("drops the pending return when the guest browses Movies before revisiting details", async () => {
  const send = setupBridge();
  await send({ type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "prepare-return", payload: intent });
  await discardUnrelatedDisneyLaunch(7, origin + "/pt-br/browse/movies");
  page("/pt-br/browse/entity-" + series);
  const play = link("set-item", "/pt-br/play/" + episode);
  await finishDisneyRoomReturn(document, intent, signal(), null);
  expect(play).not.toHaveBeenCalled();
});
