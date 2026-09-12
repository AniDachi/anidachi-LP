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
	onChatDisplayModeChange: ReturnType<
		typeof vi.fn<(mode: "live" | "history") => void>
	>;
	container: HTMLDivElement;
	onApply: ReturnType<
		typeof vi.fn<(layout: OverlayLayoutDefinition) => Promise<void>>
	>;
	onPreviewChange: ReturnType<
		typeof vi.fn<(layout: OverlayLayoutDefinition | null) => void>
	>;
	root: Root;
}

const measuredLayoutContext: OverlayLayoutContext = {
	cameraCount: 4,
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
			editor.container.querySelectorAll(
				"[data-overlay-layout-chat-preview-message]",
			).length,
		).toBeGreaterThan(0);
		expect(editor.container.textContent).toContain("That scene was perfect");
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
		const projected = resolveOverlayLayout(
			getDefaultOverlayLayoutDefinition(),
			{
				...measuredLayoutContext,
				cameraCount: 4,
			},
		);
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
		const chat = getChat(editor.container);
		expect(chat.style.getPropertyValue("--layout-preview-chat-gap")).toBe(
			`${(5 / 1920) * 100}cqw`,
		);
		expect(
			chat.style.getPropertyValue("--layout-preview-chat-name-font-size"),
		).toBe(`${(10 / 1920) * 100}cqw`);
		expect(chat.style.getPropertyValue("--layout-preview-chat-padding-x")).toBe(
			`${(10 / 1920) * 100}cqw`,
		);
		expect(chat.style.getPropertyValue("--layout-preview-chat-padding-y")).toBe(
			`${(8 / 1920) * 100}cqw`,
		);

		await unmount(editor.root);
	});

	it("keeps the editor canvas free of live overlay reserved areas", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		appliedLayout.chat.position = { x: 8, y: 0 };
		const layoutContext: OverlayLayoutContext = {
			cameraCount: 4,
			reservedRects: [{ height: 360, width: 184, x: 456, y: 0 }],
			viewport: {
				height: 360,
				safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
				width: 640,
			},
		};
		const expected = resolveOverlayLayout(appliedLayout, {
			...layoutContext,
			cameraCount: 4,
			reservedRects: [],
		});
		const editor = await renderEditor({ appliedLayout, layoutContext });

		expect(
			editor.container.querySelectorAll(".layout-reserved-preview-v2"),
		).toHaveLength(0);
		expect(getChat(editor.container).style.left).toBe(
			`${(expected.chat.rect.x / layoutContext.viewport.width) * 100}%`,
		);
		expect(getChat(editor.container).style.top).toBe(
			`${(expected.chat.rect.y / layoutContext.viewport.height) * 100}%`,
		);

		await unmount(editor.root);
	});

	it("publishes the draft for live preview and clears it on unmount", async () => {
		const editor = await renderEditor();

		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(
			getDefaultOverlayLayoutDefinition(),
		);

		await changeRange(getRange(editor.container, "Camera size"), "3");
		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				video: expect.objectContaining({ sizeStep: 3 }),
			}),
		);

		await unmount(editor.root);
		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(null);
	});

	it("uses stepped sliders for ordered layout settings", async () => {
		const editor = await renderEditor();

		expect(editor.container.querySelector("select")).toBeNull();
		expect(getRange(editor.container, "Camera size").max).toBe("4");
		for (const [value, label] of [
			["0", "Small"],
			["1", "Medium"],
			["2", "Large"],
			["3", "XL"],
			["4", "XXL"],
		] as const) {
			await changeRange(getRange(editor.container, "Camera size"), value);
			expect(
				getRange(editor.container, "Camera size").getAttribute(
					"aria-valuetext",
				),
			).toBe(label);
		}

		await click(getButton(editor.container, "Chat"));
		expect(getRange(editor.container, "Chat width").min).toBe("1");
		expect(getRange(editor.container, "Chat width").max).toBe("6");
		await changeRange(getRange(editor.container, "Chat width"), "1");
		expect(
			getRange(editor.container, "Chat width").getAttribute("aria-valuetext"),
		).toBe("1 column");
		const textScale = getRange(editor.container, "Text scale");
		expect(textScale.max).toBe("3");
		for (const [value, label] of [
			["0", "Small"],
			["1", "Medium"],
			["2", "Large"],
			["3", "XL"],
		] as const) {
			await changeRange(textScale, value);
			expect(textScale.getAttribute("aria-valuetext")).toBe(label);
		}
		const textOpacity = getRange(editor.container, "Text opacity");
		expect(textOpacity.min).toBe("5");
		expect(textOpacity.max).toBe("100");
		expect(textOpacity.step).toBe("5");
		expect(textOpacity.value).toBe("100");
		expect(textOpacity.getAttribute("aria-valuetext")).toBe("100%");
		expect(
			Number(getRange(editor.container, "Visible messages").max),
		).toBeGreaterThan(8);

		await unmount(editor.root);
	});

	it("uses consistent icons for layout modes and editor actions", async () => {
		const editor = await renderEditor();

		expect(
			getButton(editor.container, "Video").querySelector("svg"),
		).not.toBeNull();
		expect(
			getButton(editor.container, "Chat").querySelector("svg"),
		).not.toBeNull();

		await changeRange(getRange(editor.container, "Camera size"), "4");
		expect(
			getButton(editor.container, "Revert").querySelector("svg"),
		).not.toBeNull();
		expect(
			getButton(editor.container, "Apply").querySelector("svg"),
		).not.toBeNull();

		await unmount(editor.root);
	});

	it("uses a compact segmented control for Live and History chat modes", async () => {
		const editor = await renderEditor();

		expect(
			editor.container.querySelector('[aria-label="Message display mode"]'),
		).toBeNull();
		await click(getButton(editor.container, "Chat"));

		expect(editor.container.textContent).not.toContain("Bubbles");
		expect(editor.container.textContent).not.toContain("Chat mode");
		const modeControl = getGroup(editor.container, "Chat display mode");
		expect(modeControl.getAttribute("data-state")).toBe("live");
		expect(getButton(modeControl, "Live").getAttribute("aria-pressed")).toBe(
			"true",
		);
		expect(getButton(modeControl, "History").getAttribute("aria-pressed")).toBe(
			"false",
		);
		await click(getButton(modeControl, "History"));

		expect(editor.onChatDisplayModeChange).toHaveBeenCalledWith("history");

		await unmount(editor.root);
	});

	it("switches from History back to Live through the segmented control", async () => {
		const editor = await renderEditor({ chatDisplayMode: "history" });
		await click(getButton(editor.container, "Chat"));

		const modeControl = getGroup(editor.container, "Chat display mode");
		expect(modeControl.getAttribute("data-state")).toBe("history");
		expect(getButton(modeControl, "History").getAttribute("aria-pressed")).toBe(
			"true",
		);
		await click(getButton(modeControl, "Live"));

		expect(editor.onChatDisplayModeChange).toHaveBeenCalledWith("live");

		await unmount(editor.root);
	});

	it("stores viewport fill as intent instead of a temporary message count", async () => {
		const editor = await renderEditor();
		await click(getButton(editor.container, "Chat"));
		const messages = getRange(editor.container, "Visible messages");

		await changeRange(messages, messages.max);
		expect(messages.getAttribute("aria-valuetext")).toMatch(/^Fill · \d+$/);
		await click(getButton(editor.container, "Apply"));

		expect(editor.onApply).toHaveBeenCalledWith(
			expect.objectContaining({
				chat: expect.objectContaining({ maxMessages: "fill" }),
			}),
		);

		await unmount(editor.root);
	});

	it("keeps the visible-message slider scale stable across chat positions", async () => {
		const createLayout = (y: number) => {
			const layout = getDefaultOverlayLayoutDefinition();
			layout.chat.position = { x: 0, y };
			layout.chat.textScale = "large";
			layout.chat.maxMessages = "fill";
			return layout;
		};
		const layoutContext: OverlayLayoutContext = {
			cameraCount: 4,
			reservedRects: [],
			viewport: {
				height: 720,
				safeInsets: { bottom: 56, left: 12, right: 12, top: 12 },
				width: 1280,
			},
		};
		const upperEditor = await renderEditor({
			appliedLayout: createLayout(4),
			layoutContext,
		});
		await click(getButton(upperEditor.container, "Chat"));
		const upperMax = getRange(upperEditor.container, "Visible messages").max;
		await unmount(upperEditor.root);

		const lowerEditor = await renderEditor({
			appliedLayout: createLayout(5),
			layoutContext,
		});
		await click(getButton(lowerEditor.container, "Chat"));
		const lowerMax = getRange(lowerEditor.container, "Visible messages").max;

		expect(lowerMax).toBe(upperMax);

		await unmount(lowerEditor.root);
	});

	it("reflows a dirty draft when the measured player viewport changes", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		const editor = await renderEditor({ appliedLayout });
		await changeRange(getRange(editor.container, "Camera size"), "3");
		const resizedContext: OverlayLayoutContext = {
			...measuredLayoutContext,
			viewport: { ...measuredLayoutContext.viewport, height: 720, width: 1280 },
		};

		await act(async () => {
			editor.root.render(
				<OverlayLayoutEditor
					appliedLayout={appliedLayout}
					chatDisplayMode="live"
					layoutContext={resizedContext}
					onApply={editor.onApply}
					onChatDisplayModeChange={editor.onChatDisplayModeChange}
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
		expect(getRange(editor.container, "Camera size").value).toBe("3");
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
		const cameraSize = getRange(editor.container, "Camera size");

		await changeRange(cameraSize, "3");

		expect(appliedLayout.video.sizeStep).toBe(1);
		expect(editor.onApply).not.toHaveBeenCalled();
		expect(getButton(editor.container, "Apply").disabled).toBe(false);

		await unmount(editor.root);
	});

	it("reverts a dirty draft to the current applied snapshot", async () => {
		const editor = await renderEditor();
		const cameraSize = getRange(editor.container, "Camera size");

		await changeRange(cameraSize, "3");
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

		await changeRange(getRange(editor.container, "Camera size"), "4");
		await click(getButton(editor.container, "Chat"));
		await changeRange(getRange(editor.container, "Chat width"), "6");
		await changeRange(getRange(editor.container, "Text scale"), "3");
		await changeRange(getRange(editor.container, "Text opacity"), "35");
		await changeRange(getRange(editor.container, "Visible messages"), "8");
		await click(getButton(editor.container, "Apply"));

		expect(editor.onApply).toHaveBeenCalledTimes(1);
		expect(editor.onApply).toHaveBeenCalledWith({
			video: { anchor: { x: 11, y: 6 }, leaderSide: "right", sizeStep: 4 },
			chat: {
				messageTransparency: 65,
				position: { x: 0, y: 4 },
				width: 6,
				textScale: "xlarge",
				maxMessages: 8,
			},
		});
		expect(getButton(editor.container, "Apply").disabled).toBe(true);
		expect(getButton(editor.container, "Revert").disabled).toBe(true);
		expect(editor.onPreviewChange).toHaveBeenLastCalledWith(null);

		await unmount(editor.root);
	});

	it("keeps the prior applied snapshot and dirty draft when Apply rejects", async () => {
		const onApply = vi.fn<(layout: OverlayLayoutDefinition) => Promise<void>>(
			() => Promise.reject(new Error("storage unavailable")),
		);
		const editor = await renderEditor({ onApply });
		const cameraSize = getRange(editor.container, "Camera size");

		await changeRange(cameraSize, "3");
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

		await changeRange(getRange(editor.container, "Camera size"), "3");
		const next = structuredClone(initial);
		next.video.sizeStep = 0;
		await act(async () => {
			editor.root.render(
				<OverlayLayoutEditor
					appliedLayout={next}
					chatDisplayMode="live"
					layoutContext={measuredLayoutContext}
					onApply={editor.onApply}
					onChatDisplayModeChange={editor.onChatDisplayModeChange}
					onPreviewChange={editor.onPreviewChange}
				/>,
			);
		});

		expect(getRange(editor.container, "Camera size").value).toBe("0");
		expect(getButton(editor.container, "Apply").disabled).toBe(true);

		await unmount(editor.root);
	});

	it("preserves a dirty draft when an equivalent appliedLayout object is received", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		const editor = await renderEditor({ appliedLayout });

		await changeRange(getRange(editor.container, "Camera size"), "3");
		await act(async () => {
			editor.root.render(
				<OverlayLayoutEditor
					appliedLayout={structuredClone(appliedLayout)}
					chatDisplayMode="live"
					layoutContext={measuredLayoutContext}
					onApply={editor.onApply}
					onChatDisplayModeChange={editor.onChatDisplayModeChange}
					onPreviewChange={editor.onPreviewChange}
				/>,
			);
		});

		expect(getRange(editor.container, "Camera size").value).toBe("3");
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

		await changeRange(getRange(editor.container, "Camera size"), "3");
		await click(getButton(editor.container, "Apply"));
		expect(getButton(editor.container, "Applying").disabled).toBe(true);

		await act(async () => {
			editor.root.render(
				<OverlayLayoutEditor
					appliedLayout={structuredClone(appliedLayout)}
					chatDisplayMode="live"
					layoutContext={measuredLayoutContext}
					onApply={editor.onApply}
					onChatDisplayModeChange={editor.onChatDisplayModeChange}
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

		await changeRange(getRange(first.container, "Camera size"), "3");
		await unmount(first.root);

		const second = await renderEditor({ appliedLayout });
		expect(getRange(second.container, "Camera size").value).toBe("1");
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

	it("starts chat dragging from its unobstructed preview position", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		appliedLayout.chat.position = { x: 0, y: 0 };
		const layoutContext: OverlayLayoutContext = {
			cameraCount: 4,
			reservedRects: [{ height: 160, width: 360, x: 0, y: 0 }],
			viewport: {
				height: 360,
				safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
				width: 640,
			},
		};
		const resolved = resolveOverlayLayout(appliedLayout, {
			...layoutContext,
			cameraCount: 4,
			reservedRects: [],
		});
		const resolvedGridX = resolved.chat.position.x;
		const resolvedGridY = resolved.chat.position.y;
		expect({ x: resolvedGridX, y: resolvedGridY }).toEqual(
			appliedLayout.chat.position,
		);

		const editor = await renderEditor({ appliedLayout, layoutContext });
		const preview = getPreview(editor.container);
		const chat = getChat(editor.container);
		mockPreviewBounds(preview);
		mockPointerCapture(chat);
		const grabX = resolved.chat.rect.x + 8;
		const grabY = resolved.chat.rect.y + 8;

		await pointer(chat, "pointerdown", {
			clientX: grabX,
			clientY: grabY,
			pointerId: 17,
		});
		await pointer(chat, "pointermove", {
			clientX: grabX + 640 / 12,
			clientY: grabY,
			pointerId: 17,
		});
		await pointer(chat, "pointerup", {
			clientX: grabX + 640 / 12,
			clientY: grabY,
			pointerId: 17,
		});
		await click(getButton(editor.container, "Apply"));

		expect(editor.onApply).toHaveBeenCalledWith(
			expect.objectContaining({
				chat: expect.objectContaining({
					position: {
						x: Math.min(7, resolvedGridX + 1),
						y: resolvedGridY,
					},
				}),
			}),
		);

		await unmount(editor.root);
	});

	it("moves a tall chat to the opposite edges in one drag from its far corner", async () => {
		const appliedLayout = getDefaultOverlayLayoutDefinition();
		appliedLayout.chat.position = { x: 0, y: 0 };
		appliedLayout.chat.width = 3;
		appliedLayout.chat.textScale = "large";
		appliedLayout.chat.maxMessages = 17;
		const editor = await renderEditor({ appliedLayout });
		const preview = getPreview(editor.container);
		const chat = getChat(editor.container);
		mockPreviewBounds(preview);
		mockPointerCapture(chat);

		await pointer(chat, "pointerdown", {
			clientX: 159,
			clientY: 212,
			pointerId: 18,
		});
		await pointer(chat, "pointermove", {
			clientX: 639,
			clientY: 359,
			pointerId: 18,
		});
		await pointer(chat, "pointerup", {
			clientX: 639,
			clientY: 359,
			pointerId: 18,
		});
		await click(getButton(editor.container, "Apply"));

		expect(editor.onApply).toHaveBeenCalledWith(
			expect.objectContaining({
				chat: expect.objectContaining({ position: { x: 9, y: 7 } }),
			}),
		);

		await unmount(editor.root);
	});

	it("maps pointer movement through the runtime safe rectangle", async () => {
		const safeContext: OverlayLayoutContext = {
			cameraCount: 4,
			reservedRects: [],
			viewport: {
				height: 360,
				safeInsets: { bottom: 72, left: 64, right: 64, top: 36 },
				width: 640,
			},
		};
		const appliedLayout = layoutAt({ x: 2, y: 2 });
		appliedLayout.chat.position = { x: 7, y: 7 };
		const editor = await renderEditor({
			appliedLayout,
			layoutContext: safeContext,
		});
		const preview = getPreview(editor.container);
		const leader = getLeader(editor.container);
		mockPreviewBounds(preview);
		mockPointerCapture(leader);

		expect(
			(editor.container.querySelector(".layout-grid-preview-v2") as HTMLElement)
				.style.left,
		).toBe("10%");
		await pointer(leader, "pointerdown", {
			clientX: 170.67,
			clientY: 114.75,
			pointerId: 15,
		});
		await pointer(leader, "pointermove", {
			clientX: 341.33,
			clientY: 146.25,
			pointerId: 15,
		});
		await pointer(leader, "pointerup", {
			clientX: 341.33,
			clientY: 146.25,
			pointerId: 15,
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

	it("keeps camera activation out of layout settings", async () => {
		const editor = await renderEditor();

		expect(editor.container.textContent).not.toContain("Camera off");
		expect(
			editor.container.querySelector('[aria-label="Turn camera on"]'),
		).toBeNull();

		await unmount(editor.root);
	});
});

async function renderEditor({
	appliedLayout = getDefaultOverlayLayoutDefinition(),
	onApply = vi.fn<(layout: OverlayLayoutDefinition) => Promise<void>>(() =>
		Promise.resolve(),
	),
	onChatDisplayModeChange = vi.fn<(mode: "live" | "history") => void>(),
	onPreviewChange = vi.fn<(layout: OverlayLayoutDefinition | null) => void>(),
	chatDisplayMode = "live",
	layoutContext = measuredLayoutContext,
}: Partial<{
	appliedLayout: OverlayLayoutDefinition;
	onApply: ReturnType<
		typeof vi.fn<(layout: OverlayLayoutDefinition) => Promise<void>>
	>;
	onChatDisplayModeChange: ReturnType<
		typeof vi.fn<(mode: "live" | "history") => void>
	>;
	onPreviewChange: ReturnType<
		typeof vi.fn<(layout: OverlayLayoutDefinition | null) => void>
	>;
	layoutContext: OverlayLayoutContext;
	chatDisplayMode: "live" | "history";
}> = {}): Promise<RenderedEditor> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);

	await act(async () => {
		root.render(
			<OverlayLayoutEditor
				appliedLayout={appliedLayout}
				chatDisplayMode={chatDisplayMode}
				layoutContext={layoutContext}
				onApply={onApply}
				onChatDisplayModeChange={onChatDisplayModeChange}
				onPreviewChange={onPreviewChange}
			/>,
		);
	});

	return {
		container,
		onApply,
		onChatDisplayModeChange,
		onPreviewChange,
		root,
	};
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

function getGroup(container: HTMLElement, name: string): HTMLElement {
	const group = container.querySelector(`[role="group"][aria-label="${name}"]`);
	if (!(group instanceof HTMLElement)) {
		throw new Error(`Group not found: ${name}`);
	}
	return group;
}

function getRange(container: HTMLElement, label: string): HTMLInputElement {
	const range = container.querySelector(
		`input[type="range"][aria-label="${label}"]`,
	);
	if (!(range instanceof HTMLInputElement)) {
		throw new Error(`Range not found: ${label}`);
	}
	return range;
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

function getChat(container: HTMLElement): HTMLElement {
	const chat = container.querySelector('[data-layout-object="chat"]');
	if (!(chat instanceof HTMLElement)) {
		throw new Error("Chat preview not found");
	}
	return chat;
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

async function changeRange(range: HTMLInputElement, value: string) {
	await act(async () => {
		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		valueSetter?.call(range, value);
		range.dispatchEvent(new Event("input", { bubbles: true }));
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
