import type { Participant, ReactionEvent } from "@anidachi/protocol";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReactionPop } from "../src/reaction-pop";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("ReactionPop", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("anchors to the participant camera before the side pill", async () => {
		mockGeometry();
		const view = await renderReaction({ camera: true, laneIndex: 0 });
		const reaction = getReaction(view.container);

		expect(reaction.dataset.originKind).toBe("camera");
		expect(reaction.dataset.ready).toBe("true");
		expect(reaction.style.getPropertyValue("--reaction-origin-x")).toBe(
			"640px",
		);
		expect(reaction.style.getPropertyValue("--reaction-origin-y")).toBe(
			"275.6px",
		);

		await unmount(view.root);
	});

	it("anchors rapid reactions to the visible participant avatar", async () => {
		mockGeometry();
		const view = await renderReaction({ camera: false, laneIndex: 1 });
		const reaction = getReaction(view.container);

		expect(reaction.dataset.originKind).toBe("pill");
		expect(reaction.dataset.laneIndex).toBe("1");
		expect(reaction.style.getPropertyValue("--reaction-origin-x")).toBe(
			"655.5px",
		);
		expect(reaction.style.getPropertyValue("--reaction-origin-y")).toBe(
			"385.5px",
		);

		await unmount(view.root);
	});

	it("keeps rapid reactions in a narrow launch corridor with distinct rise paths", async () => {
		mockGeometry();
		const originXs: number[] = [];
		const originYs: number[] = [];
		const risePaths: string[] = [];

		for (let laneIndex = 0; laneIndex < 8; laneIndex += 1) {
			const view = await renderReaction({ camera: false, laneIndex });
			const reaction = getReaction(view.container);
			originXs.push(
				Number.parseFloat(
					reaction.style.getPropertyValue("--reaction-origin-x"),
				),
			);
			originYs.push(
				Number.parseFloat(
					reaction.style.getPropertyValue("--reaction-origin-y"),
				),
			);
			risePaths.push(
				[
					reaction.style.getPropertyValue("--reaction-curve-x"),
					reaction.style.getPropertyValue("--reaction-end-x"),
					reaction.style.getPropertyValue("--reaction-rise-y"),
					reaction.style.getPropertyValue("--reaction-delay"),
				].join(":"),
			);
			await unmount(view.root);
		}

		expect(Math.max(...originXs) - Math.min(...originXs)).toBeLessThanOrEqual(
			10,
		);
		expect(Math.max(...originYs) - Math.min(...originYs)).toBeLessThanOrEqual(
			4,
		);
		expect(new Set(risePaths).size).toBeGreaterThanOrEqual(6);
	});
});

function ReactionHarness({
	camera,
	laneIndex,
}: {
	camera: boolean;
	laneIndex: number;
}) {
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const participant = remoteParticipant();

	return (
		<div className="anidachi-overlay" ref={overlayRef}>
			{camera ? (
				<div className="cam-bubble" data-participant-id={participant.id} />
			) : null}
			<div
				className="room-rail-slot"
				data-participant-id={participant.id}
				data-presentation="compact"
			>
				<div className="room-rail-avatar" />
			</div>
			<ReactionPop
				fallbackParticipantIndex={1}
				laneIndex={laneIndex}
				overlayRef={overlayRef}
				participants={[participant]}
				reaction={remoteReaction()}
			/>
		</div>
	);
}

async function renderReaction(input: {
	camera: boolean;
	laneIndex: number;
}): Promise<{ container: HTMLDivElement; root: Root }> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => {
		root.render(<ReactionHarness {...input} />);
	});
	return { container, root };
}

function mockGeometry(): void {
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
		function (this: HTMLElement) {
			if (this.classList.contains("anidachi-overlay")) {
				return rect(100, 50, 800, 450);
			}
			if (this.classList.contains("cam-bubble")) {
				return rect(700, 300, 80, 80);
			}
			if (this.classList.contains("room-rail-avatar")) {
				return rect(740, 420, 31, 31);
			}
			return rect(0, 0, 0, 0);
		},
	);
}

function remoteParticipant(): Participant {
	return {
		cameraEnabled: true,
		displayName: "Friend",
		id: "remote",
		lastSeenAt: 1,
		mediaSeat: "joined",
		mediaSeatSource: "auto",
		role: "viewer",
		syncStatus: "synced",
	};
}

function remoteReaction(): ReactionEvent {
	return {
		createdAt: 1,
		emoji: "👏",
		id: "reaction-1",
		roomId: "room-1",
		userId: "remote",
		videoTime: 12,
	};
}

function getReaction(container: HTMLElement): HTMLElement {
	const reaction = container.querySelector<HTMLElement>(".reaction-pop");
	if (!reaction) {
		throw new Error("Reaction not found");
	}
	return reaction;
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
		toJSON: () => undefined,
	};
}

async function unmount(root: Root): Promise<void> {
	await act(async () => root.unmount());
}
