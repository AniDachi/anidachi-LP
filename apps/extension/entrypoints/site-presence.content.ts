import { defineContentScript } from "wxt/utils/define-content-script";
import {
  ANIDACHI_EXTENSION_PING,
  ANIDACHI_EXTENSION_PRESENT,
  isAnidachiExtensionPing,
} from "../src/site-presence";

const PRODUCTION_MATCHES = [
  "https://www.anidachi.app/*",
  "https://anidachi.app/*",
];

const STAGING_MATCHES = ["https://staging.anidachi.app/*"];

const LOCAL_MATCHES = [
  "http://localhost:3003/*",
  "http://127.0.0.1:3003/*",
];

const channel = import.meta.env.WXT_EXTENSION_CHANNEL;
const matches =
  channel === "production"
    ? PRODUCTION_MATCHES
    : channel === "staging"
      ? STAGING_MATCHES
      : [...LOCAL_MATCHES, ...STAGING_MATCHES, ...PRODUCTION_MATCHES];

export default defineContentScript({
  matches,
  allFrames: false,
  runAt: "document_start",
  main() {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (!isAnidachiExtensionPing(event.data)) return;
      window.postMessage(
        { type: ANIDACHI_EXTENSION_PRESENT, ping: ANIDACHI_EXTENSION_PING },
        "*",
      );
    });
  },
});
