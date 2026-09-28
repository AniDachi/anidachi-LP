import type { PricingOffer } from "../pricing-offer";
import { resolveAccountEntitlements } from "./account-entitlements";
import { readPricingPrice } from "./pricing-catalog";
import { db, listSubscriptionsForUser } from "./db";
import { stripePriceIdForPlanCode } from "./stripe-plans";

const defaults = {
	readPrice: readPricingPrice,
	priceId: stripePriceIdForPlanCode,
	access: resolveAccountEntitlements,
	subscriptions: listSubscriptionsForUser,
	now: Date.now,
	async policy() {
		const { data, error } = await db()
			.from("hosting_commercial_policy")
			.select("activation_at")
			.eq("singleton", true)
			.abortSignal(AbortSignal.timeout(8000))
			.single();
		if (error || !data) throw new Error("Pricing policy unavailable");
		return data as { activation_at: string | null };
	},
};
export async function getPricingOffer(
	userId: string | null,
	deps = defaults,
): Promise<PricingOffer> {
	const [plus, pro] = await Promise.all(
		(["plus", "pro"] as const).map(async (plan) => {
			const id = deps.priceId(plan);
			if (!id) throw new Error("Price unavailable");
			return deps.readPrice(id, true);
		}),
	);
	if (userId) {
		const [access, subscriptions] = await Promise.all([
			deps.access(userId, new Date(deps.now())),
			deps.subscriptions(userId),
		]);
		if (subscriptions.some((s) => s.user_id !== userId) || !access.hosting)
			throw new Error("Offer authority unavailable");
		const manage =
			access.policy.planCode !== "free" ||
			subscriptions.some(
				(s) => !["canceled", "incomplete_expired"].includes(s.status),
			);
		const now = Date.parse(access.history.serverTime);
		if (!Number.isFinite(now)) throw new Error("Offer authority unavailable");
		const activation = Date.parse(access.hosting.hostingActivationAt ?? "");
		const expiry = Date.parse(access.selectedPlanExpiresAt ?? "");
		const validForMs = Math.max(
			0,
			Math.min(
				60_000,
				activation > now ? activation - now : 60_000,
				access.policy.planCode !== "free" && Number.isFinite(expiry)
					? expiry - now
					: 60_000,
			),
		);
		return {
			validForMs,
			ownerUserId: userId,
			prices: { plus, pro },
			paidHostingActive:
				access.hosting.hostingActivationAt !== null &&
				Date.parse(access.hosting.hostingActivationAt) <=
					Date.parse(access.history.serverTime),
			action: manage
				? "manage"
				: access.hosting.trialEligibility === "eligible"
					? "trial"
					: "subscribe",
		};
	}
	const data = await deps.policy();
	if (
		data.activation_at !== null &&
		!Number.isFinite(Date.parse(data.activation_at))
	)
		throw new Error("Pricing policy unavailable");
	const now = deps.now();
	return {
		validForMs:
			data.activation_at && Date.parse(data.activation_at) > now
				? Math.min(60_000, Date.parse(data.activation_at) - now)
				: 60_000,
		ownerUserId: null,
		prices: { plus, pro },
		paidHostingActive:
			data.activation_at !== null && Date.parse(data.activation_at) <= now,
		action: "sign_in",
	};
}
