"use client";

import {
	WatchHistoryCapacityCompatibleSchema,
	type WatchHistoryCapacityCompatible,
} from "@anidachi/protocol";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { WATCH_HISTORY_OWNER_HEADER } from "@/lib/watch-history-owner";
import type { HistoryPlatform } from "./history-browser";

export function WatchLibraryCapacity({
	ownerUserId,
	accountGeneration,
	revision,
	recordingAllowed,
	provider = "all",
}: {
	ownerUserId: string;
	accountGeneration: number;
	revision: string;
	recordingAllowed: boolean;
	provider?: HistoryPlatform;
}) {
	const [capacity, setCapacity] = useState<WatchHistoryCapacityCompatible | null>(null);
	useEffect(() => {
		let disposed = false;
		void api<unknown>("/api/watch-history/v3/capacity?capacityVersion=5", {
			headers: { [WATCH_HISTORY_OWNER_HEADER]: ownerUserId },
		})
			.then((value) => {
				if (disposed) return;
				const parsed = WatchHistoryCapacityCompatibleSchema.safeParse(value);
				setCapacity(
					parsed.success &&
						parsed.data.ownerUserId === ownerUserId &&
						parsed.data.accountGeneration === accountGeneration
						? parsed.data
						: null,
				);
			})
			.catch(() => {
				if (!disposed) setCapacity(null);
			});
		return () => {
			disposed = true;
		};
	}, [ownerUserId, accountGeneration, revision]);
	if (
		!capacity ||
		capacity.ownerUserId !== ownerUserId ||
		capacity.accountGeneration !== accountGeneration
	)
		return null;
	const providers = (["crunchyroll", "youtube", "netflix", "primevideo", "disneyplus", "hbomax"] as const).filter(
		key => provider === "all" || key === provider,
	);
	const usage = (key: typeof providers[number]) => {
		if (key === "hbomax") return "hbomax" in capacity.providers ? capacity.providers.hbomax : null;
		if (key === "disneyplus") return "disneyplus" in capacity.providers ? capacity.providers.disneyplus : null;
		if (key === "primevideo") return "primevideo" in capacity.providers ? capacity.providers.primevideo : null;
		if (key === "netflix") return capacity.capacityVersion !== 1 ? capacity.providers.netflix : null;
		return capacity.providers[key];
	};
	const full = providers.filter(key => { const value = usage(key); return value && value.used >= value.limit; });
	const name = (key: typeof providers[number]) => ({ youtube: "YouTube", crunchyroll: "Crunchyroll", netflix: "Netflix", disneyplus: "Disney+", hbomax: "HBO Max", primevideo: "Prime Video" })[key];
	return (
		<section
			aria-label="History storage"
			className="wh-storage"
		>
			<div className="wh-storage-counts">
				{providers.map(key => { const value = usage(key); return <span key={key}>
					{name(key)}{" "}{value ? <><strong>{value.used} / {value.limit}</strong>{" "}{key === "youtube" ? "videos" : "titles"}</> : "storage unavailable"}
				</span>; })}
			</div>
			{full.length > 0 && recordingAllowed && <p className="wh-storage-notice" role="status">
				{full.map(name).join(" and ")} history is full. Delete saved titles to add new ones. Progress on saved titles keeps updating.
			</p>}
		</section>
	);
}
