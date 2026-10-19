import type { HostingAccess, HostingOffer } from "@anidachi/protocol";
import { db } from "./db";

export type HostingOfferPolicy = {
	activation_at: string | null;
	trials_enabled: boolean;
	cardless_trials_enabled: boolean;
	revision: number;
};

async function readPolicy(): Promise<HostingOfferPolicy> {
	const { data, error } = await db()
		.from("hosting_commercial_policy")
		.select("activation_at,trials_enabled,cardless_trials_enabled,revision")
		.eq("singleton", true)
		.abortSignal(AbortSignal.timeout(3000))
		.single();
	if (error || !data) throw new Error("Hosting offer unavailable");
	return data as HostingOfferPolicy;
}

/** Display only: no Stripe reads, price lookups, subscriptions or trial writes. */
export async function readHostingOffer(
	hosting: HostingAccess | undefined,
	serverTime: string,
	read = readPolicy,
): Promise<HostingOffer | undefined> {
	if (!hosting || hosting.canHost || hosting.trialEligibility !== "eligible")
		return undefined;
	try {
		const policy = await read();
		// A policy change between authority and this read must not advertise stale terms.
		if (
			!policy.trials_enabled ||
			policy.revision !== hosting.hostingPolicyVersion ||
			!policy.activation_at ||
			Date.parse(policy.activation_at) !== Date.parse(hosting.hostingActivationAt ?? "") ||
			!(Date.parse(policy.activation_at) <= Date.parse(serverTime))
		) return undefined;
		return {
			trialMode: policy.cardless_trials_enabled === true ? "cardless" : "card_required",
			trialDays: 3,
			policyRevision: policy.revision,
		};
	} catch {
		// Missing optional copy must never take account access or history down.
		return undefined;
	}
}
