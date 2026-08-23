import {
	canonicalizeRoomSourceUrl,
	isLegacyRoomSourceFingerprintAlias,
	type RoomSourceProvider,
	type WatchSourceDescriptor,
} from "@anidachi/protocol";
import type {
	EnsureSourceResult,
	SourceAdapterDefinition,
	SourceNavigationContext,
	SourceProvider,
} from "./types";

type DefinitionLookup = (
	provider: SourceProvider,
) => SourceAdapterDefinition | null;

type CanonicalSourceNavigationResult =
	| { ok: true; alreadyCurrent: boolean; target: URL }
	| {
			ok: false;
			reason: "provider-mismatch" | "invalid-source" | "unsupported-route";
	  };

export function resolveCanonicalSourceNavigation(
	source: WatchSourceDescriptor,
	currentHref: string,
	provider: RoomSourceProvider,
): CanonicalSourceNavigationResult {
	if (source.provider !== provider) {
		return { ok: false, reason: "provider-mismatch" };
	}

	const sourceUrl = canonicalizeRoomSourceUrl(source.sourceUrl, provider);
	const canonicalUrl = canonicalizeRoomSourceUrl(source.canonicalUrl, provider);
	if (!sourceUrl.ok) return navigationRejection(sourceUrl.code);
	if (!canonicalUrl.ok) return navigationRejection(canonicalUrl.code);
	if (
		sourceUrl.source.canonicalUrl !== canonicalUrl.source.canonicalUrl ||
		sourceUrl.source.videoFingerprint !== canonicalUrl.source.videoFingerprint ||
		(
			source.videoFingerprint !== sourceUrl.source.videoFingerprint &&
			!isLegacyRoomSourceFingerprintAlias(source.sourceUrl, source.videoFingerprint)
		)
	) {
		return { ok: false, reason: "invalid-source" };
	}

	const current = canonicalizeRoomSourceUrl(currentHref, provider);
	return {
		ok: true,
		alreadyCurrent:
			current.ok && current.source.canonicalUrl === sourceUrl.source.canonicalUrl,
		target: new URL(sourceUrl.source.canonicalUrl),
	};
}

function navigationRejection(
	code: Exclude<ReturnType<typeof canonicalizeRoomSourceUrl>, { ok: true }>["code"],
): Extract<CanonicalSourceNavigationResult, { ok: false }> {
	if (code === "PROVIDER_MISMATCH" || code === "UNSUPPORTED_PROVIDER") {
		return { ok: false, reason: "provider-mismatch" };
	}
	if (code === "UNSUPPORTED_ROUTE") {
		return { ok: false, reason: "unsupported-route" };
	}
	return { ok: false, reason: "invalid-source" };
}

export async function ensureSourceForProvider(
	source: WatchSourceDescriptor,
	context: SourceNavigationContext,
	getDefinition: DefinitionLookup,
): Promise<EnsureSourceResult> {
	if (
		source.provider !== context.roomProvider ||
		context.signal.aborted
	) {
		return context.signal.aborted
			? { status: "failed", reason: "navigation-failed" }
			: { status: "unsupported", reason: "provider-mismatch" };
	}

	const definition = getDefinition(context.roomProvider);
	if (!definition || definition.provider !== source.provider) {
		return { status: "unsupported", reason: "provider-mismatch" };
	}

	return definition.ensureSource(source, context);
}

export function ensureGenericSource(
	source: WatchSourceDescriptor,
	context: SourceNavigationContext,
	currentHref: string = location.href,
): Promise<EnsureSourceResult> {
	if (
		source.provider !== "generic" ||
		context.roomProvider !== "generic"
	) {
		return Promise.resolve({
			status: "unsupported",
			reason: "provider-mismatch",
		});
	}
	if (context.signal.aborted) {
		return Promise.resolve({
			status: "failed",
			reason: "navigation-failed",
		});
	}

	try {
		const current = new URL(currentHref);
		const target = new URL(source.canonicalUrl);
		if (
			current.origin === target.origin &&
			current.pathname === target.pathname &&
			current.search === target.search
		) {
			return Promise.resolve({ status: "already-current" });
		}
	} catch {
		return Promise.resolve({
			status: "unsupported",
			reason: "invalid-source",
		});
	}

	return Promise.resolve({
		status: "unsupported",
		reason: "unsupported-route",
	});
}

export function withRoomHash(url: URL, roomId: string | null): string {
	url.hash = "";
	if (roomId) {
		url.hash = new URLSearchParams({ anidachiRoom: roomId }).toString();
	}
	return url.toString();
}
