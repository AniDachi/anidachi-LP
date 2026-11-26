import "../src/zod-csp";
import { HBO_MAX_BROWSER_HOSTS } from "@anidachi/protocol";
import { defineContentScript } from "wxt/utils/define-content-script";
import { startHboNativeCatalog } from "../src/source-adapters/hbomax/native-catalog";

export default defineContentScript({
	matches: HBO_MAX_BROWSER_HOSTS.map(host => `https://${host}/*`),
	allFrames: false,
	runAt: "document_start",
	world: "MAIN",
	main() {
		const key = "__anidachiHboCatalogDispose";
		const previous = Reflect.get(window, key);
		if (typeof previous === "function") previous();
		Reflect.set(window, key, startHboNativeCatalog(window));
	},
});
