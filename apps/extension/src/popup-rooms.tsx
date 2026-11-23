import { RoomLobbyProviderSchema, type RoomLobbyProvider } from "@anidachi/protocol";
import { useEffect, useState } from "react";
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
const platformLabels: Record<string, string> = { disneyplus: "Disney+", hbomax: "HBO Max", primevideo: "Prime Video", netflix: "Netflix", youtube: "YouTube", crunchyroll: "Crunchyroll" };

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

	return (
		<section className="rooms-card" aria-label="Watch room">
			<div className="rooms-kicker">
				{state?.room ? "Active room" : "Platform"}
			</div>
			<div className="rooms-platforms">
				{active ? (
					<div className="rooms-provider">
						<ProviderLogo provider={active} label={platformLabels[active] ?? "Watch room"} />
						<strong>{platformLabels[active] ?? "Watch room"}</strong>
					</div>
				) : RoomLobbyProviderSchema.options.map(provider => (
					<button key={provider} className="rooms-provider" type="button"
						aria-pressed={selected === provider}
						disabled={!state || (disabled && selected !== null)}
						onClick={() => onSelect(provider)}>
						<ProviderLogo provider={provider} label={platformLabels[provider]} />
						<strong>{platformLabels[provider]}</strong>
						{selected === provider && <span className="rooms-check" aria-hidden="true">✓</span>}
					</button>
				))}
			</div>
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
					throw new Error(result?.error || "Could not load room details. Try again.");
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
