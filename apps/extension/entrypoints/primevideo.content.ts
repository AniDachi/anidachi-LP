import "../src/zod-csp";
import { defineContentScript } from "wxt/utils/define-content-script";
import { startPrimeBridge } from "../src/source-adapters/primevideo/main-bridge";
export default defineContentScript({
  matches: ["https://www.primevideo.com/*"], allFrames: false, runAt: "document_start", world: "MAIN",
  main() {
    const key = "__anidachiPrimeVideoBridgeDispose", previous = Reflect.get(window, key);
    if (typeof previous === "function") previous();
    let stop = startPrimeBridge();
    const resume = (event: PageTransitionEvent) => { if (event.persisted) { stop(); stop = startPrimeBridge(); } };
    window.addEventListener("pageshow", resume);
    Reflect.set(window, key, () => { stop(); window.removeEventListener("pageshow", resume); });
  },
});
