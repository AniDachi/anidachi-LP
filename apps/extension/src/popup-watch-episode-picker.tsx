import type {
	WatchHistoryEpisode,
	WatchHistoryGridEpisode,
	WatchProgressEvent,
} from "@anidachi/protocol";
import { Check, ChevronDown, Play } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useWatchFilterPopover } from "./use-watch-filter-popover";
import { PopupEpisodeProgress } from "./popup-episode-progress";
import { useWatchLoadingHeight } from "./use-watch-loading-height";

export type PopupEpisodeChoice = {
	key: string;
	title: string;
	number: number | null;
	history?: WatchHistoryEpisode;
	catalog?: WatchHistoryGridEpisode;
	pending?: WatchProgressEvent;
};

function focusInside(
	button: HTMLButtonElement | undefined,
	scroller: HTMLElement | null,
) {
	button?.focus({ preventScroll: true });
	if (!button || !scroller) return;
	const cell = button.getBoundingClientRect(),
		bounds = scroller.getBoundingClientRect();
	if (cell.top < bounds.top) scroller.scrollTop -= bounds.top - cell.top + 2;
	else if (cell.bottom > bounds.bottom)
		scroller.scrollTop += cell.bottom - bounds.bottom + 2;
}

export function PopupSeasonPicker({
	seasons,
	selected,
	onSelect,
	title,
}: {
	seasons: { seasonKey: string; seasonTitle: string; special: boolean }[];
	selected: string;
	onSelect: (key: string) => void;
	title: string;
}) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const id = useId();
	const dismiss = useCallback(() => setOpen(false), []);
	const close = useCallback(() => {
		setOpen(false);
		triggerRef.current?.focus({ preventScroll: true });
	}, []);
	useWatchFilterPopover({
		open,
		triggerRef,
		panelRef,
		dismiss,
		close,
		preferredWidth: 224,
		align: "start",
	});
	const current = seasons.find((s) => s.seasonKey === selected);
	return (
		<div className="popup-season-picker">
			<button
				className="popup-season-trigger"
				ref={triggerRef}
				type="button"
				aria-label={`Season for ${title}: ${current?.seasonTitle ?? "Episodes"}`}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen((value) => !value)}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						setOpen(true);
					}
				}}
			>
				<span dir="auto">{current?.seasonTitle ?? "Episodes"}</span>
				<ChevronDown size={13} aria-hidden="true" />
			</button>
			{open ? (
				<div
					className="popup-season-menu"
					ref={panelRef}
					id={id}
					role="listbox"
					aria-label={`Seasons and specials for ${title}`}
					onKeyDown={(event) => {
						if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
							return;
						event.preventDefault();
						const options = [
							...event.currentTarget.querySelectorAll<HTMLButtonElement>(
								'[role="option"]',
							),
						];
						const index = options.indexOf(event.target as HTMLButtonElement);
						const next =
							event.key === "Home"
								? 0
								: event.key === "End"
									? options.length - 1
									: (index +
											(event.key === "ArrowDown" ? 1 : options.length - 1)) %
										options.length;
						options.forEach((button, i) => {
							button.tabIndex = i === next ? 0 : -1;
						});
						focusInside(options[next], event.currentTarget);
					}}
				>
					{seasons.map((season, index) => (
						<button
							type="button"
							role="option"
							key={season.seasonKey}
							aria-selected={season.seasonKey === selected}
							tabIndex={season.seasonKey === selected ? 0 : -1}
							data-special-start={
								season.special && !seasons[index - 1]?.special
							}
							onClick={() => {
								onSelect(season.seasonKey);
								close();
							}}
						>
							<span dir="auto">{season.seasonTitle}</span>
							{season.seasonKey === selected ? (
								<Check size={13} aria-hidden="true" />
							) : null}
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}

export function PopupEpisodePicker({
	title,
	seasonKey,
	seasonTitle,
	entries,
	latestKey,
	knownLatest,
	special,
	renderSelected,
	loadMore,
	hasMore,
	loading,
	pending = false,
}: {
	title: string;
	seasonKey: string;
	seasonTitle: string;
	entries: PopupEpisodeChoice[];
	latestKey: string;
	knownLatest?: PopupEpisodeChoice;
	special: boolean;
	renderSelected: (entry: PopupEpisodeChoice) => ReactNode;
	loadMore: () => void;
	hasMore: boolean;
	loading: boolean;
	pending?: boolean;
}) {
	const [choices, setChoices] = useState<Record<string, string>>({});
	const selected =
		entries.find((e) => e.key === choices[seasonKey]) ??
		(knownLatest?.key === choices[seasonKey] ? knownLatest : undefined) ??
		entries.find((e) => e.key === latestKey) ??
		knownLatest ??
		entries[0];
	const focusKey = entries.some((entry) => entry.key === selected?.key)
		? selected?.key
		: entries[0]?.key;
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	useWatchLoadingHeight(contentRef, pending);
	const positions = useRef<Record<string, number>>({});
	const previousSeason = useRef<string | null>(null);
	const restorePosition = useRef(false);
	useLayoutEffect(() => {
		if (!pending && selected && !choices[seasonKey])
			setChoices((previous) => ({ ...previous, [seasonKey]: selected.key }));
	}, [selected?.key, seasonKey, choices, pending]);
	useLayoutEffect(() => {
		const scroll = scrollRef.current;
		const shell = scroll?.closest<HTMLElement>(".popup-shell");
		if (!scroll || !shell) return;
		const size = () => {
			const height = shell.clientHeight;
			if (height > 0)
				scroll.style.setProperty(
					"--episode-grid-rows",
					height <= 650 ? "4" : "5",
				);
		};
		size();
		const observer =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(size);
		observer?.observe(shell);
		return () => observer?.disconnect();
	}, []);
	useLayoutEffect(() => {
		const scroll = scrollRef.current;
		if (!scroll) return;
		if (previousSeason.current !== seasonKey) {
			previousSeason.current = seasonKey;
			restorePosition.current = true;
		}
		if (pending) return;
		// A saved grid is already laid out during background revalidation. Restore
		// now, including when the user skips back before another read finishes.
		if (restorePosition.current) {
			scroll.scrollTop = positions.current[seasonKey] ?? 0;
			restorePosition.current = false;
		}
		if (loading) return;
		if (positions.current[seasonKey] === undefined && selected) {
			const cell = [
				...scroll.querySelectorAll<HTMLElement>("[data-episode-key]"),
			].find((node) => node.dataset.episodeKey === selected.key);
			if (cell) {
				const top =
					cell.getBoundingClientRect().top -
					scroll.getBoundingClientRect().top +
					scroll.scrollTop;
				scroll.scrollTop = Math.max(
					0,
					top - scroll.clientHeight / 2 + cell.offsetHeight / 2,
				);
				positions.current[seasonKey] = scroll.scrollTop;
			}
		}
	}, [seasonKey, selected?.key, entries.length, loading, pending]);
	return (
		<div
			ref={contentRef}
			className="popup-episode-picker"
			data-loading={pending}
			aria-busy={pending}
		>
			<div
				className="popup-episode-picker-content"
				inert={pending}
				aria-hidden={pending || undefined}
			>
				<div
					className="popup-episode-grid-scroll"
					ref={scrollRef}
					data-special={special}
					onScroll={(event) => {
						const node = event.currentTarget;
						if (loading || previousSeason.current !== seasonKey) return;
						positions.current[seasonKey] = node.scrollTop;
						if (
							hasMore &&
							!loading &&
							node.scrollTop > 0 &&
							node.scrollHeight - node.scrollTop - node.clientHeight < 65
						)
							loadMore();
					}}
				>
					<div
						className={special ? "popup-special-choices" : "popup-episode-grid"}
						role="group"
						aria-label={`Episodes in ${seasonTitle}`}
					>
						{entries.map((entry, index) => {
							const completed = Boolean(entry.history?.completedAt);
							const progress =
								entry.pending?.progress ?? entry.history?.progress ?? 0;
							const current = entry.key === latestKey && !completed;
							const number =
								entry.number === null
									? "—"
									: entry.number === 0
										? "E0"
										: Number.isInteger(entry.number)
											? String(entry.number).padStart(2, "0")
											: String(entry.number);
							return (
								<button
									type="button"
									key={entry.key}
									className={
										special ? "popup-special-choice" : "popup-episode-cell"
									}
									data-episode-key={entry.key}
									data-completed={completed}
									data-current={current}
									data-available={entry.catalog?.available !== false}
									aria-label={`${entry.number === null ? entry.title : `Episode ${entry.number}: ${entry.title}`}, ${completed ? "watched" : entry.catalog?.available === false ? "not available" : progress > 0 ? "in progress" : "not watched"}`}
									aria-pressed={entry.key === selected?.key}
									tabIndex={entry.key === focusKey ? 0 : -1}
									title={entry.title}
									onClick={() =>
										setChoices((previous) => ({
											...previous,
											[seasonKey]: entry.key,
										}))
									}
									onKeyDown={(event) => {
										if (
											![
												"ArrowLeft",
												"ArrowRight",
												"ArrowUp",
												"ArrowDown",
												"Home",
												"End",
											].includes(event.key)
										)
											return;
										event.preventDefault();
										const buttons = [
											...event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
												"button[data-episode-key]",
											),
										];
										const style =
											event.currentTarget.ownerDocument.defaultView?.getComputedStyle(
												event.currentTarget.parentElement!,
											);
										const columns = special
											? 1
											: Math.max(
													1,
													style?.gridTemplateColumns.split(" ").filter(Boolean)
														.length ?? 6,
												);
										const delta =
											event.key === "ArrowLeft"
												? -1
												: event.key === "ArrowRight"
													? 1
													: event.key === "ArrowUp"
														? -columns
														: columns;
										const next =
											event.key === "Home"
												? 0
												: event.key === "End"
													? entries.length - 1
													: Math.max(
															0,
															Math.min(entries.length - 1, index + delta),
														);
										const nextEntry = entries[next];
										if (nextEntry) {
											setChoices((previous) => ({
												...previous,
												[seasonKey]: nextEntry.key,
											}));
											focusInside(buttons[next], scrollRef.current);
										}
									}}
								>
									<span className="popup-cell-number">{number}</span>
									{special ? (
										<span className="popup-special-title" dir="auto">
											{entry.title}
										</span>
									) : null}
									{completed ? (
										<Check size={11} aria-hidden="true" />
									) : special && progress > 0 ? (
										<Play size={12} aria-hidden="true" />
									) : null}
									{!special && !completed && progress > 0 ? (
										<span
											className="popup-cell-progress"
											style={{ width: `${Math.min(progress * 100, 99.9)}%` }}
										/>
									) : null}
								</button>
							);
						})}
					</div>
					{hasMore ? (
						<button
							className="popup-watch-load-more"
							aria-label={`Load more episodes for ${title}`}
							type="button"
							onClick={loadMore}
							disabled={loading}
						>
							Load more episodes
						</button>
					) : null}
				</div>
				{selected ? renderSelected(selected) : null}
			</div>
			{pending ? (
				<p className="popup-episode-picker-loading" role="status">
					Loading episodes...
				</p>
			) : null}
		</div>
	);
}

export function PopupUnwatchedEpisode({
	entry,
	onOpen,
	busy,
}: {
	entry: PopupEpisodeChoice;
	onOpen: (url: string) => void;
	busy: boolean;
}) {
	const episode = entry.catalog!;
	return (
		<div className="popup-selected-episode">
			<div className="popup-selected-episode-heading">
				<span>
					{entry.number === null
						? "Special episode"
						: `Episode ${entry.number}`}
				</span>
				<span>
					{episode.available ? "Not watched" : "Not currently available"}
				</span>
			</div>
			<strong className="popup-selected-episode-title" dir="auto">
				{entry.title}
			</strong>
			<PopupEpisodeProgress
				title={entry.title}
				elapsed={
					episode.releasedAt && !episode.available
						? new Date(episode.releasedAt).toLocaleDateString()
						: "0:00"
				}
				duration={episode.releasedAt && !episode.available ? undefined : "—"}
				progress={0}
				action={`Watch${entry.number === null ? "" : ` E${entry.number}`}`}
				disabled={busy || !episode.available}
				onOpen={() => onOpen(episode.sourceUrl)}
			/>
		</div>
	);
}
