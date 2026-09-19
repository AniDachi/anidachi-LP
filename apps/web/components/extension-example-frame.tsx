"use client";

import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { overlayStyles } from "../../extension/src/styles";

// Only framing differs from the player. All controls retain the extension CSS.
// Never mount OverlayApp here: these examples have no room, storage or devices.
const framing = `
  :host { display:block; width:100%; max-width:324px; min-width:0; color-scheme:dark; }
  :host([data-example-width="composer"]) { max-width:430px; }
  .anidachi-overlay { position:relative; inset:auto; z-index:0; pointer-events:auto; container-type:inline-size; }
  .mini-panel { position:relative; inset:auto; width:100%; max-height:none; overflow:visible; box-shadow:none; backdrop-filter:none; }
  .settings-section-title { margin-top:0; padding-top:0; border-top:0; }
  .settings-category-scroll::before { display:none; }
  .settings-category-tab.active::after { content:""; position:absolute; bottom:0; left:0; right:0; height:2px; border-radius:2px; background:#ff8a3d; }
  .example-stage { position:relative; min-height:128px; overflow:hidden; border:1px solid var(--ad-border); border-radius:18px; background:linear-gradient(145deg,#1a181c,#0b0b0d); }
  .example-stage .top-bubble { position:absolute; top:12px; right:12px; }
  .example-player-label { position:absolute; left:16px; bottom:16px; color:var(--ad-muted); font-size:11px; line-height:1; }
  .example-composer { padding:16px; border:1px solid var(--ad-border); border-radius:18px; background:var(--ad-panel); }
  .example-composer .message-composer { position:relative; inset:auto; width:100%; margin:0; }
  .example-shortcut { margin:12px 0 0; text-align:center; color:var(--ad-muted); font-size:11px; line-height:1.5; }
  .example-shortcut kbd { color:var(--ad-text); font:inherit; font-weight:650; }
  .example-highlight { outline:1px solid rgba(255,173,99,.65); outline-offset:3px; }
  .example-static { pointer-events:none; }
  .example-static .panel-actions { margin-bottom:0; }
  .example-stack { display:grid; gap:12px; }
  @container (max-width: 319px) {
    .reaction-shortcut-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); justify-items:center; gap:8px 3px; }
  }
`;

export function ExtensionExampleFrame({
	children,
	label,
	width = "panel",
}: {
	children: ReactNode;
	label: string;
	width?: "panel" | "composer";
}) {
	const [shadow, setShadow] = useState<ShadowRoot | null>(null);
	const attach = useCallback((host: HTMLDivElement | null) => {
		if (host) setShadow(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
	}, []);
	return (
		<div
			ref={attach}
			data-extension-example
			data-example-width={width}
			role="group"
			aria-label={label}
		>
			{shadow &&
				createPortal(
					<>
						<style>
							{overlayStyles}
							{framing}
						</style>
						<div className="anidachi-overlay">{children}</div>
					</>,
					shadow,
				)}
		</div>
	);
}

export function ExtensionSettingsExample({
	active,
	children,
}: {
	active: string;
	children: ReactNode;
}) {
	return (
		<ExtensionExampleFrame label={`${active} settings example`}>
			<div className="mini-panel">
				<div className="section-title settings-section-title">
					<Settings2 size={15} aria-hidden />
					<span>Settings</span>
				</div>
				<div className="settings-shell">
					<div className="settings-category-rail" aria-hidden="true">
						<div className="settings-category-scroll">
							{["Reactions", "Layout", "Interface", "Voice", "Room"].map(
								(tab) => (
									<span
										key={tab}
										className={`settings-category-tab${tab === active ? " active" : ""}`}
									>
										{tab}
									</span>
								),
							)}
						</div>
					</div>
					<div className="settings-panel">{children}</div>
				</div>
			</div>
		</ExtensionExampleFrame>
	);
}
