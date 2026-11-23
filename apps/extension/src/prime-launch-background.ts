import { z } from "zod";
import {
	PrimeNavigationSchema,
	PersonalHistoryResumeSchema,
	personalHistoryResumeOwnerBinding,
	primeVideoSourceUrl,
	PrimeVideoProviderIdSchema,
	resolvePrimeLaunch,
} from "@anidachi/protocol";
import { isPrimePlayerPageSender } from "./source-adapters/primevideo/url";
import { getStoredAuthTokens } from "./auth-tokens";
import { createWatchHistoryStorage } from "./watch-history-storage";
import {
	createPrimePendingStore,
	type PrimeLaunchOwner,
	type PrimePending,
} from "./prime-launch-session";
import { isTrialWebsiteSender } from "./trial-installation";
import { WEB_HTTP_BASE } from "./constants";
const KEY = "anidachi.primePending.v1";
const StartSchema = z
	.strictObject({
		type: z.literal("ANIDACHI_PRIME_LAUNCH"),
		action: z.literal("start"),
		contentId: PrimeVideoProviderIdSchema,
		navigation: PrimeNavigationSchema.optional(),
		roomId: z.string().min(1).max(128).optional(),
		resume: PersonalHistoryResumeSchema.optional(),
		expectedOwnerUserId: z.string().min(1).max(128).optional(),
		newTab: z.boolean().optional(),
		prepareOnly: z.boolean().optional(),
		// Accepted for older clients; the supplied route always determines the destination.
		currentVerifiedOrigin: z.string().max(256).optional(),
	})
	.refine((v) => !!v.roomId !== !!v.resume)
	.refine((v) => !v.navigation || v.navigation.contentId === v.contentId);
const CommitSchema = z.strictObject({
	type: z.literal("ANIDACHI_PRIME_LAUNCH"),
	action: z.literal("commit"),
	intentId: z.uuid(),
	expectedOwnerUserId: z.string().min(1).max(128),
	// Accepted for older clients; the supplied route always determines the destination.
	currentVerifiedOrigin: z.string().max(256).optional(),
});
const CommandSchema = z.discriminatedUnion("action", [
	z.strictObject({ type: z.literal("ANIDACHI_PRIME_LAUNCH"), action: z.literal("pending-room") }),
	z.strictObject({
		type: z.literal("ANIDACHI_PRIME_LAUNCH"),
		action: z.literal("read"),
	}),
	z.strictObject({
		type: z.literal("ANIDACHI_PRIME_LAUNCH"),
		action: z.literal("cancel"),
	}),
	z.strictObject({
		type: z.literal("ANIDACHI_PRIME_LAUNCH"),
		action: z.literal("recover"),
		contentId: PrimeVideoProviderIdSchema,
	}),
	z.strictObject({
		type: z.literal("ANIDACHI_PRIME_LAUNCH"),
		action: z.literal("take"),
		contentId: PrimeVideoProviderIdSchema,
		intentId: z.uuid(),
	}),
]);
let queue: Promise<unknown> = Promise.resolve();
async function owner(): Promise<PrimeLaunchOwner | null> {
	const auth = await getStoredAuthTokens();
	if (!auth) return null;
	const root = await createWatchHistoryStorage().readRoot();
	return {
		userId: auth.user.id,
		loginId: auth.authSessionId ?? auth.authRevision ?? "legacy",
		generation: root.activeGenerations?.[auth.user.id] ?? 1,
	};
}
const store = () =>
	createPrimePendingStore({
		get: async () => (await chrome.storage.session.get(KEY))[KEY],
		set: (value) => chrome.storage.session.set({ [KEY]: value }),
		remove: () => chrome.storage.session.remove(KEY),
	});
function same(a: PrimeLaunchOwner, b: PrimeLaunchOwner | null) {
	return !!b && JSON.stringify(a) === JSON.stringify(b);
}
async function navigate(tab: number, pending: PrimePending, url: string) {
	const target = new URL(url);
	target.searchParams.set("autoplay", "1");
	target.hash = new URLSearchParams(
		pending.roomId
			? { anidachiRoom: pending.roomId }
			: { anidachiResume: JSON.stringify(pending.resume) },
	).toString();
	if (!same(pending.owner, await owner())) {
		await store().cancel(tab);
		return { status: "cancelled" };
	}
	await store().put(tab, { ...pending, attempts: 1 });
	await chrome.tabs.update(tab, { url: target.toString() });
	return { status: "ready", url: target.toString() };
}
async function handle(
	message: unknown,
	sender: chrome.runtime.MessageSender,
	external: boolean,
): Promise<unknown> {
	const allowedOrigins = [
		new URL(WEB_HTTP_BASE).origin,
		...(import.meta.env.WXT_EXTENSION_CHANNEL === "production"
			? ["https://www.anidachi.app"]
			: []),
	];
	const internal = sender.id === chrome.runtime.id;
	if (external ? !isTrialWebsiteSender(sender, allowedOrigins) : !internal)
		return { status: "cancelled" };
	if (sender.tab && sender.frameId !== 0) return { status: "cancelled" };
	const trustedUi =
		!sender.tab && !!sender.url?.startsWith(chrome.runtime.getURL(""));
	const legacyLaunchUi =
		sender.url?.split(/[?#]/)[0] ===
		chrome.runtime.getURL("/prime-launch.html");
	const provider = isPrimePlayerPageSender(sender);
	const command = CommandSchema.safeParse(message);
	let current = await owner();
	if (!current && command.success && command.data.action === "pending-room") return { status: "empty" };
	if (!current)
		return {
			status: "blocked",
			rejection:
				sender.tab?.id === undefined
					? undefined
					: await store().rejection(sender.tab.id),
		};
	const start = StartSchema.safeParse(message);
	if (start.success) {
		const input = start.data;
		if (
			!(external || trustedUi || provider) ||
			(external && !input.expectedOwnerUserId) ||
			(input.expectedOwnerUserId &&
				input.expectedOwnerUserId !== current.userId)
		)
			return { status: "cancelled" };
		if (input.resume && input.resume.accountGeneration !== current.generation) {
			const before = current;
			const { handleWatchHistoryHttpMessage } = await import(
				"./watch-history-client"
			);
			await handleWatchHistoryHttpMessage({
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "bootstrap",
				expectedOwnerUserId: before.userId,
			});
			current = await owner();
			if (
				!current ||
				current.userId !== before.userId ||
				current.loginId !== before.loginId
			)
				return { status: "cancelled" };
		}
		if (
			input.resume &&
			(input.resume.provider !== "primevideo" ||
				input.resume.sourceUrl !== primeVideoSourceUrl(input.contentId) ||
				input.resume.accountGeneration !== current.generation ||
				input.resume.issuedAt > Date.now() ||
				input.resume.expiresAt <= Date.now() ||
				input.resume.ownerBinding !==
					(await personalHistoryResumeOwnerBinding(
						current.userId,
						input.resume.intentId,
					)))
		)
			return { status: "cancelled" };
		const tab =
			input.newTab && trustedUi
				? (await chrome.tabs.create({ url: "about:blank" })).id
				: sender.tab?.id;
		if (tab === undefined) return { status: "cancelled" };
		const pending: PrimePending = {
			intentId: input.resume?.intentId ?? crypto.randomUUID(),
			contentId: input.contentId,
			owner: current,
			...(input.roomId ? { roomId: input.roomId } : { resume: input.resume! }),
			expiresAt: Math.min(
				Date.now() + 300000,
				input.resume?.expiresAt ?? Infinity,
			),
			attempts: 0,
			...(input.navigation ? { navigation: input.navigation } : {}),
		};
		if (!same(current, await owner())) return { status: "cancelled" };
		await store().put(tab, pending);
		if (external || input.prepareOnly)
			return {
				status: "prepared",
				intentId: pending.intentId,
				ownerUserId: current.userId,
			};
		const resolution = resolvePrimeLaunch({
			contentId: input.contentId,
			navigation: input.navigation,
		});
		return navigate(tab, pending, resolution.url);
	}
	const commit = CommitSchema.safeParse(message);
	if (
		(external || provider) &&
		commit.success &&
		sender.tab?.id !== undefined
	) {
		const tab = sender.tab.id,
			pending = await store().peek(tab, current);
		if (
			!pending ||
			pending.intentId !== commit.data.intentId ||
			pending.attempts !== 0 ||
			commit.data.expectedOwnerUserId !== current.userId
		)
			return { status: "cancelled" };
		const resolution = resolvePrimeLaunch({
			contentId: pending.contentId,
			navigation: pending.navigation,
		});
		return navigate(tab, pending, resolution.url);
	}
	const tab = sender.tab?.id;
	if (!command.success || external || tab === undefined)
		return { status: "cancelled" };
	if (command.data.action === "pending-room") {
		if (!provider) return { status: "cancelled" };
		const pending = await store().peek(tab, current);
		return pending?.roomId && pending.attempts === 1
			? { status: "ready", intentId: pending.intentId, contentId: pending.contentId }
			: { status: "empty" };
	}
	if (command.data.action === "take" || command.data.action === "recover") {
		if (!provider) return { status: "cancelled" };
		const existed = await store().has(tab);
		const pending =
			command.data.action === "recover"
				? await store().recover(tab, current, command.data.contentId)
				: await store().take(
						tab,
						current,
						command.data.contentId,
						Date.now(),
						command.data.intentId,
					);
		return pending
			? { status: "ready", pending }
			: {
					status: existed ? "blocked" : "empty",
					...(existed ? { rejection: await store().rejection(tab) } : {}),
				};
	}
	// Compatibility for an old launch tab left open during an extension update.
	// Normal launches never visit this page. No preference or choice is applied.
	if (!legacyLaunchUi) return { status: "cancelled" };
	if (command.data.action === "cancel") {
		await store().cancel(tab);
		return { status: "cancelled" };
	}
	const pending = await store().peek(tab, current);
	if (!pending) return { status: "expired" };
	if (pending.attempts !== 0) return { status: "cancelled" };
	const resolution = resolvePrimeLaunch({
		contentId: pending.contentId,
		navigation: pending.navigation,
	});
	return navigate(tab, pending, resolution.url);
}
export function registerPrimeLaunchBridge() {
	const listener =
		(external: boolean) =>
		(
			message: unknown,
			sender: chrome.runtime.MessageSender,
			respond: (value: unknown) => void,
		) => {
			if (
				!message ||
				typeof message !== "object" ||
				!("type" in message) ||
				message.type !== "ANIDACHI_PRIME_LAUNCH"
			)
				return false;
			const work = queue.then(() => handle(message, sender, external));
			queue = work.catch(() => undefined);
			void work.then(respond, () => respond({ status: "retryable" }));
			return true;
		};
	chrome.runtime.onMessage.addListener(listener(false));
	chrome.runtime.onMessageExternal?.addListener(listener(true));
	chrome.tabs.onRemoved.addListener((tab) => {
		queue = queue.then(() => store().forget(tab)).catch(() => undefined);
	});
	chrome.storage.onChanged?.addListener((changes, area) => {
		if (area !== "local" || !changes.authTokens) return;
		const previous = changes.authTokens.oldValue as
			| { user?: { id?: string }; authSessionId?: string }
			| undefined;
		const next = changes.authTokens.newValue as
			| { user?: { id?: string }; authSessionId?: string }
			| undefined;
		if (
			previous?.user?.id !== next?.user?.id ||
			previous?.authSessionId !== next?.authSessionId
		)
			queue = queue.then(() => store().retireAll()).catch(() => undefined);
	});
}
