import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Anidachi Local MVP",
    description: "Ambient watch-party overlay for local Anidachi MVP testing.",
    permissions: ["storage", "clipboardWrite", "identity"],
    host_permissions: [
      "http://127.0.0.1/*",
      "http://localhost/*",
      "http://*/*",
      "https://*/*",
      "file:///*",
    ],
    action: {
      default_title: "Anidachi",
    },
  },
});
