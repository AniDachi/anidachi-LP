import {
	extensionAuthSessionKey,
	getStoredAuthTokens,
	normalizeExtensionAuthTokens,
} from "./auth-tokens";
import {
	loadRoomSessionForTab,
	parseRoomSessionRecord,
} from "./room-session-storage";
import {
	handleRoomAdmissionHandoffMessage,
	roomAdmissionHandoffMessage,
} from "./room-client";
import {
	handlePlayerRoomDeparture,
	PLAYER_ROOM_DEPARTURE,
} from "./player-room-departure";
import { readPrivilegedRoomAuthorityForTab } from "./privileged-overlay-intent";
import {
	isPrimeBrowsingSender,
	isPrimePlayerPageSender,
	isPrimeRoomBrowsingPage,
} from "./source-adapters/primevideo/url";
import {
	PRIME_ROOM_INTERNAL,
	PRIME_ROOM_PAGE,
	PRIME_ROOM_UI,
	samePrimeRoom,
	type BrowseBaseline,
	type PrimeRoomIdentity,
} from "./prime-room-contract";

let creating: Promise<void> | null = null;
async function offscreenExists() {
	return (
		(
			await chrome.runtime.getContexts({
				contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
				documentUrls: [chrome.runtime.getURL(PRIME_ROOM_PAGE)],
			})
		).length > 0
	);
}

async function ensureOffscreen() {
	if (await offscreenExists()) return;
	creating ??= chrome.offscreen
		.createDocument({
			url: PRIME_ROOM_PAGE,
			reasons: [
				chrome.offscreen.Reason.WEB_RTC,
				chrome.offscreen.Reason.USER_MEDIA,
			],
			justification:
				"Keep the user's active Prime watch-room call connected while the tab navigates between titles.",
		})
		.finally(() => {
			creating = null;
		});
	await creating;
}

function internal(action: string, fields: Record<string, unknown> = {}) {
	return chrome.runtime.sendMessage({
		type: PRIME_ROOM_INTERNAL,
		action,
		...fields,
	});
}

async function confirmPlayerDocument(
	tab: chrome.tabs.Tab,
	documentId: string,
): Promise<boolean> {
	if (
		tab.id === undefined ||
		!tab.url ||
		!isPrimePlayerPageSender({ tab, frameId: 0, url: tab.url })
	)
		return false;
	return (
		(await chrome.tabs
			.sendMessage(
				tab.id,
				{
					type: "ANIDACHI_PRIME_CONFIRMED_DOCUMENT",
					url: tab.url,
				},
				{ documentId },
			)
			.catch(() => false)) === true
	);
}

/** A retail /dp URL is shared with shopping pages; the admitted document alone can vouch for its player. */
export async function isAttachedPrimePlayerDocument(
	tab: chrome.tabs.Tab,
	identity: PrimeRoomIdentity,
	expectedDocumentId?: string,
): Promise<boolean> {
	if (tab.id === undefined || !(await offscreenExists())) return false;
	const documentId = await internal("active-player", {
		tabId: tab.id,
		identity,
	});
	return (
		typeof documentId === "string" &&
		(!expectedDocumentId || expectedDocumentId === documentId) &&
		confirmPlayerDocument(tab, documentId)
	);
}

export function registerPrimeRoomTransport() {
	// Serialize storage/tab invalidations with issue and lookup. Offscreen tickets
	// are one-use and bound to the browser-provided tab and document identifiers.
	let queue: Promise<unknown> = Promise.resolve();
	function schedule<T>(work: () => Promise<T>): Promise<T> {
		const task = queue.then(work);
		queue = task.catch(() => undefined);
		return task;
	}

	chrome.runtime.onMessage.addListener((message, sender, respond) => {
		if (
			message?.type === PRIME_ROOM_INTERNAL &&
			["ack", "depart"].includes(message.action) &&
			sender.id === chrome.runtime.id &&
			!sender.tab &&
			sender.url === chrome.runtime.getURL(PRIME_ROOM_PAGE)
		) {
			if (message.action === "depart") {
				void handlePlayerRoomDeparture(
					{ type: PLAYER_ROOM_DEPARTURE, ...message.identity },
					{ tab: { id: message.tabId } },
				).then(
					(result) => respond(result.ok),
					() => respond(false),
				);
				return true;
			}
			const handoff = message.handoff;
			void handleRoomAdmissionHandoffMessage(
				roomAdmissionHandoffMessage(handoff),
				{ tab: { id: message.tabId } },
			).then(
				(result) => respond(result.ok && result.acknowledged),
				() => respond(false),
			);
			return true;
		}
		if (message?.type !== PRIME_ROOM_UI) return false;
		const tabId = sender.tab?.id;
		const allowedSender = (candidate: chrome.runtime.MessageSender) =>
			isPrimeBrowsingSender(candidate) ||
			(((message.action === "prepare" && message.resumeOnly === false) ||
				message.action === "cancel-attach") &&
				isPrimePlayerPageSender(candidate));
		if (
			sender.id !== chrome.runtime.id ||
			tabId === undefined ||
			!sender.documentId ||
			(sender.documentLifecycle && sender.documentLifecycle !== "active") ||
			!allowedSender(sender)
		) {
			respond(null);
			return false;
		}
		const documentId = sender.documentId;
		void schedule(async () => {
			const [tab, auth, record] = await Promise.all([
				chrome.tabs.get(tabId),
				getStoredAuthTokens(),
				loadRoomSessionForTab(tabId),
			]);
			if (
				!record ||
				record.ownerUserId !== auth?.user.id ||
				!tab.url ||
				!allowedSender({ ...sender, tab })
			)
				return null;
			const identity: PrimeRoomIdentity = {
				roomId: record.roomId,
				participantSessionId: record.participantSessionId,
				ownerUserId: record.ownerUserId,
			};
			if (message.action === "lookup") {
				if (!(await offscreenExists())) return null;
				const found: { browsingBaseline: BrowseBaseline | null } | null =
					await internal("lookup", { tabId, identity });
				if (!found) return null;
				const privilegedRoomAuthority = await readPrivilegedRoomAuthorityForTab(
					tabId,
					record.ownerUserId,
					record.roomId,
				);
				return {
					...record,
					browsingBaseline: found.browsingBaseline,
					privilegedRoomAuthority,
				};
			}
			if (!message.identity || !samePrimeRoom(identity, message.identity))
				return null;
			if (message.action === "retire-unattached") {
				if (typeof message.nonce !== "string")
					return false;
				const current = await chrome.tabs
					.sendMessage(
						tabId,
						{
							type: "ANIDACHI_PRIME_CURRENT_DOCUMENT",
							nonce: message.nonce,
						},
						{ frameId: 0 },
					)
					.catch(() => false);
				if (
					current !== true ||
					((await offscreenExists()) && !(await internal("retire-unattached", {
						tabId,
						documentId,
						identity,
					})))
				)
					return false;
				// Durable departure claims are themselves fenced to this specific identity.
				return identity;
			}
			if (typeof message.attempt !== "string") return null;
			if (message.action === "cancel-attach") {
				return (
					(await offscreenExists()) &&
					internal("cancel-attach", {
						tabId,
						documentId,
						identity,
						attempt: message.attempt,
					})
				);
			}
			if (message.action !== "prepare") return null;
			const resumeOnly =
				message.resumeOnly === true ||
				!isPrimePlayerPageSender({ ...sender, tab });
			if (resumeOnly && !(await offscreenExists())) return null;
			await ensureOffscreen();
			const ticket = crypto.randomUUID();
			return (await internal("authorize", {
				tabId,
				documentId,
				identity,
				ticket,
				resumeOnly,
				browsing: !isPrimePlayerPageSender({ ...sender, tab }),
				attempt: message.attempt,
			}))
				? ticket
				: null;
		})
			.then(async (result) => {
				if (
					message.action === "retire-unattached" &&
					result &&
					typeof result === "object" &&
					"roomId" in result
				) {
					const { roomId, ownerUserId, participantSessionId } = result;
					const departed = await handlePlayerRoomDeparture(
						{
							type: PLAYER_ROOM_DEPARTURE,
							roomId,
							ownerUserId,
							participantSessionId,
						},
						{ tab: { id: tabId } },
					);
					respond(departed.ok);
				} else respond(result);
			})
			.catch(() =>
				respond(message.action === "lookup" ? { retryable: true } : null),
			);
		return true;
	});

	const revoke = (tabId: number) =>
		schedule(async () => {
			if (await offscreenExists()) await internal("stop", { tabId });
		});
	chrome.tabs.onRemoved.addListener((tabId) => {
		void revoke(tabId).catch(() => undefined);
	});
	chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
		if (!change.status && !change.url) return;
		// Chrome hides the URL on hosts outside our narrow host permissions.
		const url = change.url ?? tab.url;
		if (url && isPrimeRoomBrowsingPage(url)) return;
		void schedule(async () => {
			if (!(await offscreenExists())) return;
			if (url && isPrimePlayerPageSender({ tab, frameId: 0, url })) {
				const documentId = await internal("document", { tabId });
				if (
					typeof documentId === "string" &&
					(await confirmPlayerDocument({ ...tab, url }, documentId))
				)
					return;
			}
			const identity: PrimeRoomIdentity | null = await internal("stop", {
				tabId,
			});
			if (identity)
				void handlePlayerRoomDeparture(
					{ type: PLAYER_ROOM_DEPARTURE, ...identity },
					{ tab: { id: tabId } },
				);
		}).catch(() => undefined);
	});
	chrome.storage.onChanged.addListener((changes, area) => {
		if (
			area === "local" &&
			changes.authTokens &&
			extensionAuthSessionKey(
				normalizeExtensionAuthTokens(changes.authTokens.oldValue),
			) !==
				extensionAuthSessionKey(
					normalizeExtensionAuthTokens(changes.authTokens.newValue),
				)
		) {
			void schedule(async () => {
				if (await offscreenExists()) await internal("stop-all");
			}).catch(() => undefined);
		}
		if (area !== "session") return;
		for (const [key, change] of Object.entries(changes)) {
			const match = /^anidachi:room-session:v1:tab:(\d+)$/.exec(key);
			const previous = parseRoomSessionRecord(change.oldValue),
				next = parseRoomSessionRecord(change.newValue);
			if (!match || !previous || (next && samePrimeRoom(previous, next)))
				continue;
			void schedule(async () => {
				if (await offscreenExists())
					await internal("stop", {
						tabId: Number(match[1]),
						identity: previous,
					});
			}).catch(() => undefined);
		}
	});
}
