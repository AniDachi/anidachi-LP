export const PLAYER_INTRODUCTION_ACTIVE_ATTR =
	"data-anidachi-player-introduction";
export const PLAYER_INTRODUCTION_KEY_EVENT = "anidachi:player-introduction-key";

let practiceRoot: HTMLElement | null = null;

export function registerPlayerIntroductionRoot(root: HTMLElement) {
	practiceRoot = root;
	return () => {
		if (practiceRoot === root) practiceRoot = null;
	};
}

let practiceTextInput: HTMLInputElement | null = null;

/** The production overlay uses a closed shadow root, so the early window guard
 * cannot discover its focused input through composedPath(). Keep a direct,
 * short-lived reference to this tutorial-only editor instead. */
export function registerPlayerIntroductionTextInput(input: HTMLInputElement) {
	practiceTextInput = input;
	return () => {
		if (practiceTextInput === input) practiceTextInput = null;
	};
}

function editingPracticeText() {
	return (
		practiceTextInput?.isConnected &&
		(practiceTextInput.getRootNode() as ShadowRoot | Document).activeElement ===
			practiceTextInput
	);
}

function isTextEditingKey(event: KeyboardEvent) {
	return (
		editingPracticeText() &&
		(event.isComposing ||
			event.keyCode === 229 ||
			!["Enter", "Escape", "Tab"].includes(event.key))
	);
}

/** Installed before the normal composer/player shortcuts. Keep the final keyup
 * contained even when Escape or Enter has already dismissed the teaching UI. */
export function installPlayerIntroductionKeyboardGuard() {
	const held = new Set<string>();
	const active = () =>
		document.documentElement.hasAttribute(PLAYER_INTRODUCTION_ACTIVE_ATTR);
	const consume = (event: KeyboardEvent) => {
		event.preventDefault();
		event.stopImmediatePropagation();
	};
	const down = (event: KeyboardEvent) => {
		if (!active()) return;
		held.add(event.code || event.key);
		// Preserve native typing, selection, paste and IME while stopping player
		// shortcuts. Enter, Escape and Tab still go through the tour controller.
		if (isTextEditingKey(event)) {
			event.stopImmediatePropagation();
			return;
		}
		// Let the browser change a focused practice slider, while keeping the
		// keystroke away from the provider's player shortcuts.
		const tree = practiceRoot?.getRootNode() as
			| ShadowRoot
			| Document
			| undefined;
		const focused = tree?.activeElement;
		const navigationKey = [
			"ArrowLeft",
			"ArrowRight",
			"ArrowUp",
			"ArrowDown",
			"Home",
			"End",
		].includes(event.key);
		const practiceControl =
			practiceRoot?.isConnected &&
			focused instanceof HTMLElement &&
			practiceRoot.contains(focused) &&
			focused.closest(".tour-practice-panel") &&
			!focused.closest("[inert]") &&
			!focused.matches(":disabled, [aria-disabled=true]");
		if (practiceControl && navigationKey) {
			if (focused instanceof HTMLInputElement && focused.type === "range") {
				event.stopImmediatePropagation();
				return;
			}
			if (tree instanceof ShadowRoot) {
				consume(event);
				// Replay only within the extension's shadow tree. Existing React
				// radiogroup/layout handlers run, but provider listeners never see it.
				focused.dispatchEvent(
					new KeyboardEvent("keydown", {
						key: event.key,
						code: event.code,
						altKey: event.altKey,
						ctrlKey: event.ctrlKey,
						metaKey: event.metaKey,
						shiftKey: event.shiftKey,
						repeat: event.repeat,
						bubbles: true,
						cancelable: true,
						composed: false,
					}),
				);
				return;
			}
		}
		consume(event);
		window.dispatchEvent(
			new CustomEvent(PLAYER_INTRODUCTION_KEY_EVENT, { detail: event }),
		);
	};
	const up = (event: KeyboardEvent) => {
		if (held.delete(event.code || event.key) || active()) consume(event);
	};
	const press = (event: KeyboardEvent) => {
		if (active() && isTextEditingKey(event)) event.stopImmediatePropagation();
		else if (active() || held.has(event.code || event.key)) consume(event);
	};
	const clear = () => held.clear();
	window.addEventListener("keydown", down, true);
	window.addEventListener("keyup", up, true);
	window.addEventListener("keypress", press, true);
	window.addEventListener("blur", clear);
	return () => {
		window.removeEventListener("keydown", down, true);
		window.removeEventListener("keyup", up, true);
		window.removeEventListener("keypress", press, true);
		window.removeEventListener("blur", clear);
		clear();
	};
}
