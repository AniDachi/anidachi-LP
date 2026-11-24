import {
	RoomLobbyProviderSchema,
	type RoomLobbyProvider,
} from "@anidachi/protocol";
import { useEffect, useRef, useState } from "react";
import { ProviderLogo } from "./provider-logo";
import { ROOM_LAUNCH_MESSAGE } from "./popup-room-launch";

export type RoomsState = {
	here: RoomLobbyProvider | null;
	room: {
		provider: string;
		here: boolean;
		tabId: number;
		invite: string;
	} | null;
};
export const platformLabels: Record<string, string> = {
	disneyplus: "Disney+",
	hbomax: "HBO Max",
	primevideo: "Prime Video",
	netflix: "Netflix",
	youtube: "YouTube",
	crunchyroll: "Crunchyroll",
};

export function RoomsCard({
	state,
	selected,
	onSelect,
	onAction,
	label,
	disabled,
	error,
}: {
	state: RoomsState | null;
	selected: RoomLobbyProvider | null;
	onSelect: (provider: RoomLobbyProvider) => void;
	onAction: () => void;
	label: string;
	disabled: boolean;
	error: string;
}) {
	const active = state?.room?.provider;

	const [open, setOpen] = useState(false);
	const picker = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (!open) return;
		const outside = (event: PointerEvent) => {
			if (
				event.target instanceof Node &&
				!picker.current?.contains(event.target)
			)
				setOpen(false);
		};
		document.addEventListener("pointerdown", outside);
		return () => document.removeEventListener("pointerdown", outside);
	}, [open]);

	return (
		<section className={active ? "rooms-card" : "rooms-card rooms-composer"} aria-label="Watch room">
			{active ? (
				<>
					<div className="rooms-kicker">Active room</div>
					<div className="rooms-provider">
						<ProviderLogo
							provider={active}
							label={platformLabels[active] ?? "Watch room"}
						/>
						<strong>{platformLabels[active] ?? "Watch room"}</strong>
					</div>
				</>
			) : (
				<div
					className="rooms-picker"
					ref={picker}
					data-open={open}
					onBlur={(event) => {
						if (!event.currentTarget.contains(event.relatedTarget))
							setOpen(false);
					}}
					onKeyDown={(event) => {
						if (event.key === "Escape" && open) {
							event.preventDefault();
							setOpen(false);
							trigger.current?.focus();
						}
					}}
				>
					<button
						type="button"
						className="rooms-provider rooms-trigger"
						ref={trigger}
						aria-label={
							selected
								? "Choose a platform, " + platformLabels[selected]
								: "Choose a platform"
						}
						aria-expanded={open}
						aria-controls="rooms-platforms"
						disabled={!state || (disabled && selected !== null)}
						onClick={() => setOpen((value) => !value)}
					>
						{selected && (
							<ProviderLogo
								provider={selected}
								label={platformLabels[selected]}
							/>
						)}
						<strong>
							{selected ? platformLabels[selected] : "Choose a platform"}
						</strong>
						<span aria-hidden="true" className="rooms-chevron" />
					</button>
					<div className="rooms-reveal" inert={!open}>
						<div>
							<div id="rooms-platforms" role="group" aria-label="Platforms">
								{RoomLobbyProviderSchema.options.map((provider) => (
									<button
										key={provider}
										type="button"
										className="rooms-provider rooms-option"
										aria-pressed={provider === selected}
										onClick={() => {
											onSelect(provider);
											setOpen(false);
											trigger.current?.focus();
										}}
									>
										<ProviderLogo
											provider={provider}
											label={platformLabels[provider]}
										/>
										<span>{platformLabels[provider]}</span>
										{selected === provider && (
											<span className="rooms-check" aria-hidden="true">
												✓
											</span>
										)}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			)}

			<button
				className="rooms-primary"
				type="button"
				disabled={disabled}
				onClick={onAction}
			>
				{label}
			</button>
			{error && <p role="alert">{error}</p>}
		</section>
	);
}

export function PopupRooms({
	owner,
	onSignIn,
}: {
	owner: string | null;
	onSignIn: () => void;
}) {
	const [state, setState] = useState<RoomsState | null>(null);
	const [selected, select] = useState<RoomLobbyProvider | null>(null);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState("");
	const [revision, refresh] = useState(0);
	useEffect(() => {
		if (!owner) return;
		let current = true;
		chrome.runtime
			.sendMessage({ type: ROOM_LAUNCH_MESSAGE, action: "state", owner })
			.then((result) => {
				if (!current) return;
				if (!result || result.error)
					throw new Error(
						result?.error || "Could not load room details. Try again.",
					);
				setState(result);
				select(result.here);
				setError("");
			})
			.catch((e: Error) => {
				if (current) setError(e.message);
			});
		return () => {
			current = false;
		};
	}, [owner, revision]);
	const act = async () => {
		if (!owner) return onSignIn();
		if (!state) {
			refresh((value) => value + 1);
			return;
		}
		if (busy) return;
		setBusy(true);
		setError("");
		try {
			if (state.room?.here) {
				await navigator.clipboard.writeText(state.room.invite);
				setCopied(true);
			} else {
				const result = await chrome.runtime.sendMessage({
					type: ROOM_LAUNCH_MESSAGE,
					action: "open",
					provider: selected,
					owner,
				});
				if (!result?.ok)
					throw new Error(result?.error || "Could not open the room.");
				window.close();
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Try again.");
		} finally {
			setBusy(false);
		}
	};
	let label = "Create room";
	if (!owner) label = "Sign in";
	else if (!state && error) label = "Try again";
	else if (busy) label = "Opening…";
	else if (state?.room?.here) label = copied ? "Copied" : "Copy invite";
	else if (state?.room) label = "Return to room";
	return (
		<RoomsCard
			state={state}
			selected={selected}
			onSelect={select}
			onAction={() => void act()}
			label={label}
			disabled={
				busy || Boolean(owner && !state?.room && !selected && (state || !error))
			}
			error={error}
		/>
	);
}
