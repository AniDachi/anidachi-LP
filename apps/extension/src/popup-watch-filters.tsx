import {
	WatchHistoryBrowseOptionsResponseSchema,
	type WatchHistoryBrowseOptionsResponse,
} from "@anidachi/protocol";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { usePopupWatchBrowse } from "./popup-watch-browse";
import type { PopupWatchHistoryClient } from "./popup-watch-history";
import type { WatchHistoryDatePreset } from "./watch-history-browse";

export type PopupHistoryConditions = {
	group: { id: string; label: string } | null;
	participant: { id: string; label: string } | null;
	period: WatchHistoryDatePreset;
	fromDate: string;
	throughDate: string;
};
export const emptyHistoryConditions: PopupHistoryConditions = {
	group: null,
	participant: null,
	period: "all-time",
	fromDate: "",
	throughDate: "",
};
const periods = {
	"all-time": "All time",
	today: "Today",
	"last-7-days": "Last 7 days",
	"this-month": "This month",
	custom: "Custom range",
};
const optionMeta = (page: WatchHistoryBrowseOptionsResponse) => page.meta;
const optionCursor = (page: WatchHistoryBrowseOptionsResponse) =>
	page.nextCursor;

export function PopupWatchFilters({
	client,
	ownerUserId,
	together,
	conditions,
	onChange,
	search,
	clearSearch,
	refresh,
	generation,
	dateError,
}: {
	client: PopupWatchHistoryClient;
	ownerUserId: string;
	together: boolean;
	conditions: PopupHistoryConditions;
	onChange: (value: PopupHistoryConditions) => void;
	search: string;
	clearSearch: () => void;
	refresh: number;
	generation?: number;
	dateError: boolean;
}) {
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const options = usePopupWatchBrowse({
		client,
		message: {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "browse-options",
			expectedOwnerUserId: ownerUserId,
			input: { mode: "shared", limit: 20 },
		},
		parser: WatchHistoryBrowseOptionsResponseSchema,
		meta: optionMeta,
		cursor: optionCursor,
		refresh,
		enabled: open && together,
		generation,
	});
	const allOptions = [
		...new Map(
			options.pages
				.flatMap((page) => page.options)
				.map((option) => [`${option.kind}:${option.id}`, option]),
		).values(),
	];
	const active = Boolean(
		search.trim() ||
			conditions.group ||
			conditions.participant ||
			conditions.period !== "all-time",
	);
	useEffect(() => {
		setOpen(false);
	}, [ownerUserId]);
	const selection = (kind: "group" | "participant") => {
		const selected = conditions[kind];
		const values = allOptions.filter((option) => option.kind === kind);
		if (selected && !values.some((option) => option.id === selected.id))
			values.unshift({ kind, ...selected });
		return (
			<label>
				{kind === "group" ? "My groups" : "Participant"}
				<select
					aria-label={kind === "group" ? "My groups" : "Participant"}
					value={selected?.id ?? ""}
					onChange={(event) => {
						const option = values.find(
							(value) => value.id === event.currentTarget.value,
						);
						onChange({
							...conditions,
							[kind]: option ? { id: option.id, label: option.label } : null,
						});
					}}
				>
					<option value="">
						Any {kind === "group" ? "group" : "participant"}
					</option>
					{values.map((option) => (
						<option value={option.id} key={option.id}>
							{option.label}
						</option>
					))}
				</select>
			</label>
		);
	};
	return (
		<>
			<button
				aria-label="Filters"
				aria-expanded={open}
				aria-controls={panelId}
				className="popup-watch-filter-button"
				type="button"
				onClick={() => setOpen((value) => !value)}
			>
				<SlidersHorizontal aria-hidden="true" size={14} />
				<span>Filters</span>
				{active ? <span className="popup-sr-only"> active</span> : null}
			</button>
			{open ? (
				<div
					className="popup-watch-filters"
					role="group"
					aria-label="History filters"
					id={panelId}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							setOpen(false);
							(
								event.currentTarget.parentElement?.querySelector(
									'[aria-label="Filters"]',
								) as HTMLButtonElement | null
							)?.focus();
						}
					}}
				>
					{together ? (
						<>
							<div className="popup-watch-filter-fields">
								{selection("group")}
								{selection("participant")}
							</div>
							<p>
								My groups are your historical group invitations used for
								watching together.
							</p>
							{options.loading ? (
								<p role="status">Loading filter options...</p>
							) : null}
							{options.error ? (
								<p role="alert">
									Could not load filter options.{" "}
									<button type="button" onClick={options.reload}>
										Retry options
									</button>
								</p>
							) : null}
							{options.nextCursor ? (
								<button
									type="button"
									disabled={options.loading}
									onClick={options.loadMore}
								>
									More filter options
								</button>
							) : null}
						</>
					) : null}
					<label>
						Period
						<select
							aria-label="Period"
							value={conditions.period}
							onChange={(event) =>
								onChange({
									...conditions,
									period: event.currentTarget.value as WatchHistoryDatePreset,
								})
							}
						>
							{Object.entries(periods).map(([key, label]) => (
								<option key={key} value={key}>
									{label}
								</option>
							))}
						</select>
					</label>
					{conditions.period === "custom" ? (
						<div className="popup-watch-filter-fields">
							<label>
								From
								<input
									aria-label="From date"
									type="date"
									value={conditions.fromDate}
									onChange={(event) =>
										onChange({
											...conditions,
											fromDate: event.currentTarget.value,
										})
									}
								/>
							</label>
							<label>
								Through
								<input
									aria-label="Through date"
									type="date"
									value={conditions.throughDate}
									onChange={(event) =>
										onChange({
											...conditions,
											throughDate: event.currentTarget.value,
										})
									}
								/>
							</label>
						</div>
					) : null}
					{dateError ? (
						<p role="alert">Choose a valid start and end date, in order.</p>
					) : null}
				</div>
			) : null}
			{active ? (
				<div className="popup-watch-conditions">
					{search.trim() ? (
						<button
							type="button"
							aria-label="Remove search condition"
							onClick={clearSearch}
						>
							<span dir="auto">{search.trim()}</span>
							<X size={12} aria-hidden="true" />
						</button>
					) : null}
					{(["group", "participant"] as const).map((kind) => {
						const selected = conditions[kind];
						return selected ? (
							<button
								type="button"
								key={kind}
								aria-label={`Remove ${kind} ${selected.label}`}
								onClick={() => onChange({ ...conditions, [kind]: null })}
							>
								<span dir="auto">{selected.label}</span>
								<X size={12} aria-hidden="true" />
							</button>
						) : null;
					})}
					{conditions.period !== "all-time" ? (
						<button
							type="button"
							aria-label="Remove period"
							onClick={() =>
								onChange({
									...conditions,
									period: "all-time",
									fromDate: "",
									throughDate: "",
								})
							}
						>
							<span>
								{conditions.period === "custom" &&
								conditions.fromDate &&
								conditions.throughDate
									? `${conditions.fromDate} – ${conditions.throughDate}`
									: periods[conditions.period]}
							</span>
							<X size={12} aria-hidden="true" />
						</button>
					) : null}
					<button
						type="button"
						className="popup-watch-clear-conditions"
						onClick={() => {
							onChange(emptyHistoryConditions);
							clearSearch();
						}}
					>
						Clear conditions
					</button>
				</div>
			) : null}
		</>
	);
}
