"use client";

import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { overlayStyles } from "../../extension/src/styles";

// Only framing differs from the player. All controls retain the extension CSS.
// Never mount OverlayApp here: these examples have no room, storage or devices.
const framing = `
  :host { display:block; min-width:0; color-scheme:dark; }
  .anidachi-overlay { position:relative; inset:auto; z-index:0; pointer-events:auto; }
  .mini-panel { position:relative; inset:auto; width:100%; max-height:none; overflow:visible; box-shadow:none; backdrop-filter:none; }
  .settings-section-title { margin-top:0; padding-top:0; border-top:0; }
  .settings-category-scroll::before { display:none; }
  .settings-category-tab.active::after { content:""; position:absolute; bottom:0; left:0; right:0; height:2px; border-radius:2px; background:#ff8a3d; }
  .example-stage { position:relative; min-height:144px; overflow:hidden; border:1px solid var(--ad-border); border-radius:18px; background:linear-gradient(145deg,#1a181c,#0b0b0d); }
  .example-stage .top-bubble { position:absolute; top:12px; right:12px; }
  .example-stage .message-composer { position:relative; inset:auto; margin:24px auto; }
  .example-shortcut { margin:18px 18px 0; color:var(--ad-muted); font-size:12px; }
  .example-shortcut kbd { color:var(--ad-text); font:inherit; font-weight:700; }
  .example-highlight { outline:2px solid #eee5d9; outline-offset:3px; }
  .example-static { pointer-events:none; }
  .example-static .panel-actions { margin-bottom:0; }
  .example-stack { display:grid; gap:12px; }
`;

export function ExtensionExampleFrame({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) {
	const [shadow, setShadow] = useState<ShadowRoot | null>(null);
	const attach = useCallback((host: HTMLDivElement | null) => {
		if (host) setShadow(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
	}, []);
	return (
		<div ref={attach} data-extension-example role="group" aria-label={label}>
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
