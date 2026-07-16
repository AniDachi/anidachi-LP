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
