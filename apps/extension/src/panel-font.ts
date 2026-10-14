import interFont from "./assets/fonts/InterVariable.woff2?inline";

const loads = new WeakMap<Document, Promise<void>>();

/** A bundled face also works inside the player's shadow root, without a CDN. */
export function loadPanelFont(doc: Document): Promise<void> {
	const existing = loads.get(doc);
	if (existing) return existing;
	if (!doc.fonts || typeof FontFace === "undefined") return Promise.resolve();
	const load = (async () => {
		try {
			const bytes = Uint8Array.from(atob(interFont.split(",")[1]), (char) =>
				char.charCodeAt(0),
			);
			const face = new FontFace("AniDachi Panel", bytes, {
				weight: "100 900",
				style: "normal",
				display: "swap",
			});
			await face.load();
			doc.fonts.add(face);
		} catch {
			// Keep the readable system fallback if font loading is unavailable.
			loads.delete(doc);
		}
	})();
	loads.set(doc, load);
	return load;
}
