import {
	ONBOARDING_RETURN_PROBE,
	ONBOARDING_RETURN_TTL_MS,
	OnboardingCheckoutOpenSchema,
	OnboardingReturnSchema,
} from "@anidachi/protocol";
import { getHostingOfferUrl } from "./hosting-offer-link";
import { isTrialWebsiteSender } from "./trial-installation";

const KEY = "onboardingCheckoutReturns";
type Entry = {
	token: string;
	tabId: number;
	documentId: string;
	frameId: number;
	ownerUserId: string | null;
	expiresAt: number;
};
export type ReturnDependencies = {
	extensionId: string;
	origins: readonly string[];
	storage: {
		get(key: string): Promise<Record<string, unknown>>;
		set(value: Record<string, unknown>): Promise<void>;
	};
	owner(): Promise<string | null>;
	open(url: string): Promise<unknown>;
	probe(entry: Entry): Promise<unknown>;
	canReturn(sender: chrome.runtime.MessageSender): Promise<boolean>;
	focus(tabId: number): Promise<void>;
	now?: () => number;
};

/** Session storage survives MV3 suspension, but not a browser restart. Bounded,
 * serialized and single-use; no account credentials or video URLs leave the extension. */
export function createOnboardingCheckoutReturn(deps: ReturnDependencies) {
	let queue: Promise<unknown> = Promise.resolve();
	const now = deps.now ?? Date.now;
	async function read(): Promise<Entry[]> {
		const saved = (await deps.storage.get(KEY))[KEY];
		if (!Array.isArray(saved)) return [];
		return saved
			.filter(
				(e): e is Entry =>
					!!e &&
					typeof e.token === "string" &&
					Number.isInteger(e.tabId) &&
					typeof e.documentId === "string" &&
					Number.isInteger(e.frameId) &&
					(e.ownerUserId === null || typeof e.ownerUserId === "string") &&
					e.expiresAt > now() &&
					e.expiresAt <= now() + ONBOARDING_RETURN_TTL_MS,
			)
			.slice(-20);
	}
	function serial<T>(run: () => Promise<T>): Promise<T> {
		const result = queue.then(run);
		queue = result.catch(() => {});
		return result;
	}
	return {
		open(message: unknown, sender: chrome.runtime.MessageSender) {
			return serial(async () => {
				const parsed = OnboardingCheckoutOpenSchema.safeParse(message);
				if (
					!parsed.success ||
					sender.id !== deps.extensionId ||
					!Number.isInteger(sender.tab?.id) ||
					!sender.documentId ||
					!Number.isInteger(sender.frameId)
				)
					return { opened: false };
				const entry: Entry = {
					token: parsed.data.token,
					tabId: sender.tab!.id!,
					documentId: sender.documentId,
					frameId: sender.frameId!,
					ownerUserId: await deps.owner(),
					expiresAt: now() + ONBOARDING_RETURN_TTL_MS,
				};
				const entries = (await read()).filter(
					(e) => e.tabId !== entry.tabId && e.token !== entry.token,
				);
				await deps.storage.set({ [KEY]: [...entries.slice(-19), entry] });
				const url = new URL(getHostingOfferUrl(parsed.data.offer));
				url.searchParams.set("onboarding", entry.token);
				try {
					await deps.open(url.href);
					return { opened: true };
				} catch {
					await deps.storage.set({ [KEY]: entries });
					return { opened: false };
				}
			});
		},
		complete(
			message: unknown,
			sender: chrome.runtime.MessageSender,
			isAlive: () => boolean = () => true,
		) {
			const deadline = now() + 2_000;
			return serial(async () => {
				const parsed = OnboardingReturnSchema.safeParse(message);
				if (
					!parsed.success ||
					!isTrialWebsiteSender(sender, deps.origins) ||
					!isAlive() ||
					now() >= deadline
				)
					return { returned: false };
				const { token, ownerUserId } = parsed.data;
				const entries = await read();
				const entry = entries.find((e) => e.token === token);
				if (
					!entry ||
					(entry.ownerUserId !== null && entry.ownerUserId !== ownerUserId)
				)
					return { returned: false };
				const ownerMatches = async () => {
					const current = await deps.owner();
					return entry.ownerUserId !== null
						? current === ownerUserId
						: current === null || current === ownerUserId;
				};
				if (!(await ownerMatches())) return { returned: false };
				try {
					let timer: ReturnType<typeof setTimeout> | undefined;
					const result = (await Promise.race([
						deps.probe(entry),
						new Promise<undefined>((resolve) => {
							timer = setTimeout(() => resolve(undefined), 1000);
						}),
					]).finally(() => clearTimeout(timer))) as
						| { ready?: boolean }
						| undefined;
					if (
						result?.ready !== true ||
						!(await ownerMatches()) ||
						!(await deps.canReturn(sender)) ||
						!isAlive() ||
						now() >= deadline
					)
						return { returned: false };
					// Remove before switching tabs so replay and concurrent replies cannot refocus.
					await deps.storage.set({
						[KEY]: entries.filter((e) => e.token !== token),
					});
					if (
						!(await deps.canReturn(sender)) ||
						!(await ownerMatches()) ||
						!isAlive() ||
						now() >= deadline
					)
						return { returned: false };
					await deps.focus(entry.tabId);
					return { returned: true };
				} catch {
					return { returned: false };
				}
			});
		},
	};
}

export function probeOnboardingTab(entry: Entry) {
	return chrome.tabs.sendMessage(
		entry.tabId,
		{ type: ONBOARDING_RETURN_PROBE, token: entry.token },
		{ documentId: entry.documentId, frameId: entry.frameId },
	);
}
