import {
	canonicalizeRoomSourceUrl,
	isLegacyRoomSourceFingerprintAlias,
	MAX_ROOM_ID_CHARS,
	type RoomSourceDescriptor,
	RoomSourceDescriptorSchema,
	type RoomSourcePersistenceAcknowledgement,
	RoomSourcePersistenceAcknowledgementSchema,
	type RoomSourcePersistenceCallback,
	RoomSourcePersistenceCallbackSchema,
	type RoomSourceProvider,
} from "@anidachi/protocol";
import { hasValidInternalServiceAuthorization } from "../internal-service-auth";

export type RoomSourcePersistenceErrorKind =
	| "invalid"
	| "not-found"
	| "ended"
	| "conflict"
	| "unexpected";

export class RoomSourcePersistenceError extends Error {
	readonly kind: RoomSourcePersistenceErrorKind;

	constructor(
		kind: RoomSourcePersistenceErrorKind,
		message = "Room source persistence failed",
	) {
		super(message);
		this.name = "RoomSourcePersistenceError";
		this.kind = kind;
	}
}

export type RoomSourceCreationColumns = {
	source_provider: RoomSourceProvider | null;
	source_url: string | null;
	video_fingerprint: string | null;
	source_generation: number | null;
};

export function roomSourceCreationColumns(input: {
	sourceUrl?: unknown;
	sourceProvider?: unknown;
	videoFingerprint?: unknown;
}): RoomSourceCreationColumns {
	const hasSourceInput =
		input.sourceUrl !== undefined ||
		input.sourceProvider !== undefined ||
		input.videoFingerprint !== undefined;
	if (!hasSourceInput) {
		return {
			source_provider: null,
			source_url: null,
			video_fingerprint: null,
			source_generation: null,
		};
	}
	if (
		typeof input.sourceUrl !== "string" ||
		(input.sourceProvider !== undefined &&
			typeof input.sourceProvider !== "string") ||
		(input.videoFingerprint !== undefined &&
			typeof input.videoFingerprint !== "string")
	) {
		throw new RoomSourcePersistenceError(
			"invalid",
			"Invalid room source input",
		);
	}

	const canonical = canonicalizeRoomSourceUrl(input.sourceUrl);
	if (
		!canonical.ok ||
		(input.sourceProvider !== undefined &&
			input.sourceProvider !== canonical.source.provider) ||
		(input.videoFingerprint !== undefined &&
			input.videoFingerprint !== canonical.source.videoFingerprint &&
			!isLegacyRoomSourceFingerprintAlias(
				input.sourceUrl,
				input.videoFingerprint,
			))
	) {
		throw new RoomSourcePersistenceError(
			"invalid",
			"Invalid room source input",
		);
	}

	return {
		source_provider: canonical.source.provider,
		source_url: canonical.source.sourceUrl,
		video_fingerprint: canonical.source.videoFingerprint,
		source_generation: 1,
	};
}

export type DurableRoomSourceRow = {
	source_provider: unknown;
	source_url: unknown;
	video_fingerprint: unknown;
	source_generation: unknown;
};

export type DerivedDurableRoomSource = {
	source: RoomSourceDescriptor;
	sourceGeneration: number | null;
	legacy: boolean;
};

export function deriveDurableRoomSource(
	row: DurableRoomSourceRow,
): DerivedDurableRoomSource | null {
	const providerMissing = row.source_provider === null;
	const generationMissing = row.source_generation === null;
	if (providerMissing !== generationMissing) return null;

	if (providerMissing) {
		if (row.source_url === null && row.video_fingerprint === null) return null;
		if (typeof row.source_url !== "string") return null;
		const canonical = canonicalizeRoomSourceUrl(row.source_url);
		if (!canonical.ok) return null;
		if (
			row.video_fingerprint !== null &&
			row.video_fingerprint !== canonical.source.videoFingerprint &&
			(typeof row.video_fingerprint !== "string" ||
				!isLegacyRoomSourceFingerprintAlias(
					row.source_url,
					row.video_fingerprint,
				))
		) {
			return null;
		}
		return {
			source: canonical.source,
			sourceGeneration: null,
			legacy: true,
		};
	}

	if (
		typeof row.source_provider !== "string" ||
		typeof row.source_url !== "string" ||
		typeof row.video_fingerprint !== "string" ||
		!Number.isSafeInteger(row.source_generation) ||
		(row.source_generation as number) <= 0
	) {
		return null;
	}
	const parsed = RoomSourceDescriptorSchema.safeParse({
		provider: row.source_provider,
		sourceUrl: row.source_url,
		canonicalUrl: row.source_url,
		videoFingerprint: row.video_fingerprint,
	});
	if (!parsed.success) return null;
	return {
		source: parsed.data,
		sourceGeneration: row.source_generation as number,
		legacy: false,
	};
}

export function buildRoomSourceLaunchUrl(
	source: unknown,
	roomId: string,
): string | null {
	const parsed = RoomSourceDescriptorSchema.safeParse(source);
	if (
		!parsed.success ||
		roomId.length < 1 ||
		roomId.length > MAX_ROOM_ID_CHARS ||
		roomId.trim() !== roomId ||
		/[\0-\x1F\x7F]/.test(roomId)
	) {
		return null;
	}

	const url = new URL(parsed.data.sourceUrl);
	const hash = new URLSearchParams();
	hash.set("anidachiRoom", roomId);
	url.hash = hash.toString();
	return url.toString();
}

export function roomSourcePersistenceRpcArguments(
	callback: RoomSourcePersistenceCallback,
): {
	p_room_id: string;
	p_source_provider: RoomSourceProvider;
	p_source_url: string;
	p_video_fingerprint: string;
	p_source_generation: number;
} {
	const parsed = RoomSourcePersistenceCallbackSchema.parse(callback);
	return {
		p_room_id: parsed.roomId,
		p_source_provider: parsed.source.provider,
		p_source_url: parsed.source.sourceUrl,
		p_video_fingerprint: parsed.source.videoFingerprint,
		p_source_generation: parsed.sourceGeneration,
	};
}

export function parseRoomSourcePersistenceRpcResult(
	value: unknown,
	expectedGeneration: number,
): RoomSourcePersistenceAcknowledgement {
	if (!Array.isArray(value) || value.length !== 1) {
		throw new RoomSourcePersistenceError(
			"unexpected",
			"Malformed room source response",
		);
	}
	const row = value[0];
	if (
		typeof row !== "object" ||
		row === null ||
		Array.isArray(row) ||
		Object.keys(row).sort().join(",") !== "outcome,source_generation"
	) {
		throw new RoomSourcePersistenceError(
			"unexpected",
			"Malformed room source response",
		);
	}
	const record = row as Record<string, unknown>;
	if (
		(record.outcome !== "persisted" && record.outcome !== "stale") ||
		!Number.isSafeInteger(record.source_generation) ||
		record.source_generation !== expectedGeneration
	) {
		throw new RoomSourcePersistenceError(
			"unexpected",
			"Malformed room source response",
		);
	}
	const acknowledgement = RoomSourcePersistenceAcknowledgementSchema.safeParse({
		ok: true,
		outcome: record.outcome,
		sourceGeneration: record.source_generation,
	});
	if (!acknowledgement.success) {
		throw new RoomSourcePersistenceError(
			"unexpected",
			"Malformed room source response",
		);
	}
	return acknowledgement.data;
}

export function roomSourcePersistenceErrorFromDatabase(
	error: unknown,
): RoomSourcePersistenceError {
	if (error instanceof RoomSourcePersistenceError) return error;
	const code =
		typeof error === "object" && error !== null && "code" in error
			? (error as { code?: unknown }).code
			: undefined;
	if (code === "22023") return new RoomSourcePersistenceError("invalid");
	if (code === "P0002") return new RoomSourcePersistenceError("not-found");
	if (code === "55000") return new RoomSourcePersistenceError("ended");
	if (code === "23514") return new RoomSourcePersistenceError("conflict");
	return new RoomSourcePersistenceError("unexpected");
}

type InternalRoomSourceResponse = {
	status: number;
	body: RoomSourcePersistenceAcknowledgement | { error: string; code: string };
};

export async function handleInternalRoomSourcePost(params: {
	authorization: string | null;
	secret?: string;
	roomId: string;
	readJson: () => Promise<unknown>;
	persist: (
		callback: RoomSourcePersistenceCallback,
	) => Promise<RoomSourcePersistenceAcknowledgement>;
}): Promise<InternalRoomSourceResponse> {
	if (
		!hasValidInternalServiceAuthorization(params.authorization, params.secret)
	) {
		return {
			status: 401,
			body: { error: "Unauthorized", code: "UNAUTHORIZED" },
		};
	}

	let value: unknown;
	try {
		value = await params.readJson();
	} catch {
		return invalidCallbackResponse();
	}
	const callback = RoomSourcePersistenceCallbackSchema.safeParse(value);
	if (!callback.success || callback.data.roomId !== params.roomId) {
		return invalidCallbackResponse();
	}

	try {
		const result = RoomSourcePersistenceAcknowledgementSchema.safeParse(
			await params.persist(callback.data),
		);
		if (
			!result.success ||
			result.data.sourceGeneration !== callback.data.sourceGeneration
		) {
			throw new RoomSourcePersistenceError("unexpected");
		}
		return { status: 200, body: result.data };
	} catch (error) {
		return roomSourceErrorResponse(
			error instanceof RoomSourcePersistenceError
				? error
				: new RoomSourcePersistenceError("unexpected"),
		);
	}
}

function invalidCallbackResponse(): InternalRoomSourceResponse {
	return {
		status: 400,
		body: { error: "Invalid room source callback", code: "INVALID_REQUEST" },
	};
}

function roomSourceErrorResponse(
	error: RoomSourcePersistenceError,
): InternalRoomSourceResponse {
	if (error.kind === "invalid") {
		return {
			status: 400,
			body: { error: "Invalid room source", code: "INVALID_ROOM_SOURCE" },
		};
	}
	if (error.kind === "not-found") {
		return {
			status: 404,
			body: { error: "Room not found", code: "ROOM_NOT_FOUND" },
		};
	}
	if (error.kind === "ended") {
		return {
			status: 409,
			body: { error: "Room has ended", code: "ROOM_ENDED" },
		};
	}
	if (error.kind === "conflict") {
		return {
			status: 409,
			body: { error: "Room source conflict", code: "ROOM_SOURCE_CONFLICT" },
		};
	}
	return {
		status: 500,
		body: {
			error: "Unable to persist room source",
			code: "ROOM_SOURCE_PERSISTENCE_FAILED",
		},
	};
}
