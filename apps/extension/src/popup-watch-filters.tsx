import { Funnel, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
	watchHistoryLocalDate,
	type WatchHistoryDatePreset,
	type WatchHistoryDateRangeResult,
} from "./watch-history-browse";
import { useWatchFilterPopover } from "./use-watch-filter-popover";

export type PopupHistoryConditions = {
	period: WatchHistoryDatePreset;
	fromDate: string;
	throughDate: string;
};
export const emptyHistoryConditions: PopupHistoryConditions = {
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
export function PopupWatchFilters({
	ownerUserId,
	conditions,
	onChange,
	dateError,
	today,
}: {
	ownerUserId: string;
	conditions: PopupHistoryConditions;
	onChange: (value: PopupHistoryConditions) => void;
	dateError:
		| Extract<WatchHistoryDateRangeResult, { ok: false }>["error"]
		| null;
	today: Date;
}) {
	const todayDate = watchHistoryLocalDate(today);
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const dismissFilters = useCallback(() => setOpen(false), []);
	const closeFilters = useCallback(() => {
		setOpen(false);
		triggerRef.current?.focus();
	}, []);
	useWatchFilterPopover({
		open,
		triggerRef,
		panelRef,
		dismiss: dismissFilters,
		close: closeFilters,
	});
	const filtersActive = conditions.period !== "all-time";
	useEffect(() => {
		setOpen(false);
	}, [ownerUserId]);
	return (
		<>
			<button
				ref={triggerRef}
				aria-label="Filters"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={panelId}
				aria-description={filtersActive ? "Filters are active" : undefined}
				title={filtersActive ? "Filters applied" : "Filters"}
				data-active={filtersActive}
				className="popup-watch-filter-button"
				type="button"
				onClick={() => setOpen((value) => !value)}
			>
				<Funnel aria-hidden="true" size={16} />
			</button>
			{open ? (
				<div
					ref={panelRef}
					className="popup-watch-filters"
					role="dialog"
					aria-label="History filters"
					id={panelId}
				>
					<div className="popup-watch-filter-heading">
						<strong>Filters</strong>
						<div className="popup-watch-filter-actions">
							<button
								className="popup-watch-filter-reset"
								type="button"
								aria-label="Reset filters"
								disabled={!filtersActive}
								onClick={() => onChange(emptyHistoryConditions)}
							>
								Reset
							</button>
							<button
								className="popup-watch-filter-close"
								type="button"
								aria-label="Close filters"
								onClick={closeFilters}
							>
								<X aria-hidden="true" size={15} />
							</button>
						</div>
					</div>
					<fieldset className="popup-watch-period">
						<legend>Period</legend>
						<div className="popup-watch-period-options">
							{Object.entries(periods).map(([key, label]) => (
								<label className="popup-watch-period-option" key={key}>
									<input
										type="radio"
										name={`${panelId}-period`}
										value={key}
										checked={conditions.period === key}
										onChange={() =>
											onChange({
												...conditions,
												period: key as WatchHistoryDatePreset,
											})
										}
									/>
									<span>{label}</span>
								</label>
							))}
						</div>
					</fieldset>
					{conditions.period === "custom" ? (
						<div className="popup-watch-filter-fields">
							<label>
								From
								<input
									aria-label="From date"
									aria-invalid={Boolean(dateError) || undefined}
									aria-describedby={
										dateError ? `${panelId}-date-error` : undefined
									}
									type="date"
									max={
										conditions.throughDate && conditions.throughDate < todayDate
											? conditions.throughDate
											: todayDate
									}
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
									aria-invalid={Boolean(dateError) || undefined}
									aria-describedby={
										dateError ? `${panelId}-date-error` : undefined
									}
									type="date"
									min={
										conditions.fromDate && conditions.fromDate <= todayDate
											? conditions.fromDate
											: undefined
									}
									max={todayDate}
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
						<p role="alert" id={`${panelId}-date-error`}>
							{dateError === "future-date"
								? "Choose today or an earlier date."
								: dateError === "reversed-range"
									? "End date must be on or after start date."
									: "Choose a valid start and end date."}
						</p>
					) : null}
				</div>
			) : null}
		</>
	);
}
