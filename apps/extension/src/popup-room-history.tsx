import {
	CompletedRoomsPageSchema,
	type CompletedRoom,
	type CompletedRoomCursor,
} from "@anidachi/protocol";
import { useEffect, useState } from "react";
import { requestCurrentExtensionSession } from "./auth-client";
import type { ExtensionAuthTokens } from "./auth-tokens";
import { WEB_HTTP_BASE } from "./constants";
import { platformLabels } from "./popup-rooms";
import { ProviderLogo } from "./provider-logo";

const clock = new Intl.DateTimeFormat("en-GB", {
	hour: "2-digit",
	minute: "2-digit",
});
const dateLabel = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

function dayLabel(date: Date) {
	const today = new Date();
	if (date.toDateString() === today.toDateString()) return "Today";
	today.setDate(today.getDate() - 1);
	return date.toDateString() === today.toDateString()
		? "Yesterday"
		: dateLabel.format(date);
}

export function roomDuration(createdAt: string, endedAt: string) {
	const minutes = Math.floor(
		Math.max(0, Date.parse(endedAt) - Date.parse(createdAt)) / 60_000,
	);
	if (!minutes) return "<1 min";
	if (minutes < 60) return minutes + " min";
	const remainder = minutes % 60;
	return (
		Math.floor(minutes / 60) +
		" h" +
		(remainder ? " " + remainder + " min" : "")
	);
}

export function RoomHistoryEntry({ room }: { room: CompletedRoom }) {
	const start = new Date(room.createdAt);
	const end = new Date(room.endedAt);
	const name = room.provider ? platformLabels[room.provider] : "Watch room";
	return (
		<details className="rooms-history-entry">
			<summary>
				<ProviderLogo provider={room.provider ?? "room"} label={name} />
				<span className="rooms-history-title">
					<strong>{name}</strong>
					<small>{dayLabel(start)}</small>
				</span>
				<span className="rooms-duration">
					{roomDuration(room.createdAt, room.endedAt)}
				</span>
				<span className="rooms-chevron" aria-hidden="true" />
			</summary>
			<div className="rooms-history-detail">
				{room.companions.length > 0 && (
					<div className="rooms-companions">
						<span className="rooms-with">Watched with</span>
						{room.companions.map((person) => (
							<span className="rooms-companion" key={person.id}>
								<span className="rooms-avatar" aria-hidden="true">
									{person.name.slice(0, 1).toUpperCase()}
									{person.avatar?.startsWith("https://") && (
										<img
											alt=""
											src={person.avatar}
											loading="lazy"
											referrerPolicy="no-referrer"
											onError={(e) => {
												e.currentTarget.hidden = true;
											}}
										/>
									)}
								</span>
								{person.name}
							</span>
						))}
					</div>
				)}
				<dl className="rooms-timeline">
					<div>
						<dt>Created</dt>
						<dd><time dateTime={room.createdAt}>{clock.format(start)}</time></dd>
					</div>
					<div>
						<dt>Ended{end.toDateString() !== start.toDateString() && ` · ${dayLabel(end)}`}</dt>
						<dd><time dateTime={room.endedAt}>{clock.format(end)}</time></dd>
					</div>
				</dl>
			</div>
		</details>
	);
}

async function readPage(
	owner: string,
	token: string,
	cursor: CompletedRoomCursor | null,
	signal: AbortSignal,
) {
	const url = new URL("/api/account/room-history", WEB_HTTP_BASE);
	if (cursor) {
		url.searchParams.set("before", cursor.endedAt);
		url.searchParams.set("roomId", cursor.roomId);
	}
	const request = (bearer: string) =>
		fetch(url, {
			headers: { Authorization: "Bearer " + bearer },
			credentials: "omit",
			cache: "no-store",
			redirect: "error",
			signal,
		});
	let response = await request(token);
	if (response.status === 401 && !signal.aborted) {
		const fresh = await requestCurrentExtensionSession();
		if (fresh?.user.id === owner && !signal.aborted)
			response = await request(fresh.accessToken);
	}
	if (!response.ok) throw new Error("Room history unavailable");
	const page = CompletedRoomsPageSchema.parse(await response.json());
	if (page.ownerUserId !== owner) throw new Error("Account changed");
	return page;
}

export function PopupRoomHistory({ tokens }: { tokens: ExtensionAuthTokens }) {
	const [rooms, setRooms] = useState<CompletedRoom[]>([]);
	const [all, setAll] = useState(false);
	const [cursor, setCursor] = useState<CompletedRoomCursor | null>(null);
	const [next, setNext] = useState<CompletedRoomCursor | null>(null);
	const [retry, setRetry] = useState(0);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		const controller = new AbortController();
		const signal = AbortSignal.any([
			controller.signal,
			AbortSignal.timeout(12_000),
		]);
		setFailed(false);
		setLoading(true);
		void readPage(tokens.user.id, tokens.accessToken, cursor, signal)
			.then((page) => {
				if (controller.signal.aborted) return;
				setRooms((previous) => {
					if (!cursor) return page.rooms;
					const byId = new Map(previous.map((room) => [room.roomId, room]));
					for (const room of page.rooms) byId.set(room.roomId, room);
					return Array.from(byId.values());
				});
				setNext(page.next);
			})
			.catch(() => {
				if (!controller.signal.aborted) setFailed(true);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [tokens.user.id, tokens.accessToken, cursor, retry]);

	if (!rooms.length && !failed) return null;
	return (
		<section className="rooms-history" aria-label="Recent rooms">
			<header>
				<h2>Recent rooms</h2>
				{(next || rooms.length > 3) && (
					<button
						type="button"
						disabled={loading}
						onClick={() => {
							if (!all && rooms.length <= 3 && next) setCursor(next);
							setAll(!all);
						}}
					>
						{all ? "Show less" : "View all"}
					</button>
				)}
			</header>
			{(all ? rooms : rooms.slice(0, 3)).map((room) => (
				<RoomHistoryEntry key={room.roomId} room={room} />
			))}
			{failed && (
				<p role="status">
					Couldn’t load room history.{" "}
					<button type="button" onClick={() => setRetry((n) => n + 1)}>
						Try again
					</button>
				</p>
			)}
			{all && !failed && next && (
				<button
					type="button"
					disabled={loading}
					onClick={() => setCursor(next)}
				>
					{loading ? "Loading…" : "Load more"}
				</button>
			)}
		</section>
	);
}
