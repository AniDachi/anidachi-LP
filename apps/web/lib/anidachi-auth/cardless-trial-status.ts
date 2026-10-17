import type { PendingTrialActivation } from "../billing-view";
import { db } from "./db";

/** Read-only discovery survives a new document and disabled new-trial policy. */
export async function readPendingTrialActivation(
	userId: string,
	load: (userId: string) => Promise<unknown> = loadPendingActivation,
): Promise<PendingTrialActivation | null> {
	const row = (await load(userId)) as Record<string, unknown> | null;
	if (!row) return null;
	if (
		row.user_id !== userId ||
		typeof row.id !== "string" ||
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			row.id,
		) ||
		!["pending", "created"].includes(String(row.state)) ||
		!["plus", "pro"].includes(String(row.plan_code)) ||
		!["monthly", "yearly"].includes(String(row.billing_period))
	) {
		throw new Error("Trial activation ownership or state unavailable");
	}
	return {
		id: row.id,
		planCode: row.plan_code as "plus" | "pro",
		billingPeriod: row.billing_period as "monthly" | "yearly",
	};
}

async function loadPendingActivation(userId: string): Promise<unknown> {
	const { data, error } = await db()
		.from("subscription_trial_activations")
		.select("id,user_id,plan_code,billing_period,state")
		.eq("user_id", userId)
		.in("state", ["pending", "created"])
		.abortSignal(AbortSignal.timeout(8_000))
		.maybeSingle();
	if (error) throw new Error("Trial activation status unavailable");
	return data;
}
