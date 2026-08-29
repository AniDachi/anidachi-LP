import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "wxt/utils/storage";
import {
	getDefaultRoomJoinDefaults,
	parseRoomJoinDefaults,
	type RoomJoinDefaultsPatch,
	type RoomJoinDefaultsV1,
	roomJoinDefaultsStorageKeyForUser,
	updateRoomJoinDefaults,
} from "./room-media-defaults";

export interface RoomJoinDefaultsStorage {
	read(userId: string): Promise<unknown>;
	write(userId: string, preferences: RoomJoinDefaultsV1): Promise<void>;
}

export interface RoomJoinDefaultsController {
	error: string | null;
	preferences: RoomJoinDefaultsV1;
	ready: boolean;
	saving: boolean;
	update(patch: RoomJoinDefaultsPatch): void;
}

const defaultRoomJoinDefaultsStorage: RoomJoinDefaultsStorage = {
	read: (userId) =>
		storage.getItem<unknown>(
			`local:${roomJoinDefaultsStorageKeyForUser(userId)}`,
		),
	write: (userId, preferences) =>
		storage.setItem(
			`local:${roomJoinDefaultsStorageKeyForUser(userId)}`,
			preferences,
		),
};

export function useRoomJoinDefaults(
	userId: string | null,
	preferenceStorage: RoomJoinDefaultsStorage = defaultRoomJoinDefaultsStorage,
): RoomJoinDefaultsController {
	const [preferences, setPreferences] = useState(getDefaultRoomJoinDefaults);
	const [ready, setReady] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const mountedRef = useRef(false);
	const scopeRevisionRef = useRef(0);
	const preferencesRef = useRef(preferences);
	const appliedRef = useRef(preferences);
	const writeRevisionRef = useRef(0);
	const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

	useEffect(() => {
		mountedRef.current = true;
		const scopeRevision = ++scopeRevisionRef.current;
		const defaults = getDefaultRoomJoinDefaults();
		preferencesRef.current = defaults;
		appliedRef.current = defaults;
		setPreferences(defaults);
		setReady(false);
		setSaving(false);
		setError(null);

		if (!userId) {
			return () => {
				mountedRef.current = false;
			};
		}

		let cancelled = false;
		void preferenceStorage
			.read(userId)
			.then((value) => {
				if (
					cancelled ||
					!mountedRef.current ||
					scopeRevision !== scopeRevisionRef.current
				) {
					return;
				}
				const parsed = parseRoomJoinDefaults(value);
				preferencesRef.current = parsed;
				appliedRef.current = parsed;
				setPreferences(parsed);
				setReady(true);
			})
			.catch(() => {
				if (
					cancelled ||
					!mountedRef.current ||
					scopeRevision !== scopeRevisionRef.current
				) {
					return;
				}
				setReady(true);
				setError("Couldn't load room defaults.");
			});

		return () => {
			cancelled = true;
			mountedRef.current = false;
		};
	}, [preferenceStorage, userId]);

	const update = useCallback(
		(patch: RoomJoinDefaultsPatch) => {
			if (!userId || !ready) {
				return;
			}
			const next = updateRoomJoinDefaults(preferencesRef.current, patch);
			const writeRevision = ++writeRevisionRef.current;
			const scopeRevision = scopeRevisionRef.current;
			preferencesRef.current = next;
			setPreferences(next);
			setSaving(true);
			setError(null);

			writeQueueRef.current = writeQueueRef.current
				.catch(() => undefined)
				.then(async () => {
					try {
						await preferenceStorage.write(userId, next);
						if (scopeRevision === scopeRevisionRef.current) {
							appliedRef.current = next;
						}
						if (
							mountedRef.current &&
							scopeRevision === scopeRevisionRef.current &&
							writeRevision === writeRevisionRef.current
						) {
							setSaving(false);
						}
					} catch {
						if (
							mountedRef.current &&
							scopeRevision === scopeRevisionRef.current &&
							writeRevision === writeRevisionRef.current
						) {
							preferencesRef.current = appliedRef.current;
							setPreferences(appliedRef.current);
							setSaving(false);
							setError("Couldn't save room defaults.");
						}
					}
				});
		},
		[preferenceStorage, ready, userId],
	);

	return { error, preferences, ready, saving, update };
}
