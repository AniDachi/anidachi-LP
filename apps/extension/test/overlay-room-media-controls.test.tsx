import type { Participant } from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	PanelCameraControl,
	RoomPeopleSection,
} from "../src/overlay-room-media-controls";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("PanelCameraControl", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("toggles the current user's camera from the panel header", async () => {
		const onToggle = vi.fn();
		const view = await render(
			<PanelCameraControl
				cameraEnabled
				disabled={false}
				disabledReason=""
				onToggle={onToggle}
			/>,
		);

		const button = getButton(view.container, "Turn camera off");
		expect(button.getAttribute("role")).toBe("switch");
		expect(button.getAttribute("aria-checked")).toBe("true");
		expect(button.classList.contains("active")).toBe(true);
		expect(button.classList.contains("inactive")).toBe(false);
		expect(button.classList.contains("unavailable")).toBe(false);
		expect(button.querySelector("svg")?.getAttribute("width")).toBe("12");
		expect(button.querySelector(".panel-camera-control-thumb")).not.toBeNull();
		expect(button.textContent).toBe("");
		await click(button);
		expect(onToggle).toHaveBeenCalledTimes(1);

		await unmount(view.root);
	});

	it("distinguishes an available camera that is turned off", async () => {
		const view = await render(
			<PanelCameraControl
				cameraEnabled={false}
				disabled={false}
				disabledReason=""
				onToggle={vi.fn()}
			/>,
		);

		const button = getButton(view.container, "Turn camera on");
		expect(button.getAttribute("aria-checked")).toBe("false");
		expect(button.classList.contains("inactive")).toBe(true);
		expect(button.classList.contains("active")).toBe(false);
		expect(button.classList.contains("unavailable")).toBe(false);
		expect(button.textContent).toBe("");

		await unmount(view.root);
	});

	it("keeps camera visible but unavailable without a media seat", async () => {
		const onToggle = vi.fn();
		const view = await render(
			<PanelCameraControl
				cameraEnabled={false}
				disabled
				disabledReason="Media seat required"
				onToggle={onToggle}
			/>,
		);

		const button = getButton(view.container, "Camera unavailable");
		expect(button.disabled).toBe(true);
		expect(button.getAttribute("aria-checked")).toBe("false");
		expect(button.title).toBe("Media seat required");
		expect(button.classList.contains("unavailable")).toBe(true);
		expect(button.textContent).toBe("");

		await unmount(view.root);
	});

	it("never presents a disabled camera as active", async () => {
		const view = await render(
			<PanelCameraControl
				cameraEnabled
				disabled
				disabledReason="Media seat required"
				onToggle={vi.fn()}
			/>,
		);

		const button = getButton(view.container, "Camera unavailable");
		expect(button.classList.contains("active")).toBe(false);
		expect(button.querySelector(".lucide-video-off")).not.toBeNull();

		await unmount(view.root);
	});
});

describe("RoomPeopleSection", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("pins the host first, the current participant second, and keeps self media passive", async () => {
		const host = participant("host", "Host User", "host", "joined", true);
		const self = participant("self", "Current User", "viewer", "joined", false);
		const other = participant("other", "Other User", "viewer", "none", false);
		const view = await renderPeople({
			currentParticipantId: self.id,
			participants: [other, self, host],
		});

		const rows = [
			...view.container.querySelectorAll<HTMLElement>(".room-people-row"),
		];
		expect(
			rows.map((row) => row.querySelector(".room-people-name")?.textContent),
		).toEqual(["Host User", "Current User", "Other User"]);
		expect(rows[0]?.classList.contains("host")).toBe(true);
		expect(rows[0]?.querySelector(".room-people-you")).toBeNull();
		expect(
			rows[0]?.querySelector(".room-people-side.identity")?.textContent,
		).toBe("Host");
		expect(rows[0]?.querySelector(".room-people-name-row")?.textContent).toBe(
			"Host User",
		);
		expect(rows[1]?.querySelector(".room-people-name-row")?.textContent).toBe(
			"Current User",
		);
		expect(
			rows[1]?.querySelector(".room-people-side.identity .room-people-you")
				?.textContent,
		).toBe("You");
		expect(rows[1]?.querySelector(".room-people-action")).toBeNull();
		expect(
			view.container.querySelectorAll(".room-people-entry"),
		).toHaveLength(3);
		expect(view.container.querySelector(".room-people-host-divider")).toBeNull();
		expect(
			view.container.querySelector(".room-people-heading-icon"),
		).toBeInstanceOf(SVGElement);
		expect(
			view.container.querySelector(".room-people-heading-label")?.textContent,
		).toBe("People");
		expect(
			view.container.querySelector(".room-people-count")?.textContent,
		).toBe("1/6 in room");

		await unmount(view.root);
	});

	it("keeps speaking feedback local to the participant identity", async () => {
		const host = participant("host", "Host User", "host", "joined", true);
		const view = await renderPeople({
			currentParticipantId: host.id,
			liveVoiceActiveSpeakerIds: [host.id],
			participants: [host],
		});

		const row = view.container.querySelector(".room-people-row");
		expect(row?.classList.contains("host")).toBe(true);
		expect(row?.classList.contains("speaking")).toBe(true);
		expect(row?.querySelector(".room-people-avatar")).not.toBeNull();
		expect(row?.querySelector(".room-people-seat-status")?.textContent).toBe(
			"Media seat",
		);
		expect(
			row?.querySelector('[aria-label="Camera on"]'),
		).not.toBeNull();

		await unmount(view.root);
	});

	it("shows camera state separately from the granted media seat", async () => {
		const participantWithCameraOff = participant(
			"self",
			"Current User",
			"viewer",
			"joined",
			false,
		);
		const view = await renderPeople({
			currentParticipantId: participantWithCameraOff.id,
			participants: [participantWithCameraOff],
		});

		expect(
			view.container.querySelector(".room-people-seat-status")?.textContent,
		).toBe("Media seat");
		expect(
			view.container.querySelector('[aria-label="Camera off"]'),
		).not.toBeNull();

		await unmount(view.root);
	});

	it("lets a participant request or cancel media without showing a media leave action", async () => {
		const onRequestMediaSeat = vi.fn();
		const onCancelMediaSeatRequest = vi.fn();
		const self = participant("self", "Current User", "viewer", "none", false);
		const view = await renderPeople({
			currentParticipantId: self.id,
			onCancelMediaSeatRequest,
			onRequestMediaSeat,
			participants: [self],
		});

		await click(getButton(view.container, "Request"));
		expect(onRequestMediaSeat).toHaveBeenCalledWith(self.id);

		await act(async () => {
			view.root.render(
				<RoomPeopleSection
					{...defaultPeopleProps}
					currentParticipantId={self.id}
					onCancelMediaSeatRequest={onCancelMediaSeatRequest}
					onRequestMediaSeat={onRequestMediaSeat}
					participants={[{ ...self, mediaSeat: "requested" }]}
				/>,
			);
		});

		await click(getButton(view.container, "Cancel"));
		expect(onCancelMediaSeatRequest).toHaveBeenCalledWith(self.id);
		expect(view.container.textContent).not.toContain("Leave");

		await unmount(view.root);
	});

	it("gives the host explicit media-seat actions for other participants", async () => {
		const onGrantMediaSeat = vi.fn();
		const onRevokeMediaSeat = vi.fn();
		const host = participant("host", "Host User", "host", "joined", true);
		const joined = participant(
			"joined",
			"Joined User",
			"viewer",
			"joined",
			false,
		);
		const requested = participant(
			"requested",
			"Requested User",
			"viewer",
			"requested",
			false,
		);
		const available = participant(
			"available",
			"Available User",
			"viewer",
			"none",
			false,
		);
		const view = await renderPeople({
			currentParticipantId: host.id,
			onGrantMediaSeat,
			onRevokeMediaSeat,
			participants: [available, requested, joined, host],
		});

		await click(getButton(view.container, "Remove"));
		await click(getButton(view.container, "Accept"));
		const giveSeatButton = getButton(view.container, "Give seat");
		expect(giveSeatButton.querySelector("svg")).not.toBeNull();
		await click(giveSeatButton);
		expect(onRevokeMediaSeat).toHaveBeenCalledWith(joined.id);
		expect(onGrantMediaSeat).toHaveBeenNthCalledWith(1, requested.id);
		expect(onGrantMediaSeat).toHaveBeenNthCalledWith(2, available.id);

		await unmount(view.root);
	});
});

const defaultPeopleProps = {
	currentParticipantId: "self",
	liveVoiceActiveSpeakerIds: [] as string[],
	maxMediaSeats: 4,
	occupiedMediaSeatCount: 1,
	onCancelMediaSeatRequest: vi.fn(),
	onGrantMediaSeat: vi.fn(),
	onRequestMediaSeat: vi.fn(),
	onRevokeMediaSeat: vi.fn(),
	participants: [] as Participant[],
	roomPeopleCountText: "1/6 in room",
};

async function renderPeople(
	props: Partial<React.ComponentProps<typeof RoomPeopleSection>>,
): Promise<RenderedView> {
	return render(<RoomPeopleSection {...defaultPeopleProps} {...props} />);
}

function participant(
	id: string,
	displayName: string,
	role: Participant["role"],
	mediaSeat: Participant["mediaSeat"],
	cameraEnabled: boolean,
): Participant {
	return {
		cameraEnabled,
		displayName,
		id,
		lastSeenAt: 1,
		mediaSeat,
		role,
		syncStatus: "synced",
	};
}

interface RenderedView {
	container: HTMLDivElement;
	root: Root;
}

async function render(node: React.ReactNode): Promise<RenderedView> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => {
		root.render(node);
	});
	return { container, root };
}

async function click(button: HTMLButtonElement): Promise<void> {
	await act(async () => {
		button.click();
	});
}

function getButton(container: HTMLElement, name: string): HTMLButtonElement {
	const button = [...container.querySelectorAll("button")].find(
		(candidate) =>
			candidate.getAttribute("aria-label") === name ||
			candidate.textContent?.trim() === name,
	);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Button not found: ${name}`);
	}
	return button;
}

async function unmount(root: Root): Promise<void> {
	await act(async () => {
		root.unmount();
	});
}

describe("independent room media controls", () => {
 it("shows independent grants, reconnect reservation, and explicit microphone readiness", async () => {
  const self = { ...participant("self", "Self", "viewer", "none", false), participantSessionId: "self-session" };
  const host = { ...participant("host", "Host", "host", "none", false), participantSessionId: "host-session", connected: false };
  const onMicrophoneReadyChange = vi.fn();
  const mediaSnapshot: import("@anidachi/protocol").RoomMediaSnapshot = { type: "ROOM_MEDIA_SNAPSHOT", roomId: "room", roomGeneration: 1, snapshotSequence: 1, closingAt: null,
   capabilities: { mediaProtocolVersion: 2, hostPlanCode: "pro", maxParticipants: 15, maxCameras: 4, maxMicrophones: 8, capabilityRevision: 1, capabilitiesValidUntil: "2026-09-08T20:00:00Z" },
   participants: [self,host].map((p,i) => ({ participantSessionId: p.participantSessionId, cameraGranted: i===1, microphoneGranted: false, cameraIntentSequence: 1, microphoneIntentSequence: 0, cameraRevocationEpoch: 0, microphoneRevocationEpoch: 0 })) };
  const view = await renderPeople({ participants: [self,host], mediaSnapshot, onMicrophoneReadyChange });
  expect(view.container.textContent).toContain("1/4 cameras · 0/8 microphones");
  expect(view.container.textContent).toContain("Reconnecting — places reserved");
  expect(onMicrophoneReadyChange).not.toHaveBeenCalled();
  await click(getButton(view.container,"Enable microphone")); expect(onMicrophoneReadyChange).toHaveBeenCalledWith(true);
  expect(view.container.textContent).not.toContain("Request media");
  await unmount(view.root);
 });
 it("pending v2 presents no legacy seat request or capture action", async () => {
  const view=await renderPeople({mediaSnapshot:null}); expect(getButton(view.container,"Enable microphone").disabled).toBe(true);
  expect(view.container.textContent).toContain("Waiting for room media permissions"); await unmount(view.root);
 });
});

describe("v3 host media-seat controls", () => {
 const participants = [
  {...participant("host", "A host with a long display name", "host", "none", false), participantSessionId: "host-session"},
  {...participant("guest", "Guest", "viewer", "none", false), participantSessionId: "guest-session"},
 ];
 const snapshot: import("@anidachi/protocol").RoomMediaV3Snapshot = {
  type: "ROOM_MEDIA_SNAPSHOT", roomId: "room", roomGeneration: 1, snapshotSequence: 1, closingAt: null,
  capabilities: {mediaProtocolVersion: 3, hostPlanCode: "free", maxParticipants: 4, maxMediaSeats: 4, maxCameras: 4, capabilityRevision: 1, capabilitiesValidUntil: "2026-09-15T12:30:00Z"},
  participants: participants.map((p, i) => ({participantSessionId: p.participantSessionId, mediaSeatGranted: i === 0, seatRevision: 0, cameraGranted: false, microphoneGranted: false, cameraIntentSequence: 0, microphoneIntentSequence: 0, cameraRevocationEpoch: 0, microphoneRevocationEpoch: 0})),
 };
 it("offers one confirmed seat action per row including the host's own seat", async () => {
  const onSetMediaSeat = vi.fn();
  const view = await renderPeople({participants, mediaSnapshot: snapshot, currentParticipantId: "host", onSetMediaSeat});
  try {
   expect(view.container.textContent).toContain("1/4 media seats · 0/4 cameras");
   expect(view.container.textContent).not.toMatch(/Enable microphone|Disable microphone|Revoke microphone|Revoke camera/);
   const revoke = getButton(view.container, "Revoke media seat: A host with a long display name");
   expect(revoke.getAttribute("aria-pressed")).toBe("true");
   expect(revoke.querySelector(".lucide-radio")).not.toBeNull();
   await click(revoke); expect(onSetMediaSeat).toHaveBeenCalledWith("host", false);
   expect(revoke.getAttribute("aria-pressed")).toBe("true");
   await click(getButton(view.container, "Grant media seat: Guest"));
   expect(onSetMediaSeat).toHaveBeenLastCalledWith("guest", true);
  } finally {await unmount(view.root);}
 });
 it("shows passive seat indicators to guests", async () => {
  const view = await renderPeople({participants, mediaSnapshot: snapshot, currentParticipantId: "guest"});
  try {expect(view.container.querySelectorAll("button")).toHaveLength(0); expect(view.container.querySelectorAll(".room-media-seat-control")).toHaveLength(2);}
  finally {await unmount(view.root);}
 });
 it("keeps full-capacity and row-specific pending/error reasons accessible", async () => {
  const full = {...snapshot, capabilities: {...snapshot.capabilities, hostPlanCode: "pro" as const, maxParticipants: 15 as const, maxMediaSeats: 8 as const}, participants: [...snapshot.participants, ...Array.from({length: 7}, (_, i) => ({...snapshot.participants[0], participantSessionId: `extra-${i}`}))]};
  const view = await renderPeople({participants, mediaSnapshot: full, currentParticipantId: "host", seatControls: new Map([["host", {pending: true}], ["guest", {pending: false, error: "Participant reconnected. Try again."}]])});
  try {
   expect(getButton(view.container, "Grant media seat: Guest").disabled).toBe(true);
   expect(getButton(view.container, "Revoke media seat: A host with a long display name").disabled).toBe(true);
   expect(view.container.textContent).toContain("All media seats are in use. Free a seat first.");
   expect(view.container.querySelector('[role="alert"]')?.closest(".room-people-entry")?.textContent).toContain("Guest");
  } finally {await unmount(view.root);}
 });
 it("omits the full-seat warning when all current members already have seats", async () => {
  const allParticipants = [...participants, ...["third", "fourth"].map(id => ({...participant(id, id, "viewer", "none", false), participantSessionId: `${id}-session`}))];
  const allSeated = {...snapshot, participants: allParticipants.map(p => ({...snapshot.participants[0], participantSessionId: p.participantSessionId, mediaSeatGranted: true}))};
  const view = await renderPeople({participants: allParticipants, mediaSnapshot: allSeated, currentParticipantId: "host"});
  try {
   expect(view.container.textContent).toContain("4/4 media seats");
   expect(view.container.textContent).not.toContain("All media seats are in use");
   expect([...view.container.querySelectorAll("button")].every(button => !button.disabled)).toBe(true);
  } finally {await unmount(view.root);}
 });
});
