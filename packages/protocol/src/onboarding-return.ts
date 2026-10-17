import { z } from "zod";

/** Navigation only. These messages never grant a trial, subscription or room. */
export const ONBOARDING_RETURN_TTL_MS = 60 * 60 * 1000;
export const ONBOARDING_CHECKOUT_OPEN = "ANIDACHI_ONBOARDING_CHECKOUT_OPEN";
export const ONBOARDING_RETURN_PROBE = "ANIDACHI_ONBOARDING_RETURN_PROBE";
export const ONBOARDING_RETURN = "anidachi:onboarding-return:v1";
export const OnboardingTokenSchema = z.string().uuid();
export const OnboardingCheckoutOpenSchema = z
	.object({
		type: z.literal(ONBOARDING_CHECKOUT_OPEN),
		token: OnboardingTokenSchema,
		offer: z.enum(["trial", "plans", "check"]),
	})
	.strict();
export const OnboardingReturnSchema = z
	.object({
		type: z.literal(ONBOARDING_RETURN),
		token: OnboardingTokenSchema,
		ownerUserId: z.string().min(1).max(128),
	})
	.strict();
