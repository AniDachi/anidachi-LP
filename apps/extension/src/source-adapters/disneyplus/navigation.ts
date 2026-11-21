import { resolveCanonicalSourceNavigation, withRoomHash } from "../core/source-navigation";
import type { EnsureSourceResult, SourceNavigationContext } from "../core/types";
import type { WatchSourceDescriptor } from "@anidachi/protocol";
import { isDisneyPlusOrigin, localizeDisneyPlusWatchUrl } from "./url";

export function createDisneyPlusSourceNavigator(environment: {
  currentHref(): string;
  assign(href: string): void;
}) {
  return async (source: WatchSourceDescriptor, context: SourceNavigationContext): Promise<EnsureSourceResult> => {
    if (context.signal.aborted) return { status: "failed", reason: "navigation-failed" };
    const currentHref = environment.currentHref();
    if (context.roomProvider !== "disneyplus" || !isDisneyPlusOrigin(currentHref)) {
      return { status: "unsupported", reason: "provider-mismatch" };
    }
    const navigation = resolveCanonicalSourceNavigation(source, currentHref, "disneyplus");
    if (!navigation.ok) return { status: "unsupported", reason: navigation.reason };
    if (navigation.alreadyCurrent) return { status: "already-current" };
    try {
      const targetUrl = withRoomHash(localizeDisneyPlusWatchUrl(navigation.target, currentHref), context.roomId);
      environment.assign(targetUrl);
      return { status: "navigation-started", targetUrl };
    } catch {
      return { status: "failed", reason: "navigation-failed" };
    }
  };
}

export const ensureDisneyPlusSource = createDisneyPlusSourceNavigator({
  currentHref: () => location.href,
  assign: (href) => location.assign(href),
});
