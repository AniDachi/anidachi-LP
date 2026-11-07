import { describe, expect, it } from "vitest";
import {
	Free20ContextRequestSchema,
	Free20ContextResponseSchema,
	Free20ContextTransferReceiptSchema,
	Free20ContextTransferRequestSchema,
} from "./free20-abuse";

const owner = "ab000000-0000-4000-8000-000000000001";
describe("strict Free20 evidence transport", () => {
	it("accepts only bounded enrollment operations and opaque responses", () => {
		expect(
			Free20ContextRequestSchema.safeParse({
				action: "challenge",
				requestId: owner,
			}).success,
		).toBe(true);
		expect(
			Free20ContextRequestSchema.safeParse({
				action: "complete",
				requestId: owner,
			}).success,
		).toBe(false);
		expect(
			Free20ContextRequestSchema.safeParse({
				action: "challenge",
				requestId: owner,
				browserHash: "a".repeat(64),
			}).success,
		).toBe(false);
		expect(
			Free20ContextResponseSchema.safeParse({
				action: "complete",
				context: "x".repeat(4097),
				expiresAt: 42,
			}).success,
		).toBe(false);
	});
	it("keeps scoped transfer private and receipts exact without marker fields", () => {
		const request = {
			version: 1,
			transferId: "a".repeat(64),
			ownerUserId: owner,
			roomId: "room-test",
			roomGeneration: 1,
			browserHash: "b".repeat(64),
			installationHash: "c".repeat(64),
		};
		expect(Free20ContextTransferRequestSchema.safeParse(request).success).toBe(
			true,
		);
		expect(
			Free20ContextTransferRequestSchema.safeParse({
				...request,
				roomGeneration: 2,
			}).success,
		).toBe(false);
		const receipt = {
			version: 1,
			transferId: request.transferId,
			ownerUserId: owner,
			roomId: request.roomId,
			roomGeneration: 1,
			outcome: "applied",
		};
		expect(Free20ContextTransferReceiptSchema.safeParse(receipt).success).toBe(
			true,
		);
		expect(
			Free20ContextTransferReceiptSchema.safeParse({
				...receipt,
				browserHash: request.browserHash,
			}).success,
		).toBe(false);
	});
});
