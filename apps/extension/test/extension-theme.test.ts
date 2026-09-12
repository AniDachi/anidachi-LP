import { describe, expect, it } from "vitest";
import { extensionThemeTokens } from "../src/extension-theme";
import { popupStyles } from "../src/popup-styles";
import { overlayStyles } from "../src/styles";

describe("extension theme tokens", () => {
	it("defines the semantic palette used by extension UI surfaces", () => {
		expect(extensionThemeTokens).toContain("--ad-canvas: #09090b;");
		expect(extensionThemeTokens).toContain("--ad-accent: #ff8a3d;");
		expect(extensionThemeTokens).toContain(
			"--ad-panel: rgba(10, 10, 12, 0.82);",
		);
		expect(extensionThemeTokens).toContain(
			"--ad-border: rgba(255, 255, 255, 0.12);",
		);
		expect(extensionThemeTokens).toContain(
			"--ad-text: rgba(255, 255, 255, 0.93);",
		);
	});

	it("injects the shared declarations into the overlay style bundle", () => {
		expect(overlayStyles).toContain(extensionThemeTokens.trim());
	});

	it("uses the shared warm graphite foundation in the Popup", () => {
		expect(popupStyles).toContain(extensionThemeTokens.trim());
		expect(popupStyles).toContain("background: var(--ad-canvas);");
		expect(popupStyles).toContain("border: 1px solid var(--ad-border);");
		expect(popupStyles).not.toContain("rgba(88, 166, 255, 0.11)");
		expect(popupStyles).not.toContain("rgba(87, 145, 255, 0.08)");
	});

});
