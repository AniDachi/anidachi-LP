"use client";

import { useState } from "react";
import {
	OverlayLayoutEditor,
	type OverlayLayoutChatDisplayMode,
} from "../../extension/src/overlay-layout-editor";
import { getDefaultOverlayLayoutDefinition } from "../../extension/src/overlay-layout-model";
import type { OverlayLayoutContext } from "../../extension/src/overlay-layout-engine";

const context: OverlayLayoutContext = {
	cameraCount: 4,
	reservedRects: [],
	viewport: {
		width: 1280,
		height: 720,
		safeInsets: { top: 12, right: 12, bottom: 12, left: 12 },
	},
};
const ignorePreview = () => {};

/** Use the same layout bounds, sizing and controls as the installed extension. */
export function OverlayLayoutShowcase() {
	const [layout, setLayout] = useState(getDefaultOverlayLayoutDefinition);
	const [mode, setMode] = useState<OverlayLayoutChatDisplayMode>("live");
	return (
		<OverlayLayoutEditor
			appliedLayout={layout}
			layoutContext={context}
			chatDisplayMode={mode}
			onChatDisplayModeChange={setMode}
			onApply={async (next) => {
				setLayout(next);
			}}
			onPreviewChange={ignorePreview}
		/>
	);
}
