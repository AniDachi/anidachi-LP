import { createHash } from "node:crypto";

export type ExtensionChannel = "local" | "staging" | "production";

export function resolveExtensionChannel(
  value: string | undefined,
): ExtensionChannel {
  if (value === undefined) return "local";
  if (value === "local" || value === "staging" || value === "production") {
    return value;
  }
  throw new Error(`Unsupported WXT_EXTENSION_CHANNEL: ${value}`);
}

export const LOCAL_EXTENSION_MANIFEST_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArdb3yWhwaq8CTVKGA3X+DpMU4WsXvWqRegTLEtOVmEINxuDNadym/K01l9mlMwkDFux9mwa3K4Vn0jW/IrBbCjVEoocmzLPZOh5sMrqhtFtboj+hHEdfKjqXZaTAzenCJzarIHQT/rOKfV+sRGjCbaxPzb2svOswUlYa7aHOsM1XYybNXfVsj4uw87iWjSwU66Q9/RfL5sGV6qq24ZZy6qlmlibwAea+2ZzUwbvAOOvqhenG4AdhWhLKVnHa1+9PkYWrfJu9ifQW+l+HkpoKQQ82zKEXaU9nn1A1cn5D51eryWg1qA9OGEnj6yISBfyF7LFk5Kl+/qQWV2D0PsclYQIDAQAB";
export const STAGING_EXTENSION_MANIFEST_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmGnHyF+eB7g2WFus9eJkTJbaLBEurgFoMb9iJ5QYU0X7pNcx66ZnOHaa4gsNT5auQVXZxwejwUwBqr/pko/e3kSxZPWV9/UUFkvUTkhGxnge14Dt2G9JFV4LqmdSQu4U+DPVpQ2rCDGuhXL/11oeJKTjk0l9MG21V5FknwftQe+xYbwUIzeOeIFdkhkeGMGLPwJZxRH1QmkmHWU4SuPN9BEeyst9kd9ynpEhD+ki8vw1qpTUCPFJFDgAaHD7Ea/MdLxK3iZQq91gPtOCzTAy9Ar411atlnIIYATcESz3D8z8Pnoi3wuXK/YekMZYrR2/rSH6ArBaUxUuziJ1DXUeKwIDAQAB";

export function deriveChromiumExtensionId(manifestKey: string): string {
  const digest = createHash("sha256")
    .update(Buffer.from(manifestKey, "base64"))
    .digest()
    .subarray(0, 16);
  return Array.from(digest, (byte) =>
    [byte >> 4, byte & 0x0f]
      .map((nibble) => String.fromCharCode("a".charCodeAt(0) + nibble))
      .join(""),
  ).join("");
}

export const LOCAL_EXTENSION_ID = deriveChromiumExtensionId(
  LOCAL_EXTENSION_MANIFEST_KEY,
);
export const STAGING_EXTENSION_ID = deriveChromiumExtensionId(
  STAGING_EXTENSION_MANIFEST_KEY,
);

export function getExtensionManifestKey(
  channel: ExtensionChannel,
): string | undefined {
  if (channel === "local") return LOCAL_EXTENSION_MANIFEST_KEY;
  if (channel === "staging") return STAGING_EXTENSION_MANIFEST_KEY;
  return undefined;
}
