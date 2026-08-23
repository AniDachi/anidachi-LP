import { RoomSessionAdmissionInputSchema } from "@anidachi/protocol";
import { RoomSourcePersistenceError } from "./room-source";

export type RoomCreateRequestInput = {
	participantSessionId: string;
	showId?: string;
	episodeId?: string;
	sourceProvider?: unknown;
	sourceUrl?: unknown;
	videoFingerprint?: unknown;
	title?: string;
	clientRequestId?: string;
};

type RoomCreateFailure = {
	ok: false;
	status: 400;
	body: { error: string; code: "INVALID_REQUEST" | "INVALID_ROOM_SOURCE" };
};

export async function handleRoomCreateRequestBody<T>(params: {
	readBody: () => Promise<string>;
	create: (input: RoomCreateRequestInput) => Promise<T>;
}): Promise<{ ok: true; value: T } | RoomCreateFailure> {
	let rawBody: string;
	try {
		rawBody = await params.readBody();
	} catch {
		return invalidRequest();
	}
	const parsed = parseRoomCreateRequestBody(rawBody);
	if (!parsed.ok) return parsed;

	try {
		return { ok: true, value: await params.create(parsed.input) };
	} catch (error) {
		if (
			error instanceof RoomSourcePersistenceError &&
			error.kind === "invalid"
		) {
			return {
				ok: false,
				status: 400,
				body: {
					error: "Invalid room source",
					code: "INVALID_ROOM_SOURCE",
				},
			};
		}
		throw error;
	}
}

function parseRoomCreateRequestBody(
	rawBody: string,
): { ok: true; input: RoomCreateRequestInput } | RoomCreateFailure {
	let value: unknown;
	if (rawBody === "") {
		value = {};
	} else {
		try {
			value = JSON.parse(rawBody);
		} catch {
			return invalidRequest();
		}
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return invalidRequest();
	}

	const record = value as Record<string, unknown>;
	const admission = RoomSessionAdmissionInputSchema.safeParse({
		participantSessionId: record.participantSessionId,
	});
	if (!admission.success) return invalidRequest();
	const input: RoomCreateRequestInput = {
		participantSessionId: admission.data.participantSessionId,
	};
	assignCleanString(input, "showId", record.showId, 200);
	assignCleanString(input, "episodeId", record.episodeId, 200);
	assignCleanString(input, "title", record.title, 300);
	assignCleanString(input, "clientRequestId", record.clientRequestId, 100);
	for (const key of [
		"sourceProvider",
		"sourceUrl",
		"videoFingerprint",
	] as const) {
		if (Object.hasOwn(record, key)) input[key] = record[key];
	}
	return { ok: true, input };
}

function assignCleanString(
	target: RoomCreateRequestInput,
	key: "showId" | "episodeId" | "title" | "clientRequestId",
	value: unknown,
	maxLength: number,
): void {
	if (typeof value !== "string") return;
	const cleaned = value.trim();
	if (cleaned) target[key] = cleaned.slice(0, maxLength);
}

function invalidRequest(): RoomCreateFailure {
	return {
		ok: false,
		status: 400,
		body: { error: "Invalid request", code: "INVALID_REQUEST" },
	};
}
