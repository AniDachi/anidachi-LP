import { describe, expect, it } from "vitest";
import {
	cameraEnabledPreferenceStorageKeyForUser,
	getDefaultRoomJoinDefaults,
	loadCameraEnabledPreference,
	loadRoomJoinDefaults,
	parseRoomJoinDefaults,
	persistCameraEnabledPreference,
	persistRoomJoinDefaults,
	resolveRoomMediaDefaults,
	roomJoinDefaultsStorageKeyForUser,
} from "../src/room-media-defaults";

class MemoryStorageArea {
	readonly values = new Map<string, unknown>();

	async get(key: string): Promise<Record<string, unknown>> {
		return this.values.has(key) ? { [key]: this.values.get(key) } : {};
	}

	async set(items: Record<string, unknown>): Promise<void> {
		for (const [key, value] of Object.entries(items)) {
			this.values.set(key, value);
		}
	}
}

describe("room media defaults", () => {
	it("uses last microphone choice and a privacy-safe camera-off default", () => {
		expect(getDefaultRoomJoinDefaults()).toEqual({
			version: 1,
			microphoneOnJoin: "last-used",
			cameraOnJoin: "off",
		});
	});

	it("normalizes each malformed setting independently", () => {
		expect(
			parseRoomJoinDefaults({
				version: 1,
				microphoneOnJoin: "always",
				cameraOnJoin: "last-used",
			}),
		).toEqual({
			version: 1,
			microphoneOnJoin: "last-used",
			cameraOnJoin: "last-used",
		});
	});

	it("keeps join defaults and camera history isolated by account", () => {
		expect(roomJoinDefaultsStorageKeyForUser("user-a")).not.toBe(
			roomJoinDefaultsStorageKeyForUser("user-b"),
		);
		expect(cameraEnabledPreferenceStorageKeyForUser("user-a")).not.toBe(
			cameraEnabledPreferenceStorageKeyForUser("user-b"),
		);
	});

	it("persists and restores account-scoped defaults and the last explicit camera choice", async () => {
		const storage = new MemoryStorageArea();
		await persistRoomJoinDefaults(storage, "user-a", {
			version: 1,
			microphoneOnJoin: "open-mic",
			cameraOnJoin: "last-used",
		});
		await persistCameraEnabledPreference(storage, "user-a", true);

		await expect(loadRoomJoinDefaults(storage, "user-a")).resolves.toEqual({
			version: 1,
			microphoneOnJoin: "open-mic",
			cameraOnJoin: "last-used",
		});
		await expect(loadCameraEnabledPreference(storage, "user-a")).resolves.toBe(
			true,
		);
		await expect(loadRoomJoinDefaults(storage, "user-b")).resolves.toEqual(
			getDefaultRoomJoinDefaults(),
		);
		await expect(loadCameraEnabledPreference(storage, "user-b")).resolves.toBe(
			false,
		);
	});

	it.each([
		{
			expected: { cameraEnabled: true, voiceMode: "open-mic" },
			lastCameraEnabled: true,
			lastVoiceMode: "open-mic" as const,
			preferences: {
				version: 1 as const,
				microphoneOnJoin: "last-used" as const,
				cameraOnJoin: "last-used" as const,
			},
		},
		{
			expected: { cameraEnabled: false, voiceMode: "push-to-talk" },
			lastCameraEnabled: true,
			lastVoiceMode: "open-mic" as const,
			preferences: {
				version: 1 as const,
				microphoneOnJoin: "push-to-talk" as const,
				cameraOnJoin: "off" as const,
			},
		},
		{
			expected: { cameraEnabled: true, voiceMode: "open-mic" },
			lastCameraEnabled: false,
			lastVoiceMode: "push-to-talk" as const,
			preferences: {
				version: 1 as const,
				microphoneOnJoin: "open-mic" as const,
				cameraOnJoin: "on" as const,
			},
		},
	])("resolves a new room from $preferences", ({
		expected,
		lastCameraEnabled,
		lastVoiceMode,
		preferences,
	}) => {
		expect(
			resolveRoomMediaDefaults({
				lastCameraEnabled,
				lastVoiceMode,
				preferences,
			}),
		).toEqual(expected);
	});
});
