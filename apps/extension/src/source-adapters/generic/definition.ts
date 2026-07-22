import { findPlayerContainer } from "../core/video-discovery";
import type { SourceAdapterDefinition } from "../core/types";
import { GenericVideoAdapter } from "./adapter";

export const genericDefinition: SourceAdapterDefinition = {
  id: "generic-html5-video",
  provider: "generic",
  priority: 100,
  detect(video) {
    return new GenericVideoAdapter(video, findPlayerContainer(video));
  },
};
