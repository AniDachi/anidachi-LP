"use client";

import {
	WatchHistoryCapacitySchema,
	type WatchHistoryCapacity,
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
	const [capacity, setCapacity] = useState<WatchHistoryCapacity | null>(null);
	useEffect(() => {
		let disposed = false;
		void api<unknown>("/api/watch-history/v3/capacity", {
			headers: { [WATCH_HISTORY_OWNER_HEADER]: ownerUserId },
		})
			.then((value) => {
				if (disposed) return;
				const parsed = WatchHistoryCapacitySchema.safeParse(value);
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
	const providers = (["crunchyroll", "youtube"] as const).filter(
		key => provider === "all" || key === provider,
	);
	const full = providers.filter(key => capacity.providers[key].used >= capacity.providers[key].limit);
	const name = (key: "crunchyroll" | "youtube") => key === "youtube" ? "YouTube" : "Crunchyroll";
	return (
		<section
			aria-label="History storage"
			className="wh-storage"
		>
			<div className="wh-storage-counts">
				{providers.map(key => <span key={key}>
					{name(key)}{" "}<strong>{capacity.providers[key].used} / {capacity.providers[key].limit}</strong>{" "}
					{key === "youtube" ? "videos" : "titles"}
				</span>)}
			</div>
			{full.length > 0 && recordingAllowed && <p className="wh-storage-notice" role="status">
				{full.map(name).join(" and ")} history is full. Delete saved titles to add new ones. Progress on saved titles keeps updating.
			</p>}
		</section>
	);
}
