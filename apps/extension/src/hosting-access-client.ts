import {
	AccountEntitlementsMetadataSchema,
	HostingAccessSchema,
	HostingOfferSchema,
	PlanCodeSchema,
} from "@anidachi/protocol";
import { z } from "zod";
import { getStoredAuthTokens, isSameExtensionAuthSession } from "./auth-tokens";
import { refreshExtensionSession } from "./auth-client";
import { WEB_HTTP_BASE } from "./constants";

// Project only the additive display contract; existing entitlement fields stay compatible.
const HostingAccountAccessSchema = AccountEntitlementsMetadataSchema.extend({
	planCode: PlanCodeSchema,
	hosting: HostingAccessSchema.optional(),
	hostingOffer: HostingOfferSchema.optional().catch(undefined),
})
	.strip()
	.superRefine((value, ctx) => {
		const hosting = value.hosting;
		if (!hosting) return;
		const active =
			hosting.hostingActivationAt !== null &&
			Date.parse(hosting.hostingActivationAt) <= Date.parse(value.serverTime);
		if (
			hosting.canHost !== (!active || value.planCode !== "free") ||
			(hosting.trialEligibility === "eligible" &&
				(!active || value.planCode !== "free" || hosting.trialEndsAt !== null))
		) {
			ctx.addIssue({
				code: "custom",
				message: "Inconsistent hosting authority",
			});
		}
	});
export type HostingAccountAccess = z.infer<typeof HostingAccountAccessSchema>;
const TYPE = "ANIDACHI_HOSTING_ACCESS";
type Message = { type: typeof TYPE; ownerUserId: string; fresh?: boolean };
export function isHostingAccessMessage(value: unknown): value is Message {
	if (!value || typeof value !== "object") return false;
	const message = value as Partial<Message>;
	return (
		message.type === TYPE &&
		typeof message.ownerUserId === "string" &&
		message.ownerUserId.length > 0
	);
}

const defaultDependencies = {
	getSession: getStoredAuthTokens,
	refresh: refreshExtensionSession,
};
const pendingReads = new WeakMap<
	typeof defaultDependencies,
	Map<string, Promise<Awaited<ReturnType<typeof loadHostingAccess>>>>
>();

export async function handleHostingAccessMessage(
	message: Message,
	dependencies = defaultDependencies,
) {
	const session = await dependencies.getSession().catch(() => null);
	if (!session || session.user.id !== message.ownerUserId)
		return { ok: false as const };
	const key = JSON.stringify([
		session.authRevision,
		session.profileRevision,
		session.user.id,
		session.accessToken,
		session.refreshToken,
	]);
	let reads = pendingReads.get(dependencies);
	if (!reads) {
		reads = new Map();
		pendingReads.set(dependencies, reads);
	}
	let pending = message.fresh ? undefined : reads.get(key);
	if (!pending) {
		pending = loadHostingAccess(message, dependencies, session);
		reads.set(key, pending);
		const own = pending;
		void pending.finally(() => {
			if (reads.get(key) === own) reads.delete(key);
		});
	}
	return pending;
}

async function loadHostingAccess(
	message: Message,
	dependencies: typeof defaultDependencies,
	initialSession: NonNullable<Awaited<ReturnType<typeof getStoredAuthTokens>>>,
) {
	const failure = { ok: false as const };
	const controller = new AbortController();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const load = async () => {
		try {
			let session: Awaited<ReturnType<typeof getStoredAuthTokens>> =
				initialSession;
			if (
				!session ||
				session.user.id !== message.ownerUserId ||
				controller.signal.aborted
			)
				return failure;
			const read = (token: string) =>
				fetch(new URL("/api/me/entitlements?hostingOffer=1", WEB_HTTP_BASE), {
					headers: {
						Authorization: `Bearer ${token}`,
						"x-anidachi-history-owner": message.ownerUserId,
					},
					credentials: "omit",
					cache: "no-store",
					redirect: "error",
					signal: controller.signal,
				});
			let response = await read(session.accessToken);
			if (response.status === 401) {
				if (
					!isSameExtensionAuthSession(
						session,
						await dependencies.getSession(),
					) ||
					controller.signal.aborted
				)
					return failure;
				session = await dependencies.refresh();
				if (
					!session ||
					session.user.id !== message.ownerUserId ||
					controller.signal.aborted
				)
					return failure;
				response = await read(session.accessToken);
			}
			if (response.status !== 200 || controller.signal.aborted) return failure;
			const access = HostingAccountAccessSchema.parse(await response.json());
			if (
				access.ownerUserId !== message.ownerUserId ||
				!isSameExtensionAuthSession(session, await dependencies.getSession()) ||
				controller.signal.aborted
			)
				return failure;
			return { ok: true as const, access };
		} catch {
			return failure;
		}
	};
	return Promise.race([
		load(),
		new Promise<typeof failure>((resolve) => {
			timeout = setTimeout(() => {
				controller.abort();
				resolve(failure);
			}, 10_000);
		}),
	]).finally(() => {
		if (timeout !== undefined) clearTimeout(timeout);
	});
}

export async function requestHostingAccess(
	ownerUserId: string,
	fresh = false,
): Promise<HostingAccountAccess> {
	const response = await chrome.runtime.sendMessage({
		type: TYPE,
		ownerUserId,
		...(fresh ? { fresh: true } : {}),
	});
	if (!response?.ok) throw new Error("Hosting access unavailable");
	const access = HostingAccountAccessSchema.parse(response.access);
	if (access.ownerUserId !== ownerUserId)
		throw new Error("Hosting access owner changed");
	return access;
}
