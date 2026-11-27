import { defineContentScript } from "wxt/utils/define-content-script";
import { catalogPath, disneyPlaybackPortraits, portraitEvent } from "../src/disney-playback-portrait";

export default defineContentScript({
  matches: ["https://www.disneyplus.com/*"],
  exclude: import.meta.env.WXT_EXTENSION_CHANNEL === "production" ? ["chrome"] : [],
  runAt: "document_start",
  world: "MAIN",
  main() {
    const read = disneyPlaybackPortraits();
    XMLHttpRequest.prototype.open = new Proxy(XMLHttpRequest.prototype.open, {
      apply(open, xhr: XMLHttpRequest, args) {
        const result = Reflect.apply(open, xhr, args);
        const url = URL.parse(String(args[1]), location.href);
        const path = url?.origin === "https://disney.api.edge.bamgrid.com" && catalogPath.exec(url.pathname)?.[1];
        if (path) xhr.addEventListener("loadend", () => {
          if (xhr.status !== 200 || xhr.responseURL !== url.href) return;
          try {
            const response = xhr.responseType === "json" ? xhr.response : JSON.parse(xhr.responseText);
            const card = response?.data && read(path, response.data);
            if (card) window.postMessage({ type: portraitEvent, card }, location.origin);
          } catch { /* Artwork is optional on Disney catalog responses. */ }
        }, { once: true });
        return result;
      },
    });
  },
});
