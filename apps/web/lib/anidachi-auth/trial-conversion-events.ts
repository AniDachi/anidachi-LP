import {
	deliverAmplitudeServerEvent,
	type AmplitudeServerEvent,
} from "../amplitude-server";
import { isAmplitudeInsertId } from "../amplitude-ids";
import { db } from "./db";

export type TrialAnalyticsEnvironment = "staging" | "production";
export type TrialConversionEvent = {
	id: string;
	userId: string;
	eventType:
		| "trial_started"
		| "trial_renewal_enabled"
		| "trial_first_payment_succeeded"
		| "trial_first_room_created"
		| "trial_first_shared_session";
	mode: "cardless" | "card_required";
	planCode: "plus" | "pro";
	billingPeriod: "monthly" | "yearly";
	occurredAt: string;
	environment: TrialAnalyticsEnvironment;
};
export type TrialConversionClaim = TrialConversionEvent & {
	leaseToken: string;
};
export interface TrialConversionRepository {
	claim(
		environment: TrialAnalyticsEnvironment,
		limit: number,
	): Promise<TrialConversionClaim[]>;
	finish(claim: TrialConversionClaim, delivered: boolean): Promise<boolean>;
}
const EVENT_TYPES = new Set<TrialConversionEvent["eventType"]>([
	"trial_started",
	"trial_renewal_enabled",
	"trial_first_payment_succeeded",
	"trial_first_room_created",
	"trial_first_shared_session",
]);

/** Only reviewed deployment targets deliver; public SEO URLs do not identify a runtime. */
export function resolveTrialAnalyticsEnvironment(
	env: Record<string, string | undefined> = {
		VERCEL_ENV: process.env.VERCEL_ENV,
		VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
	},
): TrialAnalyticsEnvironment | null {
	if (env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === "staging")
		return "staging";
	if (env.VERCEL_ENV === "production" && env.VERCEL_GIT_COMMIT_REF === "main")
		return "production";
	return null;
}

/** Only a transactionally recorded, verified transition reaches this publisher. */
export async function recordTrialConversion(
	event: TrialConversionEvent,
	deliver: (
		event: AmplitudeServerEvent,
	) => Promise<boolean> = deliverAmplitudeServerEvent,
): Promise<boolean> {
	if (
		!event ||
		!isAmplitudeInsertId(event.id) ||
		!isAmplitudeInsertId(event.userId) ||
		!EVENT_TYPES.has(event.eventType) ||
		!["cardless", "card_required"].includes(event.mode) ||
		!["plus", "pro"].includes(event.planCode) ||
		!["monthly", "yearly"].includes(event.billingPeriod) ||
		!["staging", "production"].includes(event.environment) ||
		!Number.isFinite(Date.parse(event.occurredAt)) ||
		Date.parse(event.occurredAt) <= 0
	)
		return false;
	return deliver({
		eventType: event.eventType,
		insertId: event.id,
		userId: event.userId,
		occurredAt: Date.parse(event.occurredAt),
		properties: {
			trial_mode: event.mode,
			plan: event.planCode,
			billing_period: event.billingPeriod,
			environment: event.environment,
			source: "verified_server",
		},
	});
}

/** One bounded batch; SQL owns retry timing, lease recovery and the immutable insert ID. */
export async function drainTrialConversionEvents(
	options: {
		environment?: TrialAnalyticsEnvironment | null;
		repository?: TrialConversionRepository;
		deliver?: (event: AmplitudeServerEvent) => Promise<boolean>;
	} = {},
) {
	const summary = { claimed: 0, delivered: 0, retried: 0, errors: 0 };
	const environment =
		options.environment === undefined
			? resolveTrialAnalyticsEnvironment()
			: options.environment;
	if (!environment) return summary;
	const repository = options.repository ?? defaultRepository;
	let claims: TrialConversionClaim[];
	try {
		claims = await repository.claim(environment, 8);
	} catch {
		summary.errors++;
		return summary;
	}
	summary.claimed = claims.length;
	await Promise.all(
		claims.map(async (claim) => {
			if (claim.environment !== environment) {
				summary.errors++;
				return;
			}
			let delivered = false;
			try {
				delivered = await recordTrialConversion(claim, options.deliver);
			} catch {
				/* unknown receipt: retry with the same identity */
			}
			try {
				if (!(await repository.finish(claim, delivered))) {
					summary.errors++;
					return;
				}
				if (delivered) summary.delivered++;
				else summary.retried++;
			} catch {
				summary.errors++;
			}
		}),
	);
	return summary;
}

const defaultRepository: TrialConversionRepository = {
	async claim(environment, limit) {
		const { data, error } = await db()
			.rpc("claim_trial_conversion_events_v1", {
				p_environment: environment,
				p_limit: limit,
			})
			.abortSignal(AbortSignal.timeout(3_000));
		if (error || !Array.isArray(data))
			throw Error("trial_conversion_claim_unavailable");
		return data.map((r) => ({
			id: r.id,
			userId: r.user_id,
			eventType: r.event_type,
			mode: r.trial_mode,
			planCode: r.plan_code,
			billingPeriod: r.billing_period,
			occurredAt: r.occurred_at,
			environment: r.environment,
			leaseToken: r.lease_token,
		}));
	},
	async finish(claim, delivered) {
		const { data, error } = await db()
			.rpc("finish_trial_conversion_event_v1", {
				p_id: claim.id,
				p_lease_token: claim.leaseToken,
				p_environment: claim.environment,
				p_delivered: delivered,
			})
			.abortSignal(AbortSignal.timeout(3_000));
		if (error || typeof data !== "boolean")
			throw Error("trial_conversion_finish_unavailable");
		return data;
	},
};
