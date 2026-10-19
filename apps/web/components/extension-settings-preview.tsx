import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import {
	SETTINGS_PANEL_CATEGORIES,
	type SettingsPanelCategory,
} from "../../extension/src/settings-panel-navigation";

/** A presentation-only shell; tab names and material match the live drawer. */
export function ExtensionSettingsPreview({
	active,
	children,
	layoutTabTarget = false,
}: {
	active: SettingsPanelCategory;
	children: ReactNode;
	layoutTabTarget?: boolean;
}) {
	return (
		<div className="settings-surface">
			<div className="section-title settings-section-title">
				<Settings2
					className="section-title-icon settings-section-title-icon"
					size={15}
					strokeWidth={1.8}
					aria-hidden="true"
				/>
				<span className="settings-section-title-label">Settings</span>
			</div>
			<div className="settings-shell">
				<div className="settings-category-rail" aria-hidden="true">
					<div
						className="settings-category-scroll"
						data-active-category={active}
					>
						{SETTINGS_PANEL_CATEGORIES.map(({ id, label }) => (
							<span
								key={id}
								className={`settings-category-tab${id === active ? " active" : ""}`}
								data-demo-target={
									layoutTabTarget && id === "layout" ? "layout-tab" : undefined
								}
							>
								{label}
							</span>
						))}
					</div>
				</div>
				<div className="settings-panel">{children}</div>
			</div>
		</div>
	);
}
