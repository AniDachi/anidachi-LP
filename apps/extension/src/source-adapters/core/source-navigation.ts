import type { WatchSourceDescriptor } from "@anidachi/protocol";
import type {
	EnsureSourceResult,
	SourceAdapterDefinition,
	SourceNavigationContext,
	SourceProvider,
} from "./types";

type DefinitionLookup = (
	provider: SourceProvider,
) => SourceAdapterDefinition | null;

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
