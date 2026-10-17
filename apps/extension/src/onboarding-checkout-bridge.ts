import {
	ONBOARDING_CHECKOUT_OPEN,
	ONBOARDING_RETURN,
} from "@anidachi/protocol";
import { getStoredAuthTokens } from "./auth-tokens";
import { WEB_HTTP_BASE } from "./constants";
import {
	createOnboardingCheckoutReturn,
	probeOnboardingTab,
} from "./onboarding-checkout-return";

export function registerOnboardingCheckoutBridge() {
	const returns = createOnboardingCheckoutReturn({
		extensionId: chrome.runtime.id,
		origins: [new URL(WEB_HTTP_BASE).origin],
		storage: chrome.storage.session,
		owner: async () => (await getStoredAuthTokens())?.user.id ?? null,
		open: (url) => chrome.tabs.create({ url, active: true }),
		probe: probeOnboardingTab,
		canReturn: async (sender) => {
			if (!Number.isInteger(sender.tab?.id)) return false;
			const tab = await chrome.tabs.get(sender.tab!.id!);
			if (
				!tab.active ||
				tab.discarded ||
				tab.status === "loading" ||
				tab.url !== sender.url
			)
				return false;
			return (await chrome.windows.get(tab.windowId)).focused;
		},
		focus: async (tabId) => {
			const tab = await chrome.tabs.update(tabId, { active: true });
			if (!tab) throw new Error("Video tab is unavailable");
			if (tab.windowId !== undefined)
				await chrome.windows.update(tab.windowId, { focused: true });
		},
	});
	chrome.runtime.onMessage.addListener((message, sender, respond) => {
		if (message?.type !== ONBOARDING_CHECKOUT_OPEN) return false;
		void returns
			.open(message, sender)
			.then(respond, () => respond({ opened: false }));
		return true;
	});
	// A live port binds the request to this exact website document. Reload,
	// navigation or React cleanup disconnects it, including same-URL reloads.
	chrome.runtime.onConnectExternal?.addListener((port) => {
		if (port.name !== ONBOARDING_RETURN || !port.sender) return;
		let alive = true;
		let received = false;
		port.onDisconnect.addListener(() => {
			alive = false;
		});
		port.onMessage.addListener((message) => {
			if (received) return;
			received = true;
			const respond = (result: { returned: boolean }) => {
				if (alive) {
					try {
						port.postMessage(result);
					} catch {
						/* Website closed. */
					}
				}
			};
			void returns
				.complete(message, port.sender!, () => alive)
				.then(respond, () => respond({ returned: false }));
		});
	});
}
