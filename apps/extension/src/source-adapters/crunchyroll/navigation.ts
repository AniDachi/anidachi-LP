import type { WatchSourceDescriptor } from "@anidachi/protocol";
import {
	resolveCanonicalSourceNavigation,
	withRoomHash,
} from "../core/source-navigation";
import type {
	EnsureSourceResult,
	SourceNavigationContext,
} from "../core/types";
import { runCrunchyrollMainCommand } from "./bridge-client";

interface CrunchyrollNavigationResult {
	ok: boolean;
	error?: string;
}

interface CrunchyrollNavigationEnvironment {
	assign(url: string): void;
	currentHref(): string;
	navigate(url: string): Promise<CrunchyrollNavigationResult>;
}

type CrunchyrollSourceNavigator = (
	source: WatchSourceDescriptor,
	context: SourceNavigationContext,
) => Promise<EnsureSourceResult>;

export function createCrunchyrollSourceNavigator(
	environment: CrunchyrollNavigationEnvironment,
): CrunchyrollSourceNavigator {
	return async (source, context) => {
		if (
			source.provider !== "crunchyroll" ||
			context.roomProvider !== "crunchyroll"
		) {
			return { status: "unsupported", reason: "provider-mismatch" };
		}
		if (context.signal.aborted) {
			return { status: "failed", reason: "navigation-failed" };
		}

		const navigation = resolveCanonicalSourceNavigation(
			source,
			environment.currentHref(),
			"crunchyroll",
		);
		if (!navigation.ok) {
			return { status: "unsupported", reason: navigation.reason };
		}
		if (navigation.alreadyCurrent) {
			return { status: "already-current" };
		}
		const targetUrl = withRoomHash(navigation.target, context.roomId);

		const result = await environment.navigate(targetUrl);
		if (context.signal.aborted) {
			return { status: "failed", reason: "navigation-failed" };
		}
		if (!result.ok) {
			try {
				environment.assign(targetUrl);
			} catch {
				return { status: "failed", reason: "navigation-failed" };
			}
		}
		return { status: "navigation-started", targetUrl };
	};
}

export const ensureCrunchyrollSource = createCrunchyrollSourceNavigator({
	assign: (url) => location.assign(url),
	currentHref: () => location.href,
	navigate: async (url) => runCrunchyrollMainCommand("navigate", { url }),
});
