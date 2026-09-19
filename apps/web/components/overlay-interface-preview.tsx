"use client";

import { useState } from "react";
import { InterfaceSettingsPanel } from "../../extension/src/overlay-interface-settings";
import {
	getDefaultInterfacePreferences,
	updateInterfacePreferences,
} from "../../extension/src/interface-preferences";

/** The real extension control, with preferences held only in this example. */
export function OverlayInterfaceShowcase() {
	const [preferences, setPreferences] = useState(
		getDefaultInterfacePreferences,
	);
	return (
		<InterfaceSettingsPanel
			ready
			saving={false}
			error={null}
			preferences={preferences}
			onChange={(patch) =>
				setPreferences((current) => updateInterfacePreferences(current, patch))
			}
		/>
	);
}
