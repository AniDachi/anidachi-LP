import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "wxt/utils/storage";
import {
	assignReactionShortcut,
	getDefaultReactionShortcutPreferences,
	parseReactionShortcutPreferences,
	type ReactionShortcutPreferencesV1,
	REACTION_SHORTCUTS_STORAGE_KEY,
} from "./reaction-shortcuts";

export interface ReactionShortcutPreferencesStorage {
	read(): Promise<unknown>;
	subscribe(listener: (value: unknown) => void): () => void;
	write(preferences: ReactionShortcutPreferencesV1): Promise<void>;
}

export interface ReactionShortcutsController {
	assignments: readonly string[];
	error: string | null;
	assign(index: number, emoji: string): void;
}

const defaultReactionShortcutStorage: ReactionShortcutPreferencesStorage = {
	read: () => storage.getItem<unknown>(REACTION_SHORTCUTS_STORAGE_KEY),
	subscribe: (listener) =>
		storage.watch<unknown>(REACTION_SHORTCUTS_STORAGE_KEY, (value) =>
			listener(value),
		),
	write: (preferences) =>
		storage.setItem(REACTION_SHORTCUTS_STORAGE_KEY, preferences),
};

export function useReactionShortcuts(
	preferenceStorage: ReactionShortcutPreferencesStorage = defaultReactionShortcutStorage,
): ReactionShortcutsController {
	const [preferences, setPreferences] = useState(
		getDefaultReactionShortcutPreferences,
	);
	const [error, setError] = useState<string | null>(null);
	const mountedRef = useRef(false);
	const preferencesRef = useRef(preferences);
	const appliedRef = useRef(preferences);
	const activityRevisionRef = useRef(0);
	const writeRevisionRef = useRef(0);

	useEffect(() => {
		mountedRef.current = true;
		let cancelled = false;
		const readFence = activityRevisionRef.current;
		const unsubscribe = preferenceStorage.subscribe((value) => {
			if (cancelled || !mountedRef.current) {
				return;
			}

			const parsed = parseReactionShortcutPreferences(value);
			activityRevisionRef.current += 1;
			writeRevisionRef.current += 1;
			preferencesRef.current = parsed;
			appliedRef.current = parsed;
			setPreferences(parsed);
			setError(null);
		});

		void preferenceStorage
			.read()
			.then((value) => {
				if (
					cancelled ||
					!mountedRef.current ||
					activityRevisionRef.current !== readFence
				) {
					return;
				}

				const parsed = parseReactionShortcutPreferences(value);
				preferencesRef.current = parsed;
				appliedRef.current = parsed;
				setPreferences(parsed);
				setError(null);
			})
			.catch(() => {
				if (
					cancelled ||
					!mountedRef.current ||
					activityRevisionRef.current !== readFence
				) {
					return;
				}
				setError("Couldn't load reaction shortcuts.");
			});

		return () => {
			cancelled = true;
			mountedRef.current = false;
			unsubscribe();
		};
	}, [preferenceStorage]);

	const assign = useCallback(
		(index: number, emoji: string) => {
			const next = assignReactionShortcut(preferencesRef.current, index, emoji);
			if (next === preferencesRef.current) {
				return;
			}

			const revision = ++writeRevisionRef.current;
			activityRevisionRef.current += 1;
			preferencesRef.current = next;
			setPreferences(next);
			setError(null);

			void preferenceStorage.write(next).then(
				() => {
					if (revision === writeRevisionRef.current) {
						appliedRef.current = next;
					}
				},
				() => {
					if (mountedRef.current && revision === writeRevisionRef.current) {
						preferencesRef.current = appliedRef.current;
						setPreferences(appliedRef.current);
						setError("Couldn't save reaction shortcuts.");
					}
				},
			);
		},
		[preferenceStorage],
	);

	return {
		assignments: preferences.emojis,
		error,
		assign,
	};
}
