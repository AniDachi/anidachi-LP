import { storage } from "wxt/utils/storage";
import { TrialInstallationRequestSchema } from "@anidachi/protocol";
import { WEB_HTTP_BASE } from "./constants";
import {
	createTrialInstallationSigner,
	isTrialWebsiteSender,
	TRIAL_INSTALLATION_STORAGE_KEY,
} from "./trial-installation";

export function registerTrialInstallationBridge() {
	const origins = [new URL(WEB_HTTP_BASE).origin];
	if (
		import.meta.env.WXT_EXTENSION_CHANNEL === "production" &&
		!origins.includes("https://www.anidachi.app")
	)
		origins.push("https://www.anidachi.app");
	const sign = createTrialInstallationSigner({
		get: () => storage.getItem(TRIAL_INSTALLATION_STORAGE_KEY),
		set: (value) => storage.setItem(TRIAL_INSTALLATION_STORAGE_KEY, value),
	});
	chrome.runtime.onMessageExternal?.addListener((message, sender, respond) => {
		if (!isTrialWebsiteSender(sender, origins)) return false;
		const parsed = TrialInstallationRequestSchema.safeParse(message);
		if (!parsed.success) return false;
		// Literal true is required for asynchronous replies on supported Chrome 121+.
		void sign(parsed.data.challenge).then(
			(proof) => respond({ proof }),
			() => respond({ unavailable: true }),
		);
		return true;
	});
}
