import type { Participant } from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParticipantPillVisibility } from "../src/interface-preferences";
import { ROOM_RAIL_CLOSE_DELAY_MS, RoomRail } from "../src/overlay-room-rail";
import { ROOM_RAIL_OPEN_DELAY_MS } from "../src/room-rail-intent";
import {
	getDefaultParticipantAudioPreference,
	type ParticipantAudioPreference,
} from "../src/voice-audio-preferences";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("RoomRail", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("keeps quiet Smart pills hidden and speaking pills compact", async () => {
		const view = await renderRail({
			speakingParticipantIds: ["remote"],
			visibilityMode: "smart",
		});
		const [localSlot, remoteSlot] = getSlots(view.container);

		expect(localSlot?.getAttribute("data-presentation")).toBe("hidden");
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("compact");

		await unmount(view.root);
	});

	it("marks and exposes the reacting participant without expanding the Smart rail", async () => {
		const view = await renderRail({
			reactionCueParticipantIds: new Set(["remote"]),
			visibilityMode: "smart",
		});
		const [localSlot, remoteSlot] = getSlots(view.container);

		expect(localSlot?.getAttribute("data-presentation")).toBe("hidden");
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("compact");
		expect(remoteSlot?.getAttribute("data-reaction-cue")).toBe("true");
		expect(
			getElement(view.container, ".room-rail").classList.contains("open"),
		).toBe(false);

		await unmount(view.root);
	});

	it("expands the full Smart list only after deliberate edge dwell", async () => {
		const view = await renderRail({ visibilityMode: "smart" });
		const edge = getElement(view.container, ".room-rail-edge");
		edge.getBoundingClientRect = () => rect(994, 0, 6, 400);

		await pointer(edge, "pointerover", { clientX: 999 });
		await advance(ROOM_RAIL_OPEN_DELAY_MS - 1);
		expect(getPresentations(view.container)).toEqual(["hidden", "hidden"]);

		await advance(1);
		expect(getPresentations(view.container)).toEqual(["expanded", "expanded"]);

		await unmount(view.root);
	});

	it("starts every eligible persistent pill compact", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });

		expect(getPresentations(view.container)).toEqual(["compact", "compact"]);
		expect(
			getElement(view.container, ".room-rail").classList.contains("persistent"),
		).toBe(true);

		await unmount(view.root);
	});

	it("disables edge expansion while persistent pills are selected", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });
		const edge = getElement(view.container, ".room-rail-edge");
		edge.getBoundingClientRect = () => rect(994, 0, 6, 400);

		await pointer(edge, "pointerover", { clientX: 999 });
		await advance(ROOM_RAIL_OPEN_DELAY_MS * 2);

		expect(getPresentations(view.container)).toEqual(["compact", "compact"]);

		await unmount(view.root);
	});

	it("expands only the hovered persistent participant and restores compact state", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });
		const [localSlot, remoteSlot] = getSlots(view.container);

		await pointer(remoteSlot, "pointerover");
		expect(getPresentations(view.container)).toEqual(["compact", "expanded"]);

		await pointer(remoteSlot, "pointerout", { relatedTarget: document.body });
		await advance(ROOM_RAIL_CLOSE_DELAY_MS);
		expect(getPresentations(view.container)).toEqual(["compact", "compact"]);
		expect(localSlot?.getAttribute("data-presentation")).toBe("compact");

		await unmount(view.root);
	});

	it("uses keyboard focus as the persistent expansion equivalent", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });
		const remotePill = getSlots(view.container)[1]?.querySelector(
			".room-rail-pill",
		);
		if (!(remotePill instanceof HTMLElement)) {
			throw new Error("Remote participant pill not found.");
		}

		await act(async () => remotePill.focus());
		expect(getPresentations(view.container)).toEqual(["compact", "expanded"]);

		await act(async () => remotePill.blur());
		await advance(ROOM_RAIL_CLOSE_DELAY_MS);
		expect(getPresentations(view.container)).toEqual(["compact", "compact"]);

		await unmount(view.root);
	});

	it("keeps the adjusted persistent participant expanded across pointer leave", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });
		const remoteSlot = getSlots(view.container)[1];
		await pointer(remoteSlot, "pointerover");
		const slider = remoteSlot?.querySelector('input[type="range"]');
		if (!(slider instanceof HTMLInputElement)) {
			throw new Error("Remote participant volume control not found.");
		}
		slider.setPointerCapture = vi.fn();
		slider.hasPointerCapture = vi.fn().mockReturnValue(true);
		slider.releasePointerCapture = vi.fn();

		await pointer(slider, "pointerdown", { pointerId: 7 });
		await pointer(remoteSlot, "pointerout", { relatedTarget: document.body });
		await advance(ROOM_RAIL_CLOSE_DELAY_MS * 2);
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("expanded");

		await pointer(slider, "pointerup", { pointerId: 7 });
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("expanded");
		await advance(ROOM_RAIL_CLOSE_DELAY_MS);
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("compact");

		await unmount(view.root);
	});

	it("shows a compact mute marker for a muted remote participant", async () => {
		const view = await renderRail({
			getParticipantAudioPreference: (participantId) =>
				participantId === "remote"
					? { muted: true, volume: 0.45 }
					: getDefaultParticipantAudioPreference(),
			visibilityMode: "always-visible",
		});
		const remoteSlot = getSlots(view.container)[1];

		expect(remoteSlot?.querySelector(".room-rail-compact-mute")).not.toBeNull();
		expect(
			remoteSlot?.querySelector(".room-rail-pill")?.getAttribute("aria-label"),
		).toMatch(/muted locally/i);

		await unmount(view.root);
	});

	it("never exposes listener volume or mute controls for the current participant", async () => {
		const view = await renderRail({
			participants: [participant("local", "Local User", "host")],
			visibilityMode: "always-visible",
		});

		expect(view.container.querySelector('input[type="range"]')).toBeNull();
		expect(
			view.container.querySelector('button[aria-label^="Mute"]'),
		).toBeNull();
		expect(view.container.querySelector(".room-rail-compact-mute")).toBeNull();

		await unmount(view.root);
	});
});

interface RenderRailOverrides {
	getParticipantAudioPreference?(
		participantId: string,
	): ParticipantAudioPreference;
	participants?: Participant[];
	reactionCueParticipantIds?: ReadonlySet<string>;
	speakingParticipantIds?: string[];
	visibilityMode: ParticipantPillVisibility;
}

async function renderRail(overrides: RenderRailOverrides): Promise<{
	container: HTMLDivElement;
	root: Root;
}> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const participants = overrides.participants ?? [
		participant("local", "Local User", "host"),
		participant("remote", "Remote User", "viewer"),
	];

	await act(async () => {
		root.render(
			<RoomRail
				activeParticipantId="local"
				getParticipantAudioPreference={
					overrides.getParticipantAudioPreference ??
					getDefaultParticipantAudioPreference
				}
				onParticipantAudioChange={vi.fn()}
				participants={participants}
				reactionCueParticipantIds={overrides.reactionCueParticipantIds}
				speakingParticipantIds={overrides.speakingParticipantIds ?? []}
				visibilityMode={overrides.visibilityMode}
			/>,
		);
	});

	return { container, root };
}

function participant(
	id: string,
	displayName: string,
	role: Participant["role"],
): Participant {
	return {
		cameraEnabled: false,
		displayName,
		id,
		lastSeenAt: 1,
		mediaSeat: "joined",
		mediaSeatSource: "auto",
		role,
		syncStatus: "synced",
	};
}

async function pointer(
	target: Element,
	type: string,
	init: PointerEventInit = {},
): Promise<void> {
	await act(async () => {
		target.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: "mouse",
				...init,
			}),
		);
	});
}

async function advance(milliseconds: number): Promise<void> {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(milliseconds);
	});
}

async function unmount(root: Root): Promise<void> {
	await act(async () => root.unmount());
}

function getSlots(container: HTMLElement): HTMLElement[] {
	return [...container.querySelectorAll(".room-rail-slot")].filter(
		(element): element is HTMLElement => element instanceof HTMLElement,
	);
}

function getPresentations(container: HTMLElement): Array<string | null> {
	return getSlots(container).map((slot) =>
		slot.getAttribute("data-presentation"),
	);
}

function getElement(container: HTMLElement, selector: string): HTMLElement {
	const element = container.querySelector(selector);
	if (!(element instanceof HTMLElement)) {
		throw new Error(`Element not found: ${selector}`);
	}
	return element;
}

function rect(
	left: number,
	top: number,
	width: number,
	height: number,
): DOMRect {
	return {
		bottom: top + height,
		height,
		left,
		right: left + width,
		top,
		width,
		x: left,
		y: top,
		toJSON: () => ({}),
	} as DOMRect;
}
