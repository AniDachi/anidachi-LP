import { defineConfig } from "wxt";

type ExtensionChannel = "local" | "staging" | "production";

function getExtensionChannel(): ExtensionChannel {
  const channel = process.env.WXT_EXTENSION_CHANNEL;
  if (channel === "staging" || channel === "production") return channel;
  return "local";
}

const extensionChannel = getExtensionChannel();
const extensionName =
  extensionChannel === "production"
    ? "Anidachi"
    : extensionChannel === "staging"
      ? "Anidachi Staging"
      : "Anidachi Local MVP";
const extensionDescription =
  extensionChannel === "production"
    ? "Ambient watch-party overlay for watching online video together."
    : extensionChannel === "staging"
      ? "Internal Anidachi staging build for testing watch rooms before production."
      : "Ambient watch-party overlay for local Anidachi MVP testing.";
const extensionVersion = process.env.WXT_EXTENSION_VERSION ?? "0.1.0";
const buildId = process.env.WXT_BUILD_ID?.trim();

export default defineConfig({
  manifest: {
    name: extensionName,
    short_name: "Anidachi",
    description: extensionDescription,
    version: extensionVersion,
    ...(buildId ? { version_name: buildId } : {}),
    permissions: ["storage", "clipboardWrite", "identity"],
    host_permissions: [
      "http://127.0.0.1/*",
      "http://localhost/*",
      "http://*/*",
      "https://*/*",
      "file:///*",
    ],
    action: {
      default_title: extensionName,
    },
  },
});
