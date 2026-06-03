import type { NextRequest } from "next/server";

function firstCsvValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

/**
 * Best-effort "public" origin for redirects behind proxies.
 * Falls back to Next's parsed URL origin when proxy headers are absent.
 */
export function getPublicOrigin(request: NextRequest): string {
  // Standard header: Forwarded: proto=https;host=example.com
  const forwarded = request.headers.get("forwarded");
  if (forwarded) {
    const first = firstCsvValue(forwarded);
    if (first) {
      const proto = /(?:^|;\s*)proto=([^;]+)/i.exec(first)?.[1]?.trim();
      const host = /(?:^|;\s*)host=([^;]+)/i.exec(first)?.[1]?.trim();
      if (proto && host) return `${proto}://${host}`;
    }
  }

  const host =
    firstCsvValue(request.headers.get("x-forwarded-host")) ||
    request.headers.get("host");
  const proto =
    firstCsvValue(request.headers.get("x-forwarded-proto")) ||
    (request.nextUrl.protocol ? request.nextUrl.protocol.replace(/:$/, "") : null);

  if (host && proto) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

