import { createHash } from "node:crypto";
import {
	Free20ContextTransferReceiptSchema,
	type Free20ContextTransferRequest,
	Free20ContextTransferRequestSchema,
} from "@anidachi/protocol";
import { internalServiceAuthorization } from "../internal-service-auth";
import { type Free20AbuseContext, Free20ContextError } from "./free20-abuse";
import { boundedFree20, readBoundedFree20Json } from "./free20-abuse-http";
export function buildFree20ContextTransfer(
	ownerUserId: string,
	roomId: string,
	context: Free20AbuseContext,
): Free20ContextTransferRequest {
	const payload = {
		version: 1 as const,
		ownerUserId,
		roomId,
		roomGeneration: 1 as const,
		browserHash: context.browser,
		installationHash: context.installation,
	};
	const transferId = createHash("sha256")
		.update(
			"anidachi-free20-context-transfer-v1\n" +
				JSON.stringify([
					payload.ownerUserId,
					payload.roomId,
					payload.roomGeneration,
					payload.browserHash,
					payload.installationHash,
				]),
		)
		.digest("hex");
	return Free20ContextTransferRequestSchema.parse({ ...payload, transferId });
}
/** Web only initiates the existing room's DO transfer. It must NEVER attach SQL
 * scopes itself. A missing/incompatible receiver is retryably unavailable. */
export async function transferFree20RoomContext(
	input: Free20ContextTransferRequest,
	options: {
		base?: string;
		secret?: string;
		fetch?: typeof fetch;
		timeoutMs?: number;
	} = {},
) {
	try {
		const request = Free20ContextTransferRequestSchema.parse(input),
			base = options.base ?? process.env.ANIDACHI_API_INTERNAL_BASE_URL,
			secret = options.secret ?? process.env.ANIDACHI_INTERNAL_API_SECRET;
		if (!base || !secret) throw new Error("Unavailable");
		return await boundedFree20(
			Math.max(1, Math.min(10_000, options.timeoutMs ?? 10_000)),
			async (signal) => {
				const response = await (options.fetch ?? fetch)(
					new URL(
						`/internal/rooms/${encodeURIComponent(request.roomId)}/free20-context`,
						base,
					),
					{
						method: "POST",
						headers: {
							Authorization: internalServiceAuthorization(secret),
							"Content-Type": "application/json",
						},
						body: JSON.stringify(request),
						cache: "no-store",
						redirect: "error",
						signal,
					},
				);
				const body = await readBoundedFree20Json(response.body, 4096);
				if (
					response.status === 409 &&
					body &&
					typeof body === "object" &&
					(body as { code?: unknown }).code === "FREE20_CONTEXT_BUSY"
				)
					throw new Free20ContextError("FREE20_CONTEXT_BUSY");
				if (response.status !== 200) throw new Error("Unavailable");
				const receipt = Free20ContextTransferReceiptSchema.parse(body);
				if (
					receipt.transferId !== request.transferId ||
					receipt.ownerUserId !== request.ownerUserId ||
					receipt.roomId !== request.roomId ||
					receipt.roomGeneration !== request.roomGeneration
				)
					throw new Error("Unavailable");
				return receipt;
			},
		);
	} catch (error) {
		if (error instanceof Free20ContextError) throw error;
		throw new Error("ROOM_AUTHORITY_UNAVAILABLE");
	}
}
