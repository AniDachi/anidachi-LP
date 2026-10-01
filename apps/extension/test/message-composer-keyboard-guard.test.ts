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
