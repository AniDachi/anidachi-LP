import { afterEach, describe, expect, it, vi } from "vitest";
import { startContentLifecycle } from "../entrypoints/content";
import { ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT } from "../src/message-composer-events";

const cleanups: (() => void)[] = [];
afterEach(() => {
	cleanups
		.splice(0)
		.reverse()
		.forEach((cleanup) => cleanup());
	delete document.documentElement.dataset.anidachiComposerOpen;
	vi.restoreAllMocks();
});
function install() {
	const runtime = startContentLifecycle({
		detect: () => ({ status: "none" }),
		ensureStyles: () => {},
		startProviderStudy: () => null,
	});
	cleanups.push(() => runtime.dispose());
}
function key(type: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent(type, {
		bubbles: true,
		cancelable: true,
		key: "Enter",
		code: "Enter",
		...init,
	});
	window.dispatchEvent(event);
	return event;
}
describe("composer keyboard gesture", () => {
	it("keeps the release of a submitted Enter away from the native player after the input closes", () => {
		install();
		const submit = () => {
			delete document.documentElement.dataset.anidachiComposerOpen;
		};
		window.addEventListener(ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT, submit);
		cleanups.push(() =>
			window.removeEventListener(
				ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
				submit,
			),
		);
		const native = vi.fn();
		window.addEventListener("keyup", native, true);
		cleanups.push(() => window.removeEventListener("keyup", native, true));
		document.documentElement.dataset.anidachiComposerOpen = "true";
		key("keydown");
		key("keyup");
		expect(native).not.toHaveBeenCalled();
		key("keyup", { key: "ArrowRight", code: "ArrowRight" });
		expect(native).toHaveBeenCalledOnce();
	});
	it("does not submit an IME confirmation or a repeated held Enter", () => {
		install();
		const submit = vi.fn();
		window.addEventListener(ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT, submit);
		cleanups.push(() =>
			window.removeEventListener(
				ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
				submit,
			),
		);
		document.documentElement.dataset.anidachiComposerOpen = "true";
		key("keydown", { isComposing: true });
		key("keydown", { repeat: true });
		expect(submit).not.toHaveBeenCalled();
	});
	it("does not treat the quiet interval after send as an open composer", () => {
		install();
		const submit = vi.fn();
		window.addEventListener(ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT, submit);
		cleanups.push(() =>
			window.removeEventListener(
				ANIDACHI_MESSAGE_COMPOSER_SUBMIT_EVENT,
				submit,
			),
		);
		document.documentElement.dataset.anidachiComposerOpen = "quiet";
		expect(key("keydown").defaultPrevented).toBe(false);
		expect(submit).not.toHaveBeenCalled();
	});
});


describe("composer dismissal keyboard guard", () => {
	it("consumes Escape and its release after closing without passing them to the player", () => {
		install();
		const dismiss = vi.fn(() => { document.documentElement.dataset.anidachiComposerOpen = "quiet"; });
		window.addEventListener("anidachi:message-composer-dismiss", dismiss);
		cleanups.push(() => window.removeEventListener("anidachi:message-composer-dismiss", dismiss));
		const native = vi.fn();
		for (const type of ["keydown", "keyup"]) {
			window.addEventListener(type, native, true);
			cleanups.push(() => window.removeEventListener(type, native, true));
		}
		document.documentElement.dataset.anidachiComposerOpen = "true";
		expect(key("keydown", { key: "Escape", code: "Escape" }).defaultPrevented).toBe(true);
		key("keydown", { key: "Escape", code: "Escape", repeat: true });
		expect(key("keyup", { key: "Escape", code: "Escape" }).defaultPrevented).toBe(true);
		expect(dismiss).toHaveBeenCalledOnce();
		expect(native).not.toHaveBeenCalled();
		key("keydown", { key: "Escape", code: "Escape" });
		expect(native).toHaveBeenCalledOnce();
	});
	it.each(["fullscreen", "composition"])("leaves %s Escape to the browser instead of pretending to lock it", (mode) => {
		install();
		if (mode === "fullscreen") {
			Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.body });
			cleanups.push(() => { Reflect.deleteProperty(document, "fullscreenElement"); });
		}
		document.documentElement.dataset.anidachiComposerOpen = "true";
		expect(key("keydown", { key: "Escape", code: "Escape", isComposing: mode === "composition" }).defaultPrevented).toBe(false);
		expect(document.documentElement.dataset.anidachiComposerOpen).toBe("true");
	});
});

describe("Netflix capture-phase keyboard isolation", () => {
  function netflix() {
    const previous = Object.getOwnPropertyDescriptor(window, "location")!;
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://www.netflix.com/watch/1") });
    cleanups.push(() => Object.defineProperty(window, "location", previous));
    install();
  }
  it("keeps typing and held keys away from Netflix capture handlers without cancelling native text editing", () => {
    netflix();
    const native = vi.fn();
    for (const type of ["keydown", "keyup", "keypress"]) {
      window.addEventListener(type, native, true);
      cleanups.push(() => window.removeEventListener(type, native, true));
    }
    document.documentElement.dataset.anidachiComposerOpen = "true";
    for (const init of [{ key: "k", code: "KeyK" }, { key: " ", code: "Space", repeat: true }, { key: "v", code: "KeyV", metaKey: true }]) {
      expect(key("keydown", init).defaultPrevented).toBe(false);
      key("keypress", init); key("keyup", init);
    }
    expect(native).not.toHaveBeenCalled();
    delete document.documentElement.dataset.anidachiComposerOpen;
    key("keydown", { key: "k", code: "KeyK" }); expect(native).toHaveBeenCalledOnce();
  });
  it("dismisses page-delivered fullscreen Escape without calling exitFullscreen or requesting permission", () => {
    netflix();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.body });
    cleanups.push(() => Reflect.deleteProperty(document, "fullscreenElement"));
    const dismiss = vi.fn();
    window.addEventListener("anidachi:message-composer-dismiss", dismiss);
    cleanups.push(() => window.removeEventListener("anidachi:message-composer-dismiss", dismiss));
    document.documentElement.dataset.anidachiComposerOpen = "true";
    expect(key("keydown", { key: "Escape", code: "Escape" }).defaultPrevented).toBe(true);
    expect(dismiss).toHaveBeenCalledOnce(); expect(document.fullscreenElement).toBe(document.body);
  });
});
