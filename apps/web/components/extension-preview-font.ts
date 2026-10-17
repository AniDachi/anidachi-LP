import localFont from "next/font/local";

// Same bundled Inter face as the drawer. Only preview surfaces use this font;
// preload is off so pages without a visible preview do not download it.
export const extensionPreviewFont = localFont({
	src: "../../extension/src/assets/fonts/InterVariable.woff2",
	variable: "--font-anidachi-panel",
	display: "swap",
	preload: false,
});
