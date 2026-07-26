import type {
	SourceAdapterDefinition,
	SourceProvider,
	VideoAdapter,
} from "./core/types";
import { findBestVideo } from "./core/video-discovery";
import { crunchyrollDefinition } from "./crunchyroll/definition";
import { genericDefinition } from "./generic/definition";
import { youtubeDefinition } from "./youtube/definition";

const sourceAdapterDefinitions = [
	youtubeDefinition,
	crunchyrollDefinition,
	genericDefinition,
] as const satisfies readonly SourceAdapterDefinition[];

export function detectSourceAdapter(
	documentValue: Document = document,
): VideoAdapter | null {
	const winner = findBestVideo(documentValue);
	if (!winner) {
		return null;
	}

	for (const definition of sourceAdapterDefinitions) {
		const adapter = definition.detect(winner);
		if (adapter) {
			return adapter;
		}
	}

	return null;
}

export function getDefinitionForProvider(
	provider: SourceProvider,
): SourceAdapterDefinition | null {
	return (
		sourceAdapterDefinitions.find(
			(definition) => definition.provider === provider,
		) ?? null
	);
}
