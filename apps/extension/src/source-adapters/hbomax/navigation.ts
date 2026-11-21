import type { WatchSourceDescriptor } from "@anidachi/protocol";
import { observeHboMaxRoomSource } from "./metadata";
import { resolveCanonicalSourceNavigation, withRoomHash } from "../core/source-navigation";
import type { EnsureSourceResult, SourceNavigationContext } from "../core/types";

export async function ensureHboMaxSource(
  source: WatchSourceDescriptor,
  context: SourceNavigationContext,
): Promise<EnsureSourceResult> {
  if (context.signal.aborted) return { status: "failed", reason: "navigation-failed" };
  if (context.roomProvider !== "hbomax" || location.origin !== "https://www.hbomax.com") {
    return { status: "unsupported", reason: "provider-mismatch" };
  }
  const navigation = resolveCanonicalSourceNavigation(source, location.href, "hbomax");
  if (!navigation.ok) return { status: "unsupported", reason: navigation.reason };
  observeHboMaxRoomSource(document, source);
  if (navigation.alreadyCurrent) return { status: "already-current" };
  const targetUrl = withRoomHash(navigation.target, context.roomId);
  try {
    location.assign(targetUrl);
    return { status: "navigation-started", targetUrl };
  } catch {
    return { status: "failed", reason: "navigation-failed" };
  }
}
