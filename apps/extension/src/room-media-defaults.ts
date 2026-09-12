import { MAX_PARTICIPANT_ID_CHARS } from "@anidachi/protocol";
import type { VoiceMode } from "./media-types";

const ROOM_JOIN_DEFAULTS_VERSION = 1 as const;
const ROOM_JOIN_DEFAULTS_STORAGE_KEY_PREFIX =
	"anidachi:room-join-defaults:v1:user:";
const CAMERA_ENABLED_PREFERENCE_VERSION = 1 as const;
const CAMERA_ENABLED_PREFERENCE_STORAGE_KEY_PREFIX =
	"anidachi:camera-enabled-preference:v1:user:";

export type MicrophoneOnJoin = "last-used" | VoiceMode;
export type CameraOnJoin = "last-used" | "off" | "on";

export interface RoomJoinDefaultsV1 {
	version: typeof ROOM_JOIN_DEFAULTS_VERSION;
	microphoneOnJoin: MicrophoneOnJoin;
	cameraOnJoin: CameraOnJoin;
}

export type RoomJoinDefaultsPatch = Partial<
	Pick<RoomJoinDefaultsV1, "microphoneOnJoin" | "cameraOnJoin">
>;

export interface StorageAreaLike {
	get(key: string): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
}

interface CameraEnabledPreferenceRecord {
	version: typeof CAMERA_ENABLED_PREFERENCE_VERSION;
	enabled: boolean;
}

export function getDefaultRoomJoinDefaults(): RoomJoinDefaultsV1 {
	return {
		version: ROOM_JOIN_DEFAULTS_VERSION,
		microphoneOnJoin: "last-used",
		cameraOnJoin: "off",
	};
}

export function parseRoomJoinDefaults(value: unknown): RoomJoinDefaultsV1 {
	const defaults = getDefaultRoomJoinDefaults();
	if (!isRecord(value) || value.version !== ROOM_JOIN_DEFAULTS_VERSION) {
		return defaults;
	}

	return {
		version: ROOM_JOIN_DEFAULTS_VERSION,
		microphoneOnJoin: isMicrophoneOnJoin(value.microphoneOnJoin)
			? value.microphoneOnJoin
			: defaults.microphoneOnJoin,
		cameraOnJoin: isCameraOnJoin(value.cameraOnJoin)
			? value.cameraOnJoin
			: defaults.cameraOnJoin,
	};
}

export function updateRoomJoinDefaults(
	current: RoomJoinDefaultsV1,
	patch: RoomJoinDefaultsPatch,
): RoomJoinDefaultsV1 {
	return parseRoomJoinDefaults({
		...current,
		...patch,
		version: ROOM_JOIN_DEFAULTS_VERSION,
	});
}

export function roomJoinDefaultsStorageKeyForUser(userId: string): string {
	return storageKeyForUser(ROOM_JOIN_DEFAULTS_STORAGE_KEY_PREFIX, userId);
}

export function cameraEnabledPreferenceStorageKeyForUser(
	userId: string,
): string {
	return storageKeyForUser(
		CAMERA_ENABLED_PREFERENCE_STORAGE_KEY_PREFIX,
		userId,
	);
}

export async function loadRoomJoinDefaults(
	storage: StorageAreaLike,
	userId: string,
): Promise<RoomJoinDefaultsV1> {
	try {
		const key = roomJoinDefaultsStorageKeyForUser(userId);
		const stored = await storage.get(key);
		return parseRoomJoinDefaults(stored[key]);
	} catch {
		return getDefaultRoomJoinDefaults();
	}
}

export async function persistRoomJoinDefaults(
	storage: StorageAreaLike,
	userId: string,
	preferences: RoomJoinDefaultsV1,
): Promise<void> {
	const key = roomJoinDefaultsStorageKeyForUser(userId);
	await storage.set({ [key]: parseRoomJoinDefaults(preferences) });
}

export async function loadCameraEnabledPreference(
	storage: StorageAreaLike,
	userId: string,
): Promise<boolean> {
	try {
		const key = cameraEnabledPreferenceStorageKeyForUser(userId);
		const stored = await storage.get(key);
		const value = stored[key];
		return (
			isRecord(value) &&
			value.version === CAMERA_ENABLED_PREFERENCE_VERSION &&
			value.enabled === true
		);
	} catch {
		return false;
	}
}

export async function persistCameraEnabledPreference(
	storage: StorageAreaLike,
	userId: string,
	enabled: boolean,
): Promise<void> {
	const key = cameraEnabledPreferenceStorageKeyForUser(userId);
	const record: CameraEnabledPreferenceRecord = {
		version: CAMERA_ENABLED_PREFERENCE_VERSION,
		enabled,
	};
	await storage.set({ [key]: record });
}

export function resolveRoomMediaDefaults({
	lastCameraEnabled,
	lastVoiceMode,
	preferences,
}: {
	lastCameraEnabled: boolean;
	lastVoiceMode: VoiceMode;
	preferences: RoomJoinDefaultsV1;
}): { cameraEnabled: boolean; voiceMode: VoiceMode } {
	return {
		cameraEnabled:
			preferences.cameraOnJoin === "last-used"
				? lastCameraEnabled
				: preferences.cameraOnJoin === "on",
		voiceMode:
			preferences.microphoneOnJoin === "last-used"
				? lastVoiceMode
				: preferences.microphoneOnJoin,
	};
}

function storageKeyForUser(prefix: string, userId: string): string {
	const normalizedUserId = userId.trim();
	if (!normalizedUserId || normalizedUserId.length > MAX_PARTICIPANT_ID_CHARS) {
		throw new Error("A valid user ID is required for room media defaults.");
	}
	return `${prefix}${encodeURIComponent(normalizedUserId)}`;
}

function isMicrophoneOnJoin(value: unknown): value is MicrophoneOnJoin {
	return (
		value === "last-used" || value === "push-to-talk" || value === "open-mic"
	);
}

function isCameraOnJoin(value: unknown): value is CameraOnJoin {
	return value === "last-used" || value === "off" || value === "on";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
