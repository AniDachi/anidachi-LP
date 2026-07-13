const encoder = new TextEncoder();

export async function createPrivacySafeHmacId(
  secret: string | undefined,
  domain: string,
  parts: readonly string[],
): Promise<string> {
  if (!secret) {
    throw new Error("Privacy identifier secret is not configured");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode([domain, ...parts].join("\0")),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
