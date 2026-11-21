import { watchHistoryProviderVersion } from "./watch-history-provider-version";
import {
	WatchHistoryCapacityCompatibleSchema,
	type WatchHistoryCapacityCompatible,
} from "@anidachi/protocol";
import { useEffect, useState } from "react";
import {
	requestPopupWatchHistory,
	type PopupWatchHistoryClient,
} from "./popup-watch-history";
import { WEB_HTTP_BASE } from "./constants";

/** Optional capacity metadata never replaces the history access/error state. */
export function PopupWatchCapacityNotice({
	ownerUserId,
	accountGeneration,
	client,
	revision,
	recordingAllowed,
}: {
	ownerUserId: string;
	accountGeneration?: number;
	client: PopupWatchHistoryClient;
	revision: string;
	recordingAllowed: boolean;
}) {
	const [result, setResult] = useState<{
		client: PopupWatchHistoryClient;
		data: WatchHistoryCapacityCompatible;
	} | null>(null);
	useEffect(() => {
		let disposed = false;
		if (!accountGeneration || !recordingAllowed) return;
		void requestPopupWatchHistory(client, {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "capacity",
			expectedOwnerUserId: ownerUserId,
		}).then((response) => {
			if (disposed) return;
			const parsed = response.ok
				? WatchHistoryCapacityCompatibleSchema.safeParse(response.data)
				: null;
			setResult(
				parsed?.success &&
					parsed.data.ownerUserId === ownerUserId &&
					parsed.data.accountGeneration === accountGeneration
					? { client, data: parsed.data }
					: null,
			);
		});
		return () => {
			disposed = true;
		};
	}, [client, ownerUserId, accountGeneration, revision, recordingAllowed]);
	if (
		!recordingAllowed ||
		result?.client !== client ||
		result.data.ownerUserId !== ownerUserId ||
		result.data.accountGeneration !== accountGeneration
	)
		return null;
	const full = (
		Object.entries(result.data.providers) as Array<
			["youtube" | "crunchyroll" | "netflix" | "primevideo" | "disneyplus" | "hbomax", { used: number; limit: number }]
		>
	).filter(([, value]) => value.used >= value.limit);
	const unavailable = [
		...(result.data.capacityVersion < 2 ? ["Netflix storage unavailable"] : []),
		...(result.data.capacityVersion < 3 ? ["Prime Video storage unavailable"] : []),
		...(result.data.capacityVersion < 4 ? ["Disney+ storage unavailable"] : []),
		...(watchHistoryProviderVersion() === 5 && result.data.capacityVersion < 5 ? ["HBO Max storage unavailable"] : []),
	];
	if (!full.length && !unavailable.length) return null;
	return (
		<aside className="popup-watch-plan-notice" role="status">
			<div>
				<strong>
					{full
						.map(
							([provider, value]) =>
								`${({ youtube: "YouTube", crunchyroll: "Crunchyroll", netflix: "Netflix", primevideo: "Prime Video", disneyplus: "Disney+", hbomax: "HBO Max" })[provider]} ${value.used}/${value.limit}`,
						)
						.join(" · ")}{" "}
					{full.length ? "— history full" : unavailable.join(" · ")}
				</strong>
				{full.length > 0 && unavailable.length > 0 && <span>{unavailable.join(" · ")}.</span>}
				{full.length > 0 && <span>
					New titles cannot be saved. Clear space in your history. Saved titles
					keep updating.
				</span>}
			</div>
			{full.length > 0 && <button
				type="button"
				aria-label="Manage full watch history"
				onClick={() =>
					client.openUrl(
						new URL("/account/watch-library", WEB_HTTP_BASE).toString(),
					)
				}
			>
				Manage
			</button>}
		</aside>
	);
}
