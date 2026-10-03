import {
	AccountEntitlementsMetadataSchema,
	HostingAccessSchema,
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
type Message = { type: typeof TYPE; ownerUserId: string };
export function isHostingAccessMessage(value: unknown): value is Message {
	if (!value || typeof value !== "object") return false;
	const message = value as Partial<Message>;
	return (
		message.type === TYPE &&
		typeof message.ownerUserId === "string" &&
		message.ownerUserId.length > 0
	);
}

export async function handleHostingAccessMessage(
	message: Message,
	dependencies = {
		getSession: getStoredAuthTokens,
		refresh: refreshExtensionSession,
	},
) {
	const failure = { ok: false as const };
	const controller = new AbortController();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const load = async () => {
		try {
			let session = await dependencies.getSession();
			if (
				!session ||
				session.user.id !== message.ownerUserId ||
				controller.signal.aborted
			)
				return failure;
			const read = (token: string) =>
				fetch(new URL("/api/me/entitlements", WEB_HTTP_BASE), {
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
): Promise<HostingAccountAccess> {
	const response = await chrome.runtime.sendMessage({
		type: TYPE,
		ownerUserId,
	});
	if (!response?.ok) throw new Error("Hosting access unavailable");
	const access = HostingAccountAccessSchema.parse(response.access);
	if (access.ownerUserId !== ownerUserId)
		throw new Error("Hosting access owner changed");
	return access;
}
