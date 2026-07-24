import { findPlayerContainer } from "../core/video-discovery";
import { ensureGenericSource } from "../core/source-navigation";
import type { SourceAdapterDefinition } from "../core/types";
import { GenericVideoAdapter } from "./adapter";

export const genericDefinition: SourceAdapterDefinition = {
  id: "generic-html5-video",
  provider: "generic",
  priority: 100,
  ensureSource: (source, context) => ensureGenericSource(source, context),
  detect(video) {
    return new GenericVideoAdapter(video, findPlayerContainer(video));
  },
};
