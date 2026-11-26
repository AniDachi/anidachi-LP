import { defineContentScript } from "wxt/utils/define-content-script";
import { listenDisneyTransport } from "../src/source-adapters/disneyplus/native-player";

export default defineContentScript({
  matches: ["https://www.disneyplus.com/*"],
  exclude: import.meta.env.WXT_EXTENSION_CHANNEL === "production" ? ["chrome"] : [],
  runAt: "document_start",
  world: "MAIN",
  main() {
    const key = "__anidachiDisneyTransportDispose";
    const previous = Reflect.get(window, key);
    if (typeof previous === "function") previous();
    Reflect.set(window, key, listenDisneyTransport(document));
  },
});
