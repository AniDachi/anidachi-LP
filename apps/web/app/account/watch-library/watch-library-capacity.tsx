"use client";

import {
	WatchHistoryCapacitySchema,
	type WatchHistoryCapacity,
} from "@anidachi/protocol";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { WATCH_HISTORY_OWNER_HEADER } from "@/lib/watch-history-owner";

export function WatchLibraryCapacity({
	ownerUserId,
	accountGeneration,
	revision,
	recordingAllowed,
}: {
	ownerUserId: string;
	accountGeneration: number;
	revision: string;
	recordingAllowed: boolean;
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
	const full = Object.values(capacity.providers).some(
		(value) => value.used >= value.limit,
	);
	return (
		<section
			aria-label="History storage"
			className="rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm"
		>
			<div className="flex flex-wrap gap-x-6 gap-y-2 tabular-nums">
				<span>
					YouTube{" "}
					<strong className="text-brand-orange">
						{capacity.providers.youtube.used} /{" "}
						{capacity.providers.youtube.limit}
					</strong>{" "}
					videos
				</span>
				<span>
					Crunchyroll{" "}
					<strong className="text-brand-orange">
						{capacity.providers.crunchyroll.used} /{" "}
						{capacity.providers.crunchyroll.limit}
					</strong>{" "}
					titles
				</span>
			</div>
			<p
				className="mt-2 text-xs text-foreground/60"
				role={full && recordingAllowed ? "status" : undefined}
			>
				{full && recordingAllowed
					? "History is full for resources at their limit. Delete titles below to save new ones. Progress on saved titles keeps updating."
					: "Each Crunchyroll series or film uses one slot. Delete titles to free space; nothing is removed automatically."}
			</p>
		</section>
	);
}
