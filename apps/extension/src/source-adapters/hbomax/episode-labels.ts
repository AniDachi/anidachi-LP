// Normalize only ordinal text. Titles must keep the provider's original script and punctuation.
const decimalDigit = /\p{Nd}/u;
const hanDigits = "零一二三四五六七八九";
function hanOrdinal(text: string): string {
	const digits = text.replace(/〇/gu, "零").replace(/[兩两]/gu, "二");
	if (!/[十百千]/u.test(digits)) return Array.from(digits, digit => String(hanDigits.indexOf(digit))).join("");
	if (!/^([一二三四五六七八九]?千)?零?([一二三四五六七八九]?百)?零?([一二三四五六七八九]?十)?[零一二三四五六七八九]?$/u.test(digits)) return text;
	let total = 0, current = 0;
	for (const digit of digits) {
		const place = digit === "千" ? 1000 : digit === "百" ? 100 : digit === "十" ? 10 : 0;
		if (place) { total += (current || 1) * place; current = 0; }
		else current = hanDigits.indexOf(digit);
	}
	return String(total + current);
}
function numericText(value: string) {
	return value.normalize("NFKC").toLowerCase().replace(/\p{Bidi_Control}/gu, "")
		.replace(/\p{Nd}/gu, digit => {
			if (/^[0-9]$/u.test(digit)) return digit;
			// Each Unicode decimal set is a contiguous sequence from zero to nine.
			const point = digit.codePointAt(0)!;
			let start = point;
			while (decimalDigit.test(String.fromCodePoint(start - 1))) start--;
			return String((point - start) % 10);
		})
		.replace(/[〇零一二兩两三四五六七八九十百千]+(?=[季集話话回])/gu, hanOrdinal);
}
function ordinal(text: string | undefined) {
	const value = Number(text);
	return Number.isInteger(value) && value > 0 && value <= 1000 ? value : null;
}
export function seasonOrdinal(label: string) {
	const numbers = numericText(label).match(/[0-9]+/gu);
	return numbers?.length === 1 ? ordinal(numbers[0]) : null;
}

// The catalog supplies its own season terminology. These markers also disambiguate
// compact player labels on a direct watch link, where there may be no local catalog.
const seasonWords = "s t season saison staffel stagione temporada sezon seizoen säsong sæson sesong kausi évad série řada sezóna " +
	"sezón séria sezonas sezonul сезон сезону сезона " +
	"mùa musim ซีซัน ซีซันที่ ซีซั่น ซีซั่นที่ ฤดูกาลที่ الموسم موسم עונה σεζόν κύκλος " +
	"シーズン 季 第季 시즌 제시즌";
const seasonMarkers = new Set(seasonWords.split(" "));
const episodeWords = "e ep episode épisode episodio episódio folge puntata odc odcinek afl aflevering avsnitt afsnit " +
	"avsn jakso rész díl diel epizoda epizóda epizód bölüm episod episodi osa " +
	"эп эпизод епізод серия серія серії capítulo capítol tập ตอน ตอนที่ الحلقة حلقة פרק επεισόδιο " +
	"話 话 集 回 第話 第话 第集 第回 エピソード 화 회 제화 제회";
const episodeMarkers = new Set(episodeWords.split(" "));
function tokens(text: string) {
	return numericText(text).match(/[0-9]+|\p{Script=Han}|[\p{L}\p{M}]+/gu) ?? [];
}
function shape(parts: string[]) { return parts.map(part => /^\d/u.test(part) ? "#" : part).join(""); }
function role(parts: string[], seasonShape: string) {
	const form = shape(parts);
	const marker = form.replace("#", "");
	if (!marker) return null;
	if (form === seasonShape || seasonMarkers.has(marker)) return "season";
	if (episodeMarkers.has(marker)) return "episode";
	return "unknown";
}
function firstRole(parts: string[], seasonShape: string, actionPrefix: boolean) {
	// The first segment on a tile may begin with a translated "Watch". Prefer
	// a recognized role after that action to interpreting the whole phrase as unknown.
	const end = actionPrefix ? parts.findIndex(part => /^\d/u.test(part)) : 0;
	for (let start = 0; start <= end; start++) {
		const candidate = parts.slice(start);
		const kind = role(candidate, seasonShape);
		if (kind === "season" || kind === "episode") return { kind, selected: shape(candidate) === seasonShape };
	}
	return { kind: role(parts, seasonShape), selected: false };
}

export function episodeCoordinates(value: string | null, seasonTitle?: string | null, actionPrefix = false) {
	if (!value || value.length > 500) return null;
	const parts = tokens(value);
	if (parts.length > 32) return null;
	const numbers = parts.flatMap((part, index) => /^\d/u.test(part) ? [index] : []);
	if (numbers.length !== 2) return null;
	const [a, b] = numbers as [number, number];
	const first = ordinal(parts[a]), second = ordinal(parts[b]);
	if (!first || !second) return null;
	const seasonShape = seasonTitle ? shape(tokens(seasonTitle)) : "";
	const orders = new Set<"first" | "second">();
	for (let split = a + 1; split <= b; split++) {
		const right = parts.slice(split);
		const rightRole = role(right, seasonShape);
		const left = firstRole(parts.slice(0, split), seasonShape, actionPrefix);
		if (left.kind === "season" && (rightRole === "episode" || (rightRole === "unknown" && left.selected))) orders.add("first");
		if (rightRole === "season" && (left.kind === "episode" || (left.kind === "unknown" && shape(right) === seasonShape))) orders.add("second");
	}
	if (orders.size !== 1) return null;
	return orders.has("first") ? { season: first, episode: second } : { season: second, episode: first };
}

// HBO displays a numbered primary title on most cards. A plain title, including a
// numerical one, can also be accepted when it is repeated after the accessible coordinates.
export function catalogEpisode(primary: string | null, accessible: string | null, seasonTitle: string, seasonNumber: number, menu: boolean) {
	if (!primary) return null;
	const dotted = /^([\p{Nd}]+)\s*[.．、۔)]\s*(.+)$/u.exec(primary);
	const number = dotted && ordinal(numericText(dotted[1]));
	const numbered = dotted && number ? { title: dotted[2], number } : null;
	if ((!accessible && menu) || (accessible && accessible.length > 1000)) return null;
	if (!accessible && numbered && !/^[\p{Nd}]+[.．]\p{Nd}/u.test(primary)) return numbered;

	const comparable = (value: string) => value.normalize("NFC").replace(/\p{Bidi_Control}/gu, "").replace(/[‘’]/gu, "'").replace(/\s+/gu, " ").trim();
	const label = comparable(accessible ?? "");
	function matchTitle(title: string, expectedNumber?: number) {
		const text = comparable(title);
		// A card title can itself begin with digits, include colons, or equal a word in the coordinates.
		// Only the text *before the complete title* can supply a season or episode.
		for (let index = label.indexOf(text); index >= 0; index = label.indexOf(text, index + text.length)) {
			const rest = label.slice(index + text.length);
			if (rest && !/^[\s\p{P}]/u.test(rest)) continue;
			const prefix = label.slice(0, index).trimEnd();
			if (!/[:：、؛،,–—-]$/u.test(prefix)) continue;
			const pair = episodeCoordinates(prefix, seasonTitle, true);
			if (pair?.season === seasonNumber && (!expectedNumber || pair.episode === expectedNumber)) return { title, number: pair.episode };
		}
		return null;
	}
	const whole = matchTitle(primary);
	if (whole) return whole;
	if (numbered) {
		const match = matchTitle(numbered.title, numbered.number);
		if (match) return match;
	}
	const counter = /^((?:第|제)?[\p{Nd}〇零一二兩两三四五六七八九十百千]+[話话集回화회])\s*[:：、.．–—-]?\s*(.+)$/u.exec(primary);
	if (counter) {
		const number = seasonOrdinal(counter[1]);
		if (number) return accessible ? matchTitle(counter[2], number) : { title: counter[2], number };
	}

	// A translated prefix (such as 第３話 or ตอนที่ ๓) need not be in a dictionary:
	// its number and the exact title after it must both agree with the accessibility label.
	for (const separator of primary.matchAll(/\s*[:：、.．–—-]\s*|\s+/gu)) {
		const prefix = primary.slice(0, separator.index);
		const number = seasonOrdinal(prefix);
		const title = primary.slice(separator.index + separator[0].length);
		if (title && number) {
			if (!accessible && role(tokens(prefix), "") === "episode") return { title, number };
			const match = matchTitle(title, number);
			if (match) return match;
		}
	}
	return null;
}
