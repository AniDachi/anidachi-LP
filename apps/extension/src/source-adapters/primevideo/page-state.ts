type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as RecordValue)
		: {};

export type PrimePageState = {
	states: RecordValue[];
	// The HTML canonical belongs to the initial load, not native SPA navigation.
	canonicalHref: string | null;
};

/** Only traverse React fiber links beneath the observed page root. Never walk
 * arbitrary app/account objects or serialize the surrounding provider context. */
function livePageState(root: HTMLElement): RecordValue[] | null {
	const keys = Object.keys(root).filter((key) =>
		key.startsWith("__reactContainer$"),
	);
	if (keys.length !== 1) return null;
	const current = record(record(Reflect.get(root, keys[0]!)).stateNode).current;
	if (!current || typeof current !== "object") return null;
	const queue = [record(current)],
		seen = new Set<object>();
	let states: RecordValue[] | null = null;
	for (let index = 0; index < queue.length; index++) {
		if (index >= 600) return null;
		const fiber = queue[index]!;
		if (seen.has(fiber)) continue;
		seen.add(fiber);
		const value = record(record(fiber.memoizedProps).value);
		const atf = record(value.atf).state,
			btf = record(value.btf).state;
		if (atf && btf && typeof atf === "object" && typeof btf === "object") {
			if (states && (states[0] !== atf || states[1] !== btf)) return null;
			states = [record(atf), record(btf)];
			// This is the page provider. Its descendants contain unrelated widgets.
		} else if (fiber.child && typeof fiber.child === "object") {
			queue.push(record(fiber.child));
		}
		if (fiber.sibling && typeof fiber.sibling === "object")
			queue.push(record(fiber.sibling));
	}
	return states;
}

/** MAIN reads the committed page context on every inspection, including same-URL
 * title swaps. Isolated-world/SSR readers retain the original HTML path. Public
 * identity, membership, title and availability validation stays in each parser. */
export function readPrimePageState(
	documentValue: Document,
): PrimePageState | null {
	const root = documentValue.getElementById("dv-web-page-hydration-root");
	if (
		root &&
		Object.keys(root).some((key) => key.startsWith("__reactContainer$"))
	) {
		const states = livePageState(root);
		if (!states) return null;
		const initial = readInitialPageState(documentValue);
		// A direct marketplace load may need its canonical ASIN alias. It remains
		// evidence only while both HTML collections identify this same live page.
		const samePage =
			initialDocumentRoute(documentValue) &&
			initial?.states.every(
				(state, index) =>
					typeof state.pageTitleId === "string" &&
					state.pageTitleId === states[index]?.pageTitleId,
			);
		return { states, canonicalHref: samePage ? initial!.canonicalHref : null };
	}
	return readInitialPageState(documentValue);
}

function initialDocumentRoute(documentValue: Document): boolean {
	try {
		const view = documentValue.defaultView;
		const navigation = view?.performance.getEntriesByType("navigation");
		if (!view || navigation?.length !== 1) return false;
		const initial = new URL(navigation[0]!.name);
		return (
			initial.origin === view.location.origin &&
			initial.pathname === view.location.pathname
		);
	} catch {
		return false;
	}
}

function readInitialPageState(documentValue: Document): PrimePageState | null {
	const raw = documentValue.getElementById(
		"dv-web-page-hydration-data",
	)?.textContent;
	if (!raw || raw.length > 8_000_000) return null;
	try {
		const body = record(
			record(record(record(JSON.parse(raw)).init).preparations).body,
		);
		return {
			states: [record(record(body.atf).state), record(record(body.btf).state)],
			canonicalHref:
				documentValue
					.querySelector('link[rel="canonical"]')
					?.getAttribute("href") ?? null,
		};
	} catch {
		return null;
	}
}
