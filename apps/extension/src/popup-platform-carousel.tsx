import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { PopupProviderGroup } from "./popup-watch-history";
import { ProviderLogo } from "./provider-logo";

type Platform = PopupProviderGroup["provider"];

function wrap(position: number, count: number) {
	return ((position % count) + count) % count;
}

function PlatformFace({ group }: { group: PopupProviderGroup }) {
	return <span className="popup-platform-face">
		<ProviderLogo provider={group.provider} label={group.label} />
		{group.provider !== "disneyplus" && group.provider !== "hbomax" &&
			<span className="popup-platform-name">{group.label}</span>}
	</span>;
}

export function PopupPlatformCarousel({ groups, selected, onSelect }: {
	groups: PopupProviderGroup[];
	selected: Platform | null;
	onSelect: (platform: Platform | null) => void;
}) {
	const [cursor, setCursor] = useState(1);
	const [overflow, setOverflow] = useState(false);
	const space = useRef<HTMLDivElement>(null);
	const row = useRef<HTMLDivElement>(null);
	const count = groups.length;
	useLayoutEffect(() => {
		const available = space.current;
		const natural = row.current;
		if (!available || !natural) return;
		const measure = () => setOverflow(natural.getBoundingClientRect().width > available.getBoundingClientRect().width);
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(available);
		observer.observe(natural);
		return () => observer.disconnect();
	}, []);

	const index = groups.findIndex(group => group.provider === selected);
	const looping = count > 2;
	const center = index < 0 ? (looping ? cursor : Math.min(Math.max(cursor, 0), count - 1))
		: looping && wrap(cursor, count) === index ? cursor : index;
	const choose = (position: number) => {
		const nextIndex = wrap(position, count);
		setCursor(looping ? position : nextIndex);
		onSelect(groups[nextIndex]!.provider);
	};
	const step = (direction: number) => {
		choose(center + direction);
	};

	// One extra cell on either side lets a neighbour slide in as the old one leaves.
	const positions = looping ? [-2, -1, 0, 1, 2].map(offset => center + offset)
		: groups.map((_, position) => position);

	return (
		<div className="popup-platform-carousel" role="group" aria-label="Filter history by platform"
			onKeyDown={event => {
				if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
				event.preventDefault();
				const direction = event.key === "ArrowLeft" ? -1 : 1;
				if (overflow) step(direction);
				else {
					const next = wrap(index + 1 + direction, count + 1);
					onSelect(next === 0 ? null : groups[next - 1]!.provider);
				}
				const carousel = event.currentTarget;
				requestAnimationFrame(() => carousel.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled)')?.focus());
			}}>
			<button type="button" className="popup-platform-all" aria-pressed={index < 0}
				onClick={() => onSelect(null)}>All</button>
			<div ref={space} className="popup-platform-choices">
				<div ref={row} className="popup-platform-inline" aria-hidden={overflow || undefined} inert={overflow}>
					{groups.map(group => (
						<button key={group.provider} type="button" className="popup-platform-option"
							disabled={overflow} aria-label={overflow ? undefined : group.label} title={group.label}
							aria-pressed={!overflow && group.provider === selected} onClick={() => onSelect(group.provider)}>
							<PlatformFace group={group} />
						</button>
					))}
				</div>
				{overflow && <div className="popup-platform-wheel">
					<button type="button" className="popup-platform-arrow" aria-label="Previous platform"
						onClick={() => step(-1)}><ChevronLeft size={15} /></button>
					<div className="popup-platform-slots">
						{positions.map(position => {
							const group = groups[wrap(position, count)]!;
							const offset = position - center;
							const visible = Math.abs(offset) <= 1;
							return (
								<button key={position} type="button" className="popup-platform-option"
									style={{ transform: `translateX(${(offset + 1) * 100}%)` }}
									data-offset={offset} inert={!visible} aria-label={visible ? group.label : undefined}
									aria-pressed={offset === 0 && index >= 0} title={group.label}
									onClick={() => choose(position)}>
									<PlatformFace group={group} />
								</button>
							);
						})}
					</div>
					<button type="button" className="popup-platform-arrow" aria-label="Next platform"
						onClick={() => step(1)}><ChevronRight size={15} /></button>
				</div>}
			</div>
		</div>
	);
}
