import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverlayLayoutEditor } from "../src/overlay-layout-editor";
import {
	type OverlayLayoutContext,
	resolveOverlayLayout,
} from "../src/overlay-layout-engine";
import {
	getDefaultOverlayLayoutDefinition,
	type OverlayLayoutDefinition,
} from "../src/overlay-layout-model";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface RenderedEditor {
	container: HTMLDivElement;
	onApply: ReturnType<
		typeof vi.fn<(layout: OverlayLayoutDefinition) => Promise<void>>
	>;
	onCameraToggle: ReturnType<typeof vi.fn<() => void>>;
	onPreviewChange: ReturnType<
		typeof vi.fn<(layout: OverlayLayoutDefinition | null) => void>
	>;
	root: Root;
}

const measuredLayoutContext: OverlayLayoutContext = {
	cameraCount: 1,
	reservedRects: [],
	viewport: {
		height: 1080,
		safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
		width: 1920,
	},
};

describe("OverlayLayoutEditor", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("renders one interactive leader, three noninteractive video ghosts, and chat ghosts", async () => {
		const editor = await renderEditor();

		expect(
			editor.container.querySelectorAll('[data-layout-video-slot="leader"]'),
		).toHaveLength(1);
		expect(
			editor.container.querySelectorAll('[data-layout-video-slot="ghost"]'),
		).toHaveLength(3);
		expect(
			editor.container.querySelectorAll("[data-layout-chat-ghost]").length,
		).toBeGreaterThan(0);
		expect(
			editor.container
				.querySelector('[data-layout-video-slot="leader"]')
				?.getAttribute("tabindex"),
		).toBe("0");
		for (const ghost of editor.container.querySelectorAll(
			'[data-layout-video-slot="ghost"]',
		)) {
			expect(ghost.getAttribute("tabindex")).toBeNull();
		}

		await unmount(editor.root);
	});

	it("scales preview geometry from the measured player context", async () => {
		const editor = await renderEditor({ layoutContext: measuredLayoutContext });
		const preview = getPreview(editor.container);
		const leader = getLeader(editor.container);
		const projected = resolveOverlayLayout(getDefaultOverlayLayoutDefinition(), {
			...measuredLayoutContext,
			cameraCount: 4,
		});
		const projectedLeader = projected.video.slots[0];
		if (!projectedLeader) {
			throw new Error("Projected video leader not found");
		}

		expect(preview.style.aspectRatio).toBe("1920 / 1080");
		expect(leader.style.width).toBe(
			`${(projected.video.effectiveSizePx / 1920) * 100}%`,
		);
		expect(leader.style.height).toBe(
			`${(projected.video.effectiveSizePx / 1080) * 100}%`,
		);
		expect(leader.style.left).toBe(`${(projectedLeader.x / 1920) * 100}%`);
		expect(leader.style.top).toBe(`${(projectedLeader.y / 1080) * 100}%`);

		await unmount(editor.root);
	});

	it("publishes the draft for live preview and clears it on unmount", async () => {
		const editor = await renderEditor();

		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(
			getDefaultOverlayLayoutDefinition(),
		);

		await changeSelect(getSelect(editor.container, "Camera size"), "3");
		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				video: expect.objectContaining({ sizeStep: 3 }),
			}),
		);

		await unmount(editor.root);
		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(null);
	});

	it("reflows a dirty draft when the measured player viewport changes", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		const editor = await renderEditor({ appliedLayout });
		await changeSelect(getSelect(editor.container, "Camera size"), "3");
		const resizedContext: OverlayLayoutContext = {
			...measuredLayoutContext,
			viewport: { ...measuredLayoutContext.viewport, height: 720, width: 1280 },
		};

		await act(async () => {
			editor.root.render(
				<OverlayLayoutEditor
					appliedLayout={appliedLayout}
					cameraEnabled={false}
					cameraStatus="Camera off"
					layoutContext={resizedContext}
					onApply={editor.onApply}
					onCameraToggle={editor.onCameraToggle}
					onPreviewChange={editor.onPreviewChange}
				/>,
			);
		});

		const projected = resolveOverlayLayout(
			{
				...appliedLayout,
				video: { ...appliedLayout.video, sizeStep: 3 },
			},
			{ ...resizedContext, cameraCount: 4 },
		);
		expect(getSelect(editor.container, "Camera size").value).toBe("3");
		expect(getPreview(editor.container).style.aspectRatio).toBe("1280 / 720");
		expect(getLeader(editor.container).style.width).toBe(
			`${(projected.video.effectiveSizePx / 1280) * 100}%`,
		);
		expect(getButton(editor.container, "Apply").disabled).toBe(false);

		await unmount(editor.root);
	});

	it("keeps control changes in the draft until Apply", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		const editor = await renderEditor({ appliedLayout });
		const cameraSize = getSelect(editor.container, "Camera size");

		await changeSelect(cameraSize, "3");

		expect(appliedLayout.video.sizeStep).toBe(1);
		expect(editor.onApply).not.toHaveBeenCalled();
		expect(getButton(editor.container, "Apply").disabled).toBe(false);

		await unmount(editor.root);
	});

	it("reverts a dirty draft to the current applied snapshot", async () => {
		const editor = await renderEditor();
		const cameraSize = getSelect(editor.container, "Camera size");

		await changeSelect(cameraSize, "3");
		await click(getButton(editor.container, "Revert"));

		expect(cameraSize.value).toBe("1");
		expect(getButton(editor.container, "Apply").disabled).toBe(true);
		expect(getButton(editor.container, "Revert").disabled).toBe(true);
		expect(editor.onApply).not.toHaveBeenCalled();
		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(
			getDefaultOverlayLayoutDefinition(),
		);

		await unmount(editor.root);
	});

	it("normalizes and sends the draft on Apply, then treats it as locally applied", async () => {
		const editor = await renderEditor();

		await changeSelect(getSelect(editor.container, "Camera size"), "3");
		await click(getButton(editor.container, "Chat"));
		await changeSelect(getSelect(editor.container, "Chat width"), "6");
		await changeSelect(getSelect(editor.container, "Text scale"), "large");
		await changeSelect(getSelect(editor.container, "Visible messages"), "8");
		await click(getButton(editor.container, "Apply"));

		expect(editor.onApply).toHaveBeenCalledTimes(1);
		expect(editor.onApply).toHaveBeenCalledWith({
			video: { anchor: { x: 11, y: 6 }, leaderSide: "right", sizeStep: 3 },
			chat: {
				position: { x: 0, y: 4 },
				width: 6,
				textScale: "large",
				maxMessages: 8,
			},
		});
		expect(getButton(editor.container, "Apply").disabled).toBe(true);
		expect(getButton(editor.container, "Revert").disabled).toBe(true);

		await unmount(editor.root);
	});

	it("keeps the prior applied snapshot and dirty draft when Apply rejects", async () => {
		const onApply = vi.fn<(layout: OverlayLayoutDefinition) => Promise<void>>(
			() => Promise.reject(new Error("storage unavailable")),
		);
		const editor = await renderEditor({ onApply });
		const cameraSize = getSelect(editor.container, "Camera size");

		await changeSelect(cameraSize, "3");
		await click(getButton(editor.container, "Apply"));

		expect(cameraSize.value).toBe("3");
		expect(getButton(editor.container, "Apply").disabled).toBe(false);
		expect(
			editor.container.querySelector('[role="status"]')?.textContent,
		).toMatch(/could not be saved/i);
		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				video: expect.objectContaining({ sizeStep: 3 }),
			}),
		);

		await click(getButton(editor.container, "Revert"));
		expect(cameraSize.value).toBe("1");
		expect(editor.onApply).toHaveBeenCalledTimes(1);
		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(
			getDefaultOverlayLayoutDefinition(),
		);

		await unmount(editor.root);
	});

	it("refreshes both snapshots when the appliedLayout prop changes", async () => {
		const initial = getDefaultOverlayLayoutDefinition();
		const editor = await renderEditor({ appliedLayout: initial });

		await changeSelect(getSelect(editor.container, "Camera size"), "3");
		const next = structuredClone(initial);
		next.video.sizeStep = 0;
		await act(async () => {
			editor.root.render(
				<OverlayLayoutEditor
					appliedLayout={next}
					cameraEnabled={false}
					cameraStatus="Camera off"
					layoutContext={measuredLayoutContext}
					onApply={editor.onApply}
					onCameraToggle={editor.onCameraToggle}
					onPreviewChange={editor.onPreviewChange}
				/>,
			);
		});

		expect(getSelect(editor.container, "Camera size").value).toBe("0");
		expect(getButton(editor.container, "Apply").disabled).toBe(true);

		await unmount(editor.root);
	});

	it("preserves a dirty draft when an equivalent appliedLayout object is received", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		const editor = await renderEditor({ appliedLayout });

		await changeSelect(getSelect(editor.container, "Camera size"), "3");
		await act(async () => {
			editor.root.render(
				<OverlayLayoutEditor
					appliedLayout={structuredClone(appliedLayout)}
					cameraEnabled={false}
					cameraStatus="Camera off"
					layoutContext={measuredLayoutContext}
					onApply={editor.onApply}
					onCameraToggle={editor.onCameraToggle}
					onPreviewChange={editor.onPreviewChange}
				/>,
			);
		});

		expect(getSelect(editor.container, "Camera size").value).toBe("3");
		expect(getButton(editor.container, "Apply").disabled).toBe(false);

		await unmount(editor.root);
	});

	it("keeps an in-flight Apply locked across an equivalent prop refresh", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		let resolveApply: (() => void) | undefined;
		const onApply = vi.fn<(layout: OverlayLayoutDefinition) => Promise<void>>(
			() =>
				new Promise<void>((resolve) => {
					resolveApply = resolve;
				}),
		);
		const editor = await renderEditor({ appliedLayout, onApply });

		await changeSelect(getSelect(editor.container, "Camera size"), "3");
		await click(getButton(editor.container, "Apply"));
		expect(getButton(editor.container, "Applying").disabled).toBe(true);

		await act(async () => {
			editor.root.render(
				<OverlayLayoutEditor
					appliedLayout={structuredClone(appliedLayout)}
					cameraEnabled={false}
					cameraStatus="Camera off"
					layoutContext={measuredLayoutContext}
					onApply={editor.onApply}
					onCameraToggle={editor.onCameraToggle}
					onPreviewChange={editor.onPreviewChange}
				/>,
			);
		});

		expect(getButton(editor.container, "Applying").disabled).toBe(true);
		expect(editor.onApply).toHaveBeenCalledTimes(1);
		await act(async () => {
			resolveApply?.();
		});

		await unmount(editor.root);
	});

	it("discards an unapplied draft after unmount and remount", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		const first = await renderEditor({ appliedLayout });

		await changeSelect(getSelect(first.container, "Camera size"), "3");
		await unmount(first.root);

		const second = await renderEditor({ appliedLayout });
		expect(getSelect(second.container, "Camera size").value).toBe("1");
		expect(second.onApply).not.toHaveBeenCalled();

		await unmount(second.root);
	});

	it("preserves pointer grab offset and keeps the snapped draft on pointer up", async () => {
		const appliedLayout = layoutAt({ x: 2, y: 2 });
		const editor = await renderEditor({ appliedLayout });
		const preview = getPreview(editor.container);
		const leader = getLeader(editor.container);
		mockPreviewBounds(preview);
		mockPointerCapture(leader);

		await pointer(leader, "pointerdown", {
			clientX: 181.33,
			clientY: 112.5,
			pointerId: 7,
		});
		await pointer(leader, "pointermove", {
			clientX: 405.33,
			clientY: 157.5,
			pointerId: 7,
		});
		await pointer(leader, "pointerup", {
			clientX: 405.33,
			clientY: 157.5,
			pointerId: 7,
		});
		await click(getButton(editor.container, "Apply"));

		expect(editor.onApply).toHaveBeenCalledWith(
			expect.objectContaining({
				video: expect.objectContaining({ anchor: { x: 6, y: 3 } }),
			}),
		);

		await unmount(editor.root);
	});

	it("restores the drag-start draft and releases capture on pointer cancel", async () => {
		const appliedLayout = layoutAt({ x: 2, y: 2 });
		const editor = await renderEditor({ appliedLayout });
		const preview = getPreview(editor.container);
		const leader = getLeader(editor.container);
		mockPreviewBounds(preview);
		const releasePointerCapture = mockPointerCapture(leader);

		await pointer(leader, "pointerdown", {
			clientX: 133.33,
			clientY: 112.5,
			pointerId: 9,
		});
		await pointer(leader, "pointermove", {
			clientX: 400,
			clientY: 247.5,
			pointerId: 9,
		});
		expect(getButton(editor.container, "Apply").disabled).toBe(false);
		await pointer(leader, "pointercancel", {
			clientX: 400,
			clientY: 247.5,
			pointerId: 9,
		});

		expect(releasePointerCapture).toHaveBeenCalledWith(9);
		expect(getButton(editor.container, "Apply").disabled).toBe(true);

		await unmount(editor.root);
	});

	it("restores the drag-start draft when pointer capture is lost", async () => {
		const editor = await renderEditor({
			appliedLayout: layoutAt({ x: 2, y: 2 }),
		});
		const leader = getLeader(editor.container);
		mockPreviewBounds(getPreview(editor.container));
		mockPointerCapture(leader);

		await pointer(leader, "pointerdown", {
			clientX: 133.33,
			clientY: 112.5,
			pointerId: 14,
		});
		await pointer(leader, "pointermove", {
			clientX: 400,
			clientY: 247.5,
			pointerId: 14,
		});
		expect(getButton(editor.container, "Apply").disabled).toBe(false);

		await pointer(leader, "lostpointercapture", {
			clientX: 400,
			clientY: 247.5,
			pointerId: 14,
		});

		expect(getButton(editor.container, "Apply").disabled).toBe(true);

		await unmount(editor.root);
	});

	it("does not change geometry for a pointer click without movement", async () => {
		const editor = await renderEditor();
		const leader = getLeader(editor.container);
		mockPreviewBounds(getPreview(editor.container));
		mockPointerCapture(leader);

		await pointer(leader, "pointerdown", {
			clientX: 586.67,
			clientY: 292.5,
			pointerId: 10,
		});
		await pointer(leader, "pointerup", {
			clientX: 586.67,
			clientY: 292.5,
			pointerId: 10,
		});

		expect(getButton(editor.container, "Apply").disabled).toBe(true);

		await unmount(editor.root);
	});

	it("rolls back an active pointer drag with Escape", async () => {
		const editor = await renderEditor({
			appliedLayout: layoutAt({ x: 2, y: 2 }),
		});
		const leader = getLeader(editor.container);
		mockPreviewBounds(getPreview(editor.container));
		const releasePointerCapture = mockPointerCapture(leader);

		await pointer(leader, "pointerdown", {
			clientX: 133.33,
			clientY: 112.5,
			pointerId: 11,
		});
		await pointer(leader, "pointermove", {
			clientX: 400,
			clientY: 247.5,
			pointerId: 11,
		});
		expect(getButton(editor.container, "Apply").disabled).toBe(false);

		await keydown(leader, "Escape");

		expect(releasePointerCapture).toHaveBeenCalledWith(11);
		expect(getButton(editor.container, "Apply").disabled).toBe(true);

		await unmount(editor.root);
	});

	it("ignores a secondary pointer without replacing the active drag session", async () => {
		const editor = await renderEditor({
			appliedLayout: layoutAt({ x: 2, y: 2 }),
		});
		const leader = getLeader(editor.container);
		mockPreviewBounds(getPreview(editor.container));
		mockPointerCapture(leader);

		await pointer(leader, "pointerdown", {
			clientX: 133.33,
			clientY: 112.5,
			pointerId: 12,
		});
		await pointer(leader, "pointermove", {
			clientX: 400,
			clientY: 247.5,
			pointerId: 12,
		});
		await pointer(leader, "pointerdown", {
			clientX: 420,
			clientY: 247.5,
			isPrimary: false,
			pointerId: 13,
		});
		await pointer(leader, "pointercancel", {
			clientX: 400,
			clientY: 247.5,
			pointerId: 12,
		});

		expect(getButton(editor.container, "Apply").disabled).toBe(true);

		await unmount(editor.root);
	});

	it("moves the selected handle by one grid cell with arrows and rolls back with Escape", async () => {
		const appliedLayout = layoutAt({ x: 8, y: 3 });
		const editor = await renderEditor({ appliedLayout });
		const leader = getLeader(editor.container);

		await keydown(leader, "ArrowLeft");
		await blur(leader);
		await click(getButton(editor.container, "Apply"));
		expect(editor.onApply).toHaveBeenLastCalledWith(
			expect.objectContaining({
				video: expect.objectContaining({ anchor: { x: 7, y: 3 } }),
			}),
		);

		await keydown(leader, "ArrowLeft");
		expect(getButton(editor.container, "Apply").disabled).toBe(false);
		await keydown(leader, "Escape");
		expect(getButton(editor.container, "Apply").disabled).toBe(true);

		await unmount(editor.root);
	});

	it("calls the camera toggle callback", async () => {
		const editor = await renderEditor({
			cameraEnabled: true,
			cameraStatus: "Camera ready",
		});

		expect(editor.container.textContent).toContain("Camera ready");
		await click(getButton(editor.container, "Turn camera off"));

		expect(editor.onCameraToggle).toHaveBeenCalledTimes(1);

		await unmount(editor.root);
	});
});

async function renderEditor({
	appliedLayout = getDefaultOverlayLayoutDefinition(),
	cameraEnabled = false,
	cameraStatus = "Camera off",
	onApply = vi.fn<(layout: OverlayLayoutDefinition) => Promise<void>>(() =>
		Promise.resolve(),
	),
	onCameraToggle = vi.fn<() => void>(),
	onPreviewChange = vi.fn<(layout: OverlayLayoutDefinition | null) => void>(),
	layoutContext = measuredLayoutContext,
}: Partial<{
	appliedLayout: OverlayLayoutDefinition;
	cameraEnabled: boolean;
	cameraStatus: string;
	onApply: ReturnType<
		typeof vi.fn<(layout: OverlayLayoutDefinition) => Promise<void>>
	>;
	onCameraToggle: ReturnType<typeof vi.fn<() => void>>;
	onPreviewChange: ReturnType<
		typeof vi.fn<(layout: OverlayLayoutDefinition | null) => void>
	>;
	layoutContext: OverlayLayoutContext;
}> = {}): Promise<RenderedEditor> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);

	await act(async () => {
		root.render(
			<OverlayLayoutEditor
				appliedLayout={appliedLayout}
				cameraEnabled={cameraEnabled}
				cameraStatus={cameraStatus}
				layoutContext={layoutContext}
				onApply={onApply}
				onCameraToggle={onCameraToggle}
				onPreviewChange={onPreviewChange}
			/>,
		);
	});

	return { container, onApply, onCameraToggle, onPreviewChange, root };
}

function layoutAt(anchor: { x: number; y: number }): OverlayLayoutDefinition {
	const layout = getDefaultOverlayLayoutDefinition();
	layout.video.anchor = anchor;
	layout.video.leaderSide = anchor.x <= 4 ? "left" : "right";
	return layout;
}

function getButton(container: HTMLElement, name: string): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) =>
			candidate.textContent?.trim() === name ||
			candidate.getAttribute("aria-label") === name,
	);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Button not found: ${name}`);
	}
	return button;
}

function getSelect(container: HTMLElement, label: string): HTMLSelectElement {
	const select = container.querySelector(`select[aria-label="${label}"]`);
	if (!(select instanceof HTMLSelectElement)) {
		throw new Error(`Select not found: ${label}`);
	}
	return select;
}

function getPreview(container: HTMLElement): HTMLElement {
	const preview = container.querySelector(".layout-preview-v2");
	if (!(preview instanceof HTMLElement)) {
		throw new Error("Layout preview not found");
	}
	return preview;
}

function getLeader(container: HTMLElement): HTMLElement {
	const leader = container.querySelector('[data-layout-video-slot="leader"]');
	if (!(leader instanceof HTMLElement)) {
		throw new Error("Video leader not found");
	}
	return leader;
}

function mockPreviewBounds(preview: HTMLElement) {
	vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({
		bottom: 360,
		height: 360,
		left: 0,
		right: 640,
		toJSON: () => ({}),
		top: 0,
		width: 640,
		x: 0,
		y: 0,
	});
}

function mockPointerCapture(target: HTMLElement) {
	const releasePointerCapture = vi.fn();
	Object.assign(target, {
		hasPointerCapture: vi.fn(() => true),
		releasePointerCapture,
		setPointerCapture: vi.fn(),
	});
	return releasePointerCapture;
}

async function changeSelect(select: HTMLSelectElement, value: string) {
	await act(async () => {
		select.value = value;
		select.dispatchEvent(new Event("change", { bubbles: true }));
	});
}

async function click(button: HTMLButtonElement) {
	await act(async () => {
		button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	});
}

async function pointer(
	target: HTMLElement,
	type: string,
	init: {
		clientX: number;
		clientY: number;
		isPrimary?: boolean;
		pointerId: number;
	},
) {
	await act(async () => {
		target.dispatchEvent(
			new PointerEvent(type, { bubbles: true, isPrimary: true, ...init }),
		);
	});
}

async function keydown(target: HTMLElement, key: string) {
	await act(async () => {
		target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
	});
}

async function blur(target: HTMLElement) {
	await act(async () => {
		target.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
	});
}

async function unmount(root: Root) {
	await act(async () => {
		root.unmount();
	});
}
