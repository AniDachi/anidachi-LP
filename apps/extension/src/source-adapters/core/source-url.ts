import { MAX_URL_CHARS, MAX_VIDEO_FINGERPRINT_CHARS } from "@anidachi/protocol";

export function normalizeVideoFingerprint(rawFingerprint: string): string {
  if (rawFingerprint.length <= MAX_VIDEO_FINGERPRINT_CHARS) {
    return rawFingerprint;
  }

  const typePrefix = rawFingerprint.match(/^([^|]{1,32})\|/)?.[1] ?? "video";
  return `${typePrefix}|hash:${stableFingerprintHash(rawFingerprint)}`;
}

function stableFingerprintHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hash ^= BigInt(code & 0xff);
    hash = BigInt.asUintN(64, hash * prime);
    hash ^= BigInt(code >>> 8);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(36);
}

export function canonicalWatchSourceUrl(value: string): string | null {
  if (value.length > MAX_URL_CHARS) {
    return null;
  }

  try {
    const url = new URL(value, location.href);
    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    params.delete("anidachiRoom");
    url.hash = params.toString();
    const normalized = url.toString();
    return normalized.length <= MAX_URL_CHARS ? normalized : null;
  } catch {
    return null;
  }
}
