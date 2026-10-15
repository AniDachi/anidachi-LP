import { z } from "zod";

export const TRIAL_INSTALLATION_MESSAGE =
	"anidachi:trial-installation-proof:v1";
export const TRIAL_INSTALLATION_SIGNING_PREFIX =
	"anidachi-trial-installation-v1\n";
export const TrialChallengeSchema = z
	.string()
	.min(80)
	.max(2048)
	.regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
export const TrialInstallationRequestSchema = z
	.object({
		type: z.literal(TRIAL_INSTALLATION_MESSAGE),
		challenge: TrialChallengeSchema,
	})
	.strict();
export const TrialInstallationProofSchema = z
	.object({
		version: z.literal(1),
		challenge: TrialChallengeSchema,
		publicKey: z
			.string()
			.min(100)
			.max(180)
			.regex(/^[A-Za-z0-9_-]+$/),
		signature: z
			.string()
			.length(86)
			.regex(/^[A-Za-z0-9_-]+$/),
	})
	.strict();
export type TrialInstallationProof = z.infer<
	typeof TrialInstallationProofSchema
>;
