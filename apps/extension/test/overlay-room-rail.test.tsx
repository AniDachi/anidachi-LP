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

	it("reveals the Smart list at peek width only after deliberate edge dwell", async () => {
		const view = await renderRail({ visibilityMode: "smart" });
		const edge = getElement(view.container, ".room-rail-edge");
		edge.getBoundingClientRect = () => rect(986, 0, 14, 400);

		await pointer(edge, "pointerover", { clientX: 992 });
		expect(
			getElement(view.container, ".room-rail").classList.contains("edge-near"),
		).toBe(true);
		await advance(ROOM_RAIL_OPEN_DELAY_MS * 2);
		expect(getPresentations(view.container)).toEqual(["hidden", "hidden"]);

		await pointer(edge, "pointermove", { clientX: 996 });
		await advance(ROOM_RAIL_OPEN_DELAY_MS - 1);
		expect(getPresentations(view.container)).toEqual(["hidden", "hidden"]);

		await advance(1);
		expect(getPresentations(view.container)).toEqual(["peek", "peek"]);

		await unmount(view.root);
	});

	it("positions the Smart edge glow at the approaching cursor height", async () => {
		const view = await renderRail({ visibilityMode: "smart" });
		const rail = getElement(view.container, ".room-rail");
		const edge = getElement(view.container, ".room-rail-edge");
		edge.getBoundingClientRect = () => rect(986, 40, 14, 320);

		await pointer(edge, "pointerover", { clientX: 992, clientY: 112 });

		expect(rail.classList.contains("edge-near")).toBe(true);
		expect(edge.style.getPropertyValue("--room-rail-edge-y")).toBe("72px");
		expect(getPresentations(view.container)).toEqual(["hidden", "hidden"]);

		await pointer(edge, "pointermove", { clientX: 992, clientY: 286 });
		expect(edge.style.getPropertyValue("--room-rail-edge-y")).toBe("246px");

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
		expect(getPresentations(view.container)).toEqual(["peek", "expanded"]);

		await pointer(remoteSlot, "pointerout", { relatedTarget: document.body });
		await advance(ROOM_RAIL_CLOSE_DELAY_MS);
		expect(getPresentations(view.container)).toEqual(["compact", "compact"]);
		expect(localSlot?.getAttribute("data-presentation")).toBe("compact");

		await unmount(view.root);
	});

	it("keeps a short pointer grace period then restores pills promptly", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });
		const remoteSlot = getSlots(view.container)[1];

		await pointer(remoteSlot, "pointerover");
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("expanded");

		await pointer(remoteSlot, "pointerout", { relatedTarget: document.body });
		await advance(120);
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("expanded");

		await advance(40);
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("compact");

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
		expect(getPresentations(view.container)).toEqual(["peek", "expanded"]);

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
		await act(async () => slider.focus());
		await pointer(remoteSlot, "pointerout", { relatedTarget: document.body });
		await advance(ROOM_RAIL_CLOSE_DELAY_MS * 2);
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("expanded");

		await pointer(slider, "pointerup", { pointerId: 7 });
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("expanded");
		await advance(ROOM_RAIL_CLOSE_DELAY_MS);
		expect(remoteSlot?.getAttribute("data-presentation")).toBe("compact");

		await unmount(view.root);
	});

	it("does not let pointer-originated focus pin a pill after the cursor leaves", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });
		const remoteSlot = getSlots(view.container)[1];
		const remotePill = remoteSlot?.querySelector<HTMLElement>(
			".room-rail-pill",
		);
		if (!remoteSlot || !remotePill) {
			throw new Error("Remote participant pill not found.");
		}

		await pointer(remoteSlot, "pointerover");
		await pointer(remotePill, "pointerdown");
		await act(async () => remotePill.focus());
		await pointer(remoteSlot, "pointerout", { relatedTarget: document.body });
		await advance(ROOM_RAIL_CLOSE_DELAY_MS);

		expect(remoteSlot.getAttribute("data-presentation")).toBe("compact");
		expect(document.activeElement).not.toBe(remotePill);

		await unmount(view.root);
	});

	it("restores keyboard expansion when focus arrives after an outside Tab", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });
		const remoteSlot = getSlots(view.container)[1];
		const remotePill = remoteSlot?.querySelector<HTMLElement>(
			".room-rail-pill",
		);
		if (!remoteSlot || !remotePill) {
			throw new Error("Remote participant pill not found.");
		}

		await pointer(remotePill, "pointerdown");
		await act(async () => {
			document.body.dispatchEvent(
				new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }),
			);
			remotePill.focus();
		});

		expect(getPresentations(view.container)).toEqual(["peek", "expanded"]);

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

	it("shows the profile avatar and preserves the complete display name", async () => {
		const displayName = "Alexandria Very Long Participant Name";
		const view = await renderRail({
			participants: [
				participant("local", "Local User", "host"),
				{
					...participant("remote", displayName, "viewer"),
					avatarUrl: "https://cdn.example.com/avatar.png",
				},
			],
			visibilityMode: "always-visible",
		});
		const remoteSlot = getSlots(view.container)[1];
		const avatar = remoteSlot?.querySelector<HTMLImageElement>(
			"img.room-rail-avatar-image",
		);
		const name = remoteSlot?.querySelector<HTMLElement>(".room-rail-name");

		expect(avatar?.src).toBe("https://cdn.example.com/avatar.png");
		expect(avatar?.alt).toBe("");
		expect(name?.textContent).toBe(displayName);
		expect(name?.title).toBe(displayName);

		await unmount(view.root);
	});

	it("keeps remote identity and volume controls in the same expanded pill", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });
		const remoteSlot = getSlots(view.container)[1];
		await pointer(remoteSlot, "pointerover");
		const content = remoteSlot?.querySelector(".room-rail-content");

		expect(remoteSlot?.getAttribute("data-presentation")).toBe("expanded");
		expect(content?.querySelector(".room-rail-name")?.textContent).toBe(
			"Remote User",
		);
		expect(content?.querySelector(".room-rail-role")?.textContent).toBe(
			"GUEST",
		);
		expect(
			content?.querySelector(".participant-audio-inline-control"),
		).toBeInstanceOf(HTMLElement);

		await unmount(view.root);
	});

	it("uses initials when a participant has no profile avatar", async () => {
		const view = await renderRail({ visibilityMode: "always-visible" });
		const remoteAvatar = getSlots(view.container)[1]?.querySelector(
			".room-rail-avatar-fallback",
		);

		expect(remoteAvatar?.textContent).toBe("RU");

		await unmount(view.root);
	});

	it("falls back to initials when the profile avatar cannot load", async () => {
		const view = await renderRail({
			participants: [
				participant("local", "Local User", "host"),
				{
					...participant("remote", "Remote User", "viewer"),
					avatarUrl: "https://cdn.example.com/missing.png",
				},
			],
			visibilityMode: "always-visible",
		});
		const remoteSlot = getSlots(view.container)[1];
		const avatar = remoteSlot?.querySelector<HTMLImageElement>(
			"img.room-rail-avatar-image",
		);
		if (!avatar) {
			throw new Error("Remote profile avatar not found.");
		}

		await act(async () => avatar.dispatchEvent(new Event("error")));
		expect(remoteSlot?.querySelector("img.room-rail-avatar-image")).toBeNull();
		expect(
			remoteSlot?.querySelector(".room-rail-avatar-fallback")?.textContent,
		).toBe("RU");

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
		expect(
			view.container.querySelector(".room-rail-self-status")?.textContent,
		).toMatch(/you · host/i);

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
