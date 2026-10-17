import "../src/zod-csp";
import { defineContentScript } from "wxt/utils/define-content-script";
import { startNetflixBridge } from "../src/source-adapters/netflix/main-bridge";

export default defineContentScript({
	matches: ["https://www.netflix.com/*"],
	allFrames: false,
	runAt: "document_start",
	world: "MAIN",
	main() {
		const key = "__anidachiNetflixBridgeDispose";
		const previous = Reflect.get(window, key);
		if (typeof previous === "function") previous();
		let stop = startNetflixBridge();
		const resume = (event: PageTransitionEvent) => {
			if (event.persisted) {
				stop();
				stop = startNetflixBridge();
			}
		};
		window.addEventListener("pageshow", resume);
		Reflect.set(window, key, () => {
			stop();
			window.removeEventListener("pageshow", resume);
		});
	},
});
