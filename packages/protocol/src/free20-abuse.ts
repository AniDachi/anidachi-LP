import { z } from "zod";
import { HostingTimeBindingSchema } from "./hosting-time";

export const FREE20_CONTEXT_HEADER = "x-anidachi-free20-context";
export const FREE20_INSTALLATION_SIGNING_PREFIX =
	"anidachi-free20-installation-v1\n";
export const FREE20_CHALLENGE_TTL_SECONDS = 300;
export const FREE20_CONTEXT_TTL_SECONDS = 1800;
export const FREE20_CONTEXT_REQUEST_MAX_BYTES = 4096;
const Token = z
	.string()
	.min(80)
	.max(2048)
	.regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
export const Free20ChallengeSchema = Token;
export const Free20InstallationProofSchema = z.strictObject({
	version: z.literal(1),
	challenge: Free20ChallengeSchema,
	publicKey: z
		.string()
		.min(100)
		.max(180)
		.regex(/^[A-Za-z0-9_-]+$/),
	signature: z
		.string()
		.length(86)
		.regex(/^[A-Za-z0-9_-]+$/),
});
export type Free20InstallationProof = z.infer<
	typeof Free20InstallationProofSchema
>;
export const Free20ContextRequestSchema = z.discriminatedUnion("action", [
	z.strictObject({ action: z.literal("challenge"), requestId: z.uuid() }),
	z.strictObject({
		action: z.literal("complete"),
		requestId: z.uuid(),
		proof: Free20InstallationProofSchema,
	}),
]);
export type Free20ContextRequest = z.infer<typeof Free20ContextRequestSchema>;
export const Free20ContextResponseSchema = z.discriminatedUnion("action", [
	z.strictObject({
		action: z.literal("challenge"),
		challenge: Free20ChallengeSchema,
		expiresAt: z.number().int().positive(),
	}),
	z.strictObject({
		action: z.literal("complete"),
		context: Token,
		expiresAt: z.number().int().positive(),
	}),
]);
export type Free20ContextResponse = z.infer<typeof Free20ContextResponseSchema>;
const Digest = z.string().regex(/^[a-f0-9]{64}$/);
const TransferBinding = z.strictObject({
	version: z.literal(1),
	transferId: Digest,
	ownerUserId: HostingTimeBindingSchema.shape.ownerUserId,
	roomId: HostingTimeBindingSchema.shape.roomId,
	roomGeneration: z.literal(1),
});
/** Internal authenticated transport ONLY. Never log or expose marker hashes. The
 * identity hashes the exact owner/room/generation/scopes, independent of token TTL.
 * The DO persists this intent and stopped meter atomically before any attachment.
 */
export const Free20ContextTransferRequestSchema = TransferBinding.extend({
	browserHash: Digest,
	installationHash: Digest,
});
export type Free20ContextTransferRequest = z.infer<
	typeof Free20ContextTransferRequestSchema
>;
/** Persist exact applied receipts: replay must not detach the replacement host. */
export const Free20ContextTransferReceiptSchema = TransferBinding.extend({
	outcome: z.literal("applied"),
});
export type Free20ContextTransferReceipt = z.infer<
	typeof Free20ContextTransferReceiptSchema
>;
