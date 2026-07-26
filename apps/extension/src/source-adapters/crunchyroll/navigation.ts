import type { WatchSourceDescriptor } from "@anidachi/protocol";
import { withRoomHash } from "../core/source-navigation";
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

		const target = validateCrunchyrollSource(source);
		if (!target.ok) {
			return { status: "unsupported", reason: target.reason };
		}

		const targetUrl = withRoomHash(target.url, context.roomId);
		if (isSameDocument(environment.currentHref(), targetUrl)) {
			return { status: "already-current" };
		}

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

function validateCrunchyrollSource(
	source: WatchSourceDescriptor,
):
	| { ok: true; url: URL }
	| {
			ok: false;
			reason: "provider-mismatch" | "invalid-source" | "unsupported-route";
	  } {
	let sourceUrl: URL;
	let canonicalUrl: URL;
	try {
		sourceUrl = new URL(source.sourceUrl);
		canonicalUrl = new URL(source.canonicalUrl);
	} catch {
		return { ok: false, reason: "invalid-source" };
	}

	if (
		!isCrunchyrollHost(sourceUrl.hostname) ||
		!isCrunchyrollHost(canonicalUrl.hostname)
	) {
		return { ok: false, reason: "provider-mismatch" };
	}

	const sourceKey = getCrunchyrollWatchKey(sourceUrl);
	const canonicalKey = getCrunchyrollWatchKey(canonicalUrl);
	if (!sourceKey || !canonicalKey) {
		return { ok: false, reason: "unsupported-route" };
	}
	if (
		sourceKey !== canonicalKey ||
		source.videoFingerprint !== `crunchyroll|watch/${canonicalKey}`
	) {
		return { ok: false, reason: "invalid-source" };
	}

	const target = new URL(canonicalUrl);
	target.protocol = "https:";
	return { ok: true, url: target };
}

function getCrunchyrollWatchKey(url: URL): string | null {
	return url.pathname.match(/^\/watch\/([^/?#]+)(?:\/|$)/)?.[1] ?? null;
}

function isCrunchyrollHost(hostname: string): boolean {
	const normalized = hostname.toLowerCase();
	return (
		normalized === "crunchyroll.com" ||
		normalized.endsWith(".crunchyroll.com")
	);
}

function isSameDocument(currentHref: string, targetUrl: string): boolean {
	try {
		const current = new URL(currentHref);
		const target = new URL(targetUrl);
		return (
			current.origin === target.origin &&
			current.pathname === target.pathname &&
			current.search === target.search
		);
	} catch {
		return false;
	}
}
