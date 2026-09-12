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
	return (
		<section className="popup-history-settings" aria-label="History settings">
			<h3>History</h3>
			{ownerUserId ? (
				<HistoryConsent
					key={ownerUserId}
					ownerUserId={ownerUserId}
					client={client}
				/>
			) : (
				<p>Sign in to manage history preferences.</p>
			)}
		</section>
	);
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
			<button
				type="button"
				role="switch"
				aria-label="Track YouTube history"
				aria-checked={enabled}
				disabled={busy}
				className="popup-notification-setting"
				data-enabled={enabled}
				onClick={() => void update()}
			>
				<span className="popup-notification-setting-copy">
					<strong>Track YouTube history</strong>
					<span>{enabled ? "On" : "Off"}</span>
				</span>
				<span className="popup-notification-switch" aria-hidden="true">
					<span />
				</span>
			</button>
			<p>
				Your explicit choice applies in this browser and is synced to your
				account when online. Invitation notifications are separate.
			</p>
			{error ? (
				<p className="popup-local-settings-error" role="alert">
					{error}
				</p>
			) : null}
		</>
	);
}
