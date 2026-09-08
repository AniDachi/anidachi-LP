import {
	RoomPresenceEvidenceSchema,
	RoomPresenceAcknowledgementSchema,
	type RoomPresenceEvidence,
} from "@anidachi/protocol";
import { hasValidInternalServiceAuthorization } from "../internal-service-auth";

export async function handleInternalRoomPresencePost(input: {
	authorization: string | null;
	secret?: string;
	readJson: () => Promise<unknown>;
	persist: (evidence: RoomPresenceEvidence) => Promise<unknown>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
	if (!hasValidInternalServiceAuthorization(input.authorization, input.secret))
		return { status: 401, body: { error: "Unauthorized" } };
	let raw: unknown;
	try {
		raw = await input.readJson();
	} catch {
		return { status: 400, body: { error: "Invalid presence evidence" } };
	}
	const parsed = RoomPresenceEvidenceSchema.safeParse(raw);
	if (!parsed.success)
		return { status: 400, body: { error: "Invalid presence evidence" } };
	try {
		const ack = RoomPresenceAcknowledgementSchema.safeParse(
			await input.persist(parsed.data),
		);
		if (!ack.success) throw new Error("Invalid acknowledgement");
		return { status: 200, body: ack.data };
	} catch {
		return { status: 503, body: { error: "Presence persistence unavailable" } };
	}
}
