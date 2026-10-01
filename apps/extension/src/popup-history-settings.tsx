import { PopupSettingRow } from "./popup-setting-row";
import { WatchHistoryPreferencesResponseSchema } from "@anidachi/protocol";
import { useEffect, useRef, useState } from "react";
import {
	defaultPopupWatchHistoryClient,
	requestPopupWatchHistory,
	type PopupWatchHistoryClient,
} from "./popup-watch-history";

export function PopupHistorySettings({
	ownerUserId,
	client = defaultPopupWatchHistoryClient,
}: {
	ownerUserId: string | null;
	client?: PopupWatchHistoryClient;
}) {
	return ownerUserId ? <HistoryConsent key={ownerUserId} ownerUserId={ownerUserId} client={client} /> : null;
}

function HistoryConsent({
	ownerUserId,
	client,
}: {
	ownerUserId: string;
	client: PopupWatchHistoryClient;
}) {
	const [enabled, setEnabled] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const revision = useRef(0);
	const generation = useRef(0);
	const pending = useRef(false);
	useEffect(() => {
		const token = ++generation.current;
		const startedAt = revision.current;
		const current = () => token === generation.current;
		void client
			.loadCached(ownerUserId)
			.then((snapshot) => {
				if (
					current() &&
					revision.current === startedAt &&
					snapshot?.history.meta.ownerUserId === ownerUserId
				)
					setEnabled(snapshot.preferences.youtubeHistoryEnabled);
			})
			.catch(() => undefined);
		void requestPopupWatchHistory(client, {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "get-preferences",
			expectedOwnerUserId: ownerUserId,
		}).then((response) => {
			if (!current() || revision.current !== startedAt) return;
			const parsed = response.ok
				? WatchHistoryPreferencesResponseSchema.safeParse(response.data)
				: null;
			if (parsed?.success && parsed.data.meta.ownerUserId === ownerUserId) {
				revision.current++;
				setEnabled(parsed.data.preferences.youtubeHistoryEnabled);
			} else
				setError(
					"Could not refresh your history preference. You can still change it here.",
				);
		});
		const unsubscribe = client.subscribe?.(ownerUserId, (snapshot) => {
			if (
				!current() ||
				pending.current ||
				snapshot?.history.meta.ownerUserId !== ownerUserId
			)
				return;
			revision.current++;
			setEnabled(snapshot.preferences.youtubeHistoryEnabled);
		});
		return () => {
			generation.current++;
			unsubscribe?.();
		};
	}, [client, ownerUserId]);
	const update = async () => {
		if (pending.current) return;
		const token = generation.current;
		const before = enabled;
		const action = ++revision.current;
		pending.current = true;
		setEnabled(!before);
		setBusy(true);
		setError(null);
		const response = await requestPopupWatchHistory(client, {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "update-preferences",
			expectedOwnerUserId: ownerUserId,
			input: { youtubeHistoryEnabled: !before },
		});
		if (token !== generation.current || revision.current !== action) return;
		pending.current = false;
		if (!response.ok) {
			setEnabled(before);
			setError("Could not save your history preference. Please try again.");
		}
		// Success can omit data: the background has committed explicit browser-local
		// consent and queued account mirroring, including while offline.
		setBusy(false);
	};
	return (
		<>
			<PopupSettingRow label="Include YouTube" description="Also save the videos you watch on YouTube."
                checked={enabled} busy={busy} onChange={() => void update()} />
			{error ? (
				<p className="popup-local-settings-error" role="alert">
					{error}
				</p>
			) : null}
		</>
	);
}
