import { primeDocumentRouteId } from "./source-adapters/primevideo/metadata";
import { parsePrimePageUrl } from "./source-adapters/primevideo/url";
import {
	canonicalizeRoomSourceUrl,
	hboMaxPlaybackId,
	MAX_ROOM_ID_CHARS,
	parsePersonalHistoryResumeUrl,
	PERSONAL_HISTORY_RESUME_TTL_MS,
	type PersonalHistoryResume,
} from "@anidachi/protocol";
import type { VideoAdapter } from "./source-adapters/core/types";

export interface PrimeLaunchHandoff {
 /** Optional session transaction is committed only after lifecycle acceptance. */
 rejected?: true;
 waiting?: true;
 /** Only identifies the blocked invitation; never grants room admission. */
 rejectedRoomId?: string;
 intentId?: string;
 commit?(): Promise<boolean>;
 /** Recheck a recoverable room intent before requesting server admission. */
 verifyRoom?(): Promise<boolean>;
 hasDifferentRoomSource?(player: VideoAdapter): boolean;
 blocksFragment?(href: string): boolean;

	readRoom(
		href: string,
		fingerprint: string,
		owner?: string | null,
		now?: number,
	): string | null;
	consumeRoom(): void;
	takeResume(
		href: string,
		fingerprint: string,
		now?: number,
	): PersonalHistoryResume | null;
}
type Launch = {
	sourceUrl: string;
	fingerprint: string;
	expiresAt: number;
	roomId: string | null;
	resume: PersonalHistoryResume | null;
};
function source(href: string) {
	if (hboMaxPlaybackId(href)) return canonicalizeRoomSourceUrl(href, "hbomax");
	const route = parsePrimePageUrl(href);
	const id =
		route?.token.length === 26
			? route.token
			: primeDocumentRouteId(document, href);
	const canonical = id ? `https://www.primevideo.com/detail/${id}` : "";
	return canonicalizeRoomSourceUrl(canonical, "primevideo");
}
function signature(href: string): string | null {
	const params = new URLSearchParams(new URL(href).hash.slice(1));
	if (params.has("anidachiRoom"))
		return JSON.stringify(["room", params.getAll("anidachiRoom")]);
	return params.has("anidachiResume")
		? JSON.stringify(["resume", params.getAll("anidachiResume")])
		: null;
}
function readLaunch(href: string, now: number): Launch | null {
	if (href.length > 8192) return null;
	const canonical = source(href),
		key = signature(href);
	if (!canonical.ok || !key) return null;
	const params = new URLSearchParams(new URL(href).hash.slice(1));
	const roomId = params.get("anidachiRoom");
	// A room launch takes precedence even if a personal Resume was also supplied.
	if (
		params.has("anidachiRoom") &&
		(!roomId ||
			roomId.length > MAX_ROOM_ID_CHARS ||
			roomId.trim() !== roomId ||
			/[\0-\x1F\x7F]/.test(roomId) ||
			params.getAll("anidachiRoom").length !== 1)
	)
		return null;
	const resume = roomId
		? null
		: parsePersonalHistoryResumeUrl(
				`${canonical.source.sourceUrl}${new URL(href).hash}`,
				now,
			);
	if (!roomId && (!resume || params.getAll("anidachiResume").length !== 1)) return null;
	return {
		sourceUrl: canonical.source.sourceUrl,
		fingerprint: canonical.source.videoFingerprint,
		expiresAt: Math.min(
			now + PERSONAL_HISTORY_RESUME_TTL_MS,
			resume?.expiresAt ?? Infinity,
		),
		roomId,
		resume,
	};
}

/** Isolated-world, document-lifetime state only. Never exposed to the page or storage. */
export function createPrimeLaunchCapture(href: string, now = Date.now()) {
	let launch = readLaunch(href, now);
	let pendingHref: string | null =
		!launch && parsePrimePageUrl(href) && signature(href) ? href : null;
	let lastSignature = launch || pendingHref ? signature(href) : null;
	let handed = false;
	let roomOwner: string | null | undefined;
	const dispose = () => {
		launch = null;
		pendingHref = null;
		lastSignature = null;
		roomOwner = undefined;
		handed = true;
	};
	const observe = (currentHref: string) => {
		if (handed && !launch) return;
		if (pendingHref) {
			const initial = parsePrimePageUrl(pendingHref),
				current = parsePrimePageUrl(currentHref);
			if (
				!initial ||
				!current ||
				initial.url.origin !== current.url.origin ||
				(initial.token !== current.token &&
					!(() => {
						const previous = source(pendingHref),
							next = source(currentHref);
						return (
							previous.ok &&
							next.ok &&
							previous.source.sourceUrl === next.source.sourceUrl
						);
					})())
			)
				pendingHref = null;
		}
		if (launch && Date.now() >= launch.expiresAt) {
			dispose();
			return;
		}
		const canonical = source(currentHref);
		const key = signature(currentHref);
		const newExplicit = key !== null && key !== lastSignature;
		if (
			launch &&
			(!canonical.ok || canonical.source.sourceUrl !== launch.sourceUrl)
		) {
			if (handed) {
				dispose();
				return;
			}
			launch = null;
		}
		if (newExplicit) {
			if (handed) {
				dispose();
				return;
			}
			launch = readLaunch(currentHref, Date.now());
			if (launch) lastSignature = key;
			roomOwner = undefined;
		}
	};
	const valid = (
		currentHref: string,
		fingerprint: string,
		currentTime: number,
	) => {
		observe(currentHref);
		if (
			!launch ||
			currentTime >= launch.expiresAt ||
			fingerprint !== launch.fingerprint
		) {
			dispose();
			return false;
		}
		return true;
	};
	const handoff: PrimeLaunchHandoff = {
		readRoom(currentHref, fingerprint, owner, currentTime = Date.now()) {
			if (!valid(currentHref, fingerprint, currentTime) || !launch?.roomId)
				return null;
			if (owner !== undefined) {
				if (roomOwner !== undefined && roomOwner !== owner) {
					dispose();
					return null;
				}
				roomOwner = owner;
			}
			return launch.roomId;
		},
		consumeRoom: dispose,
		takeResume(currentHref, fingerprint, currentTime = Date.now()) {
			if (!valid(currentHref, fingerprint, currentTime) || !launch?.resume)
				return null;
			const intent = launch.resume;
			dispose();
			return currentTime >= intent.issuedAt && currentTime < intent.expiresAt
				? intent
				: null;
		},
	};
	return {
		observe,
		dispose,
		handoff(
			adapter: VideoAdapter,
			currentHref: string,
		): PrimeLaunchHandoff | null {
			if (handed) return null;
			observe(currentHref);
			if (!launch && pendingHref) {
				launch = readLaunch(pendingHref, now);
				if (launch) lastSignature = signature(pendingHref);
				pendingHref = null;
			}
			const admitted =
				(adapter.provider === "primevideo" || adapter.provider === "hbomax") &&
				valid(currentHref, adapter.getFingerprint(), Date.now());
			handed = true;
			if (!admitted) {
				dispose();
				return null;
			}
			return handoff;
		},
	};
}

/** Fence only the rejected launch, leaving a genuinely new explicit launch usable. */
export function suppressedPrimeLaunch(href: string, rejection?: {intentId?:string;roomId?:string;resumeIntentId?:string}): PrimeLaunchHandoff {
 const rejected=signature(href);
 return {rejected:true,rejectedRoomId:rejection?.roomId,intentId:rejection?.intentId,blocksFragment: current => {
  if(!rejection)return rejected!==null&&signature(current)===rejected;
  const params=new URLSearchParams(new URL(current).hash.slice(1));
  if(params.has("anidachiRoom"))return rejection.roomId!==undefined&&params.get("anidachiRoom")===rejection.roomId;
  if(params.has("anidachiResume")){try{return JSON.parse(params.get("anidachiResume")!).intentId===rejection.resumeIntentId;}catch{return false;}}
  return false;
 },readRoom:()=>null,consumeRoom(){},takeResume:()=>null};
}
