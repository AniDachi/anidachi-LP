import { Check, MessageCircle, RotateCcw, Video } from "lucide-react";
import {
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { GHOST_CAM_SIZE_STEPS } from "./ghost-cam-size";
import { OverlayLayoutChatPreview } from "./overlay-layout-chat-preview";
import {
	type OverlayLayoutContext,
	type PixelRect,
	resolveOverlayLayout,
	resolveOverlayLayoutSafeRect,
} from "./overlay-layout-engine";
import {
	cloneOverlayLayoutDefinition,
	getOverlayLayoutDragOffsetFromOrigin,
	getOverlayLayoutGridPointer,
	moveOverlayLayoutObjectByDelta,
	moveOverlayLayoutObjectFromPointer,
	type OverlayLayoutDragOffset,
	type OverlayLayoutObjectIdV2,
	overlayLayoutDefinitionsEqual,
} from "./overlay-layout-interaction";
import {
	normalizeOverlayLayoutDefinition,
	OVERLAY_LAYOUT_GRID_COLUMNS,
	OVERLAY_LAYOUT_GRID_ROWS,
	OVERLAY_LAYOUT_MAX_CHAT_TRANSPARENCY,
	OVERLAY_LAYOUT_MAX_CHAT_WIDTH,
	OVERLAY_LAYOUT_MIN_CHAT_TRANSPARENCY,
	OVERLAY_LAYOUT_MIN_CHAT_WIDTH,
	OVERLAY_LAYOUT_MIN_MESSAGES,
	type OverlayLayoutCameraSizeStep,
	type OverlayLayoutDefinition,
	type OverlayLayoutMessageCount,
	type OverlayLayoutTextScale,
} from "./overlay-layout-model";
import { SteppedSettingSlider } from "./stepped-setting-slider";

export interface OverlayLayoutEditorProps {
	appliedLayout: OverlayLayoutDefinition;
	chatDisplayMode: OverlayLayoutChatDisplayMode;
	layoutContext: OverlayLayoutContext;
	onChatDisplayModeChange: (mode: OverlayLayoutChatDisplayMode) => void;
	onApply: (layout: OverlayLayoutDefinition) => Promise<void>;
	onPreviewChange: (layout: OverlayLayoutDefinition | null) => void;
}

export type OverlayLayoutChatDisplayMode = "live" | "history";

interface PointerSession {
	chatPointerSteps: { x: number; y: number } | null;
	objectId: OverlayLayoutObjectIdV2;
	offset: OverlayLayoutDragOffset;
	pointerBounds: ReturnType<typeof getPreviewGridPointerBounds>;
	pointerId: number;
	snapshot: OverlayLayoutDefinition;
}

interface KeyboardSession {
	objectId: OverlayLayoutObjectIdV2;
	snapshot: OverlayLayoutDefinition;
}

const PREVIEW_SAFE_PADDING = 12;
const FALLBACK_PREVIEW_WIDTH = 640;
const FALLBACK_PREVIEW_HEIGHT = 360;
const FALLBACK_PREVIEW_CONTEXT: OverlayLayoutContext = {
	cameraCount: 4 as const,
	reservedRects: [],
	viewport: {
		height: FALLBACK_PREVIEW_HEIGHT,
		safeInsets: {
			bottom: PREVIEW_SAFE_PADDING,
			left: PREVIEW_SAFE_PADDING,
			right: PREVIEW_SAFE_PADDING,
			top: PREVIEW_SAFE_PADDING,
		},
		width: FALLBACK_PREVIEW_WIDTH,
	},
};
const CHAT_TEXT_SCALE_OPTIONS: ReadonlyArray<{
	label: string;
	value: OverlayLayoutTextScale;
}> = [
	{ label: "Small", value: "compact" },
	{ label: "Medium", value: "normal" },
	{ label: "Large", value: "large" },
	{ label: "XL", value: "xlarge" },
];

function formatChatWidth(width: number): string {
	return width === 1 ? "1 column" : `${width} columns`;
}

export function OverlayLayoutEditor({
	appliedLayout,
	chatDisplayMode,
	layoutContext,
	onChatDisplayModeChange,
	onApply,
	onPreviewChange,
}: OverlayLayoutEditorProps) {
	const [initialAppliedLayout] = useState<OverlayLayoutDefinition>(() =>
		normalizeOverlayLayoutDefinition(appliedLayout),
	);
	const [appliedSnapshot, setAppliedSnapshot] =
		useState<OverlayLayoutDefinition>(() =>
			cloneOverlayLayoutDefinition(initialAppliedLayout),
		);
	const [draft, setDraft] = useState<OverlayLayoutDefinition>(() =>
		cloneOverlayLayoutDefinition(initialAppliedLayout),
	);
	const [selectedObject, setSelectedObject] =
		useState<OverlayLayoutObjectIdV2>("video");
	const [saving, setSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const appliedSnapshotRef = useRef(appliedSnapshot);
	const draftRef = useRef(draft);
	const pointerSessionRef = useRef<PointerSession | null>(null);
	const keyboardSessionRef = useRef<KeyboardSession | null>(null);
	const previewRef = useRef<HTMLDivElement | null>(null);
	const applyGenerationRef = useRef(0);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			applyGenerationRef.current += 1;
		};
	}, []);

	useEffect(() => {
		onPreviewChange(cloneOverlayLayoutDefinition(draftRef.current));
		return () => {
			onPreviewChange(null);
		};
	}, [onPreviewChange]);

	useEffect(() => {
		const nextApplied = normalizeOverlayLayoutDefinition(appliedLayout);
		if (
			overlayLayoutDefinitionsEqual(nextApplied, appliedSnapshotRef.current)
		) {
			return;
		}
		const nextDraft = cloneOverlayLayoutDefinition(nextApplied);
		appliedSnapshotRef.current = nextApplied;
		draftRef.current = nextDraft;
		pointerSessionRef.current = null;
		keyboardSessionRef.current = null;
		applyGenerationRef.current += 1;
		setAppliedSnapshot(nextApplied);
		setDraft(nextDraft);
		onPreviewChange(cloneOverlayLayoutDefinition(nextDraft));
		setErrorMessage(null);
		setSaving(false);
	}, [appliedLayout, onPreviewChange]);

	const previewContext = useMemo(
		() => createPreviewContext(layoutContext),
		[layoutContext],
	);
	const resolvedLayout = useMemo(
		() => resolveOverlayLayout(draft, previewContext),
		[draft, previewContext],
	);
	const fillMessageCapacity = useMemo(
		() =>
			resolveOverlayLayout(
				{
					...draft,
					chat: { ...draft.chat, maxMessages: "fill" },
				},
				previewContext,
			).chat.effectiveMaxMessages,
		[draft, previewContext],
	);
	const messageSliderCapacity = useMemo(
		() =>
			resolveOverlayLayout(
				{
					...draft,
					chat: {
						...draft.chat,
						maxMessages: "fill",
						position: { x: 0, y: 0 },
					},
				},
				{
					...previewContext,
					cameraCount: 0,
					reservedRects: [],
				},
			).chat.effectiveMaxMessages,
		[draft, previewContext],
	);
	const manualMessageCount =
		typeof draft.chat.maxMessages === "number"
			? draft.chat.maxMessages
			: messageSliderCapacity;
	const messageSliderManualMax = Math.max(
		OVERLAY_LAYOUT_MIN_MESSAGES,
		messageSliderCapacity,
		manualMessageCount,
	);
	const messageSliderMax = messageSliderManualMax + 1;
	const messageSliderValue =
		draft.chat.maxMessages === "fill"
			? messageSliderMax
			: draft.chat.maxMessages;
	const textScaleIndex = CHAT_TEXT_SCALE_OPTIONS.findIndex(
		(option) => option.value === draft.chat.textScale,
	);
	const previewWidth = previewContext.viewport.width;
	const previewHeight = previewContext.viewport.height;
	const previewSafeRect = useMemo(
		() => resolveOverlayLayoutSafeRect(previewContext.viewport),
		[previewContext],
	);
	const clean = overlayLayoutDefinitionsEqual(draft, appliedSnapshot);

	const replaceDraft = (
		nextDraft: OverlayLayoutDefinition,
		clearError = true,
	) => {
		const defensiveDraft = cloneOverlayLayoutDefinition(nextDraft);
		draftRef.current = defensiveDraft;
		setDraft(defensiveDraft);
		onPreviewChange(cloneOverlayLayoutDefinition(defensiveDraft));
		if (clearError) {
			setErrorMessage(null);
		}
	};

	const updateDraft = (
		updater: (current: OverlayLayoutDefinition) => OverlayLayoutDefinition,
	) => {
		replaceDraft(normalizeOverlayLayoutDefinition(updater(draftRef.current)));
	};

	const handlePointerDown = (
		objectId: OverlayLayoutObjectIdV2,
		event: PointerEvent<HTMLElement>,
	) => {
		if (
			saving ||
			!event.isPrimary ||
			event.button !== 0 ||
			previewRef.current === null ||
			pointerSessionRef.current !== null
		) {
			return;
		}

		event.preventDefault();
		const pointerBounds = getPreviewGridPointerBounds(
			previewRef.current,
			previewSafeRect,
			previewWidth,
			previewHeight,
		);
		const chatPointerSteps =
			objectId === "chat"
				? getChatPointerSteps(
						pointerBounds,
						previewSafeRect,
						resolvedLayout.chat.rect,
					)
				: null;
		const pointer = getObjectDragPointer(
			objectId,
			event.clientX,
			event.clientY,
			pointerBounds,
			chatPointerSteps,
		);
		pointerSessionRef.current = {
			chatPointerSteps,
			objectId,
			offset: getOverlayLayoutDragOffsetFromOrigin(
				pointer,
				getResolvedObjectGridOrigin(objectId, resolvedLayout),
			),
			pointerBounds,
			pointerId: event.pointerId,
			snapshot: cloneOverlayLayoutDefinition(draftRef.current),
		};
		keyboardSessionRef.current = null;
		setSelectedObject(objectId);
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};

	const handlePointerMove = (
		objectId: OverlayLayoutObjectIdV2,
		event: PointerEvent<HTMLElement>,
	) => {
		const session = pointerSessionRef.current;
		if (
			session === null ||
			session.pointerId !== event.pointerId ||
			session.objectId !== objectId ||
			previewRef.current === null
		) {
			return;
		}

		event.preventDefault();
		const pointer = getObjectDragPointer(
			objectId,
			event.clientX,
			event.clientY,
			session.pointerBounds,
			session.chatPointerSteps,
		);
		replaceDraft(
			moveOverlayLayoutObjectFromPointer(
				draftRef.current,
				objectId,
				pointer,
				session.offset,
			),
		);
	};

	const finishPointerSession = (
		objectId: OverlayLayoutObjectIdV2,
		event: PointerEvent<HTMLElement>,
		rollback: boolean,
		releaseCapture: boolean,
	) => {
		const session = pointerSessionRef.current;
		if (
			session === null ||
			session.pointerId !== event.pointerId ||
			session.objectId !== objectId
		) {
			return;
		}

		pointerSessionRef.current = null;
		if (rollback) {
			replaceDraft(session.snapshot);
		}
		if (
			releaseCapture &&
			typeof event.currentTarget.releasePointerCapture === "function" &&
			(typeof event.currentTarget.hasPointerCapture !== "function" ||
				event.currentTarget.hasPointerCapture(event.pointerId))
		) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	};

	const handleKeyDown = (
		objectId: OverlayLayoutObjectIdV2,
		event: KeyboardEvent<HTMLElement>,
	) => {
		if (event.key === "Escape") {
			const pointerSession = pointerSessionRef.current;
			if (pointerSession?.objectId === objectId) {
				event.preventDefault();
				pointerSessionRef.current = null;
				if (
					typeof event.currentTarget.releasePointerCapture === "function" &&
					(typeof event.currentTarget.hasPointerCapture !== "function" ||
						event.currentTarget.hasPointerCapture(pointerSession.pointerId))
				) {
					event.currentTarget.releasePointerCapture(pointerSession.pointerId);
				}
				replaceDraft(pointerSession.snapshot);
				return;
			}

			const session = keyboardSessionRef.current;
			if (session?.objectId === objectId) {
				event.preventDefault();
				keyboardSessionRef.current = null;
				replaceDraft(session.snapshot);
			}
			return;
		}

		const delta = getArrowDelta(event.key);
		if (saving || delta === null) {
			return;
		}

		event.preventDefault();
		if (keyboardSessionRef.current?.objectId !== objectId) {
			keyboardSessionRef.current = {
				objectId,
				snapshot: cloneOverlayLayoutDefinition(draftRef.current),
			};
		}
		setSelectedObject(objectId);
		replaceDraft(
			moveOverlayLayoutObjectByDelta(
				draftRef.current,
				objectId,
				delta.x,
				delta.y,
			),
		);
	};

	const handleBlur = (objectId: OverlayLayoutObjectIdV2) => {
		if (keyboardSessionRef.current?.objectId === objectId) {
			keyboardSessionRef.current = null;
		}
	};

	const handleRevert = () => {
		if (saving || clean) {
			return;
		}
		pointerSessionRef.current = null;
		keyboardSessionRef.current = null;
		replaceDraft(appliedSnapshotRef.current);
	};

	const handleApply = async () => {
		if (
			saving ||
			overlayLayoutDefinitionsEqual(
				draftRef.current,
				appliedSnapshotRef.current,
			)
		) {
			return;
		}

		const normalizedDraft = normalizeOverlayLayoutDefinition(draftRef.current);
		const payload = cloneOverlayLayoutDefinition(normalizedDraft);
		const applyGeneration = applyGenerationRef.current + 1;
		applyGenerationRef.current = applyGeneration;
		pointerSessionRef.current = null;
		keyboardSessionRef.current = null;
		setErrorMessage(null);
		setSaving(true);

		try {
			await onApply(payload);
			if (
				!mountedRef.current ||
				applyGenerationRef.current !== applyGeneration
			) {
				return;
			}
			const nextApplied = cloneOverlayLayoutDefinition(normalizedDraft);
			appliedSnapshotRef.current = nextApplied;
			draftRef.current = cloneOverlayLayoutDefinition(nextApplied);
			setAppliedSnapshot(nextApplied);
			setDraft(draftRef.current);
			onPreviewChange(null);
		} catch {
			if (
				mountedRef.current &&
				applyGenerationRef.current === applyGeneration
			) {
				setErrorMessage("Layout could not be saved.");
			}
		} finally {
			if (
				mountedRef.current &&
				applyGenerationRef.current === applyGeneration
			) {
				setSaving(false);
			}
		}
	};

	const handleCameraSizeChange = (sizeStep: number) => {
		updateDraft((current) => ({
			...current,
			video: {
				...current.video,
				sizeStep: sizeStep as OverlayLayoutCameraSizeStep,
			},
		}));
	};

	const handleChatWidthChange = (width: number) => {
		updateDraft((current) => ({
			...current,
			chat: { ...current.chat, width },
		}));
	};

	const handleTextScaleChange = (index: number) => {
		const textScale =
			CHAT_TEXT_SCALE_OPTIONS[index]?.value ??
			CHAT_TEXT_SCALE_OPTIONS[1]?.value ??
			"normal";
		updateDraft((current) => ({
			...current,
			chat: { ...current.chat, textScale },
		}));
	};

	const handleTextOpacityChange = (textOpacity: number) => {
		updateDraft((current) => ({
			...current,
			chat: { ...current.chat, messageTransparency: 100 - textOpacity },
		}));
	};

	const handleMessageCountChange = (value: number) => {
		const maxMessages: OverlayLayoutMessageCount =
			value === messageSliderMax ? "fill" : value;
		updateDraft((current) => ({
			...current,
			chat: { ...current.chat, maxMessages },
		}));
	};

	return (
		<section className="layout-editor-v2" aria-label="Overlay layout editor">
			<p className="sr-only" id="anidachi-layout-editor-instructions">
				Select a layout object, then use arrow keys to move it one grid cell.
				Press Escape to restore the position from the start of the current move.
			</p>
			<div
				aria-describedby="anidachi-layout-editor-instructions"
				aria-label="Overlay layout preview"
				role="group"
				ref={previewRef}
				className="layout-preview-v2"
				style={{
					aspectRatio: `${previewWidth} / ${previewHeight}`,
					overflow: "hidden",
					position: "relative",
					width: "100%",
				}}
			>
				<div
					aria-hidden="true"
					className="layout-grid-preview-v2"
					style={{
						...getPercentageRectStyle(
							previewSafeRect,
							previewWidth,
							previewHeight,
						),
						position: "absolute",
					}}
				/>
				{resolvedLayout.video.slots.map((slot, index) => {
					const isLeader = index === 0;
					const style = getPercentageRectStyle(
						slot,
						previewWidth,
						previewHeight,
					);
					if (!isLeader) {
						return (
							<div
								key={`video-ghost-${index}`}
								aria-hidden="true"
								className="layout-video-slot-v2 is-ghost"
								data-layout-video-slot="ghost"
								style={{
									...style,
									pointerEvents: "none",
									position: "absolute",
								}}
							/>
						);
					}

					return (
						<button
							key="video-leader"
							type="button"
							aria-label="Move video"
							aria-describedby="anidachi-layout-editor-instructions"
							aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Escape"
							aria-pressed={selectedObject === "video"}
							className="layout-video-slot-v2 is-leader"
							data-layout-object="video"
							data-layout-video-slot="leader"
							data-selected={selectedObject === "video" ? "true" : "false"}
							disabled={saving}
							onBlur={() => handleBlur("video")}
							onKeyDown={(event) => handleKeyDown("video", event)}
							onClick={() => setSelectedObject("video")}
							onLostPointerCapture={(event) =>
								finishPointerSession("video", event, true, false)
							}
							onPointerCancel={(event) =>
								finishPointerSession("video", event, true, true)
							}
							onPointerDown={(event) => handlePointerDown("video", event)}
							onPointerMove={(event) => handlePointerMove("video", event)}
							onPointerUp={(event) =>
								finishPointerSession("video", event, false, true)
							}
							style={{ ...style, position: "absolute", touchAction: "none" }}
							tabIndex={0}
						/>
					);
				})}

				<button
					type="button"
					aria-label="Move chat"
					aria-describedby="anidachi-layout-editor-instructions"
					aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Escape"
					aria-pressed={selectedObject === "chat"}
					className="layout-chat-preview-v2"
					data-layout-object="chat"
					data-selected={selectedObject === "chat" ? "true" : "false"}
					disabled={saving}
					onBlur={() => handleBlur("chat")}
					onKeyDown={(event) => handleKeyDown("chat", event)}
					onClick={() => setSelectedObject("chat")}
					onLostPointerCapture={(event) =>
						finishPointerSession("chat", event, true, false)
					}
					onPointerCancel={(event) =>
						finishPointerSession("chat", event, true, true)
					}
					onPointerDown={(event) => handlePointerDown("chat", event)}
					onPointerMove={(event) => handlePointerMove("chat", event)}
					onPointerUp={(event) =>
						finishPointerSession("chat", event, false, true)
					}
					style={
						{
							...getPercentageRectStyle(
								resolvedLayout.chat.rect,
								previewWidth,
								previewHeight,
							),
							fontSize: `${(resolvedLayout.chat.fontSizePx / previewWidth) * 100}cqw`,
							lineHeight: `${(resolvedLayout.chat.lineHeightPx / previewWidth) * 100}cqw`,
							"--layout-preview-chat-gap": `${(5 / previewWidth) * 100}cqw`,
							"--layout-preview-chat-name-font-size": `${(10 / previewWidth) * 100}cqw`,
							"--layout-preview-chat-padding-x": `${(10 / previewWidth) * 100}cqw`,
							"--layout-preview-chat-padding-y": `${(8 / previewWidth) * 100}cqw`,
							"--live-chat-message-opacity": `${1 - resolvedLayout.chat.messageTransparency / 100}`,
							overflow: "hidden",
							position: "absolute",
							touchAction: "none",
						} as CSSProperties
					}
					tabIndex={0}
				>
					<OverlayLayoutChatPreview
						messageCount={resolvedLayout.chat.effectiveMaxMessages}
					/>
				</button>
			</div>

			<div
				className="layout-object-selector-v2"
				aria-label="Layout object"
				role="group"
			>
				<button
					type="button"
					aria-pressed={selectedObject === "video"}
					disabled={saving}
					onClick={() => setSelectedObject("video")}
				>
					<Video aria-hidden="true" size={15} strokeWidth={2.2} />
					Video
				</button>
				<button
					type="button"
					aria-pressed={selectedObject === "chat"}
					disabled={saving}
					onClick={() => setSelectedObject("chat")}
				>
					<MessageCircle aria-hidden="true" size={15} strokeWidth={2.2} />
					Chat
				</button>
			</div>

			{selectedObject === "video" ? (
				<div className="layout-controls-v2" data-layout-controls="video">
					<SteppedSettingSlider
						disabled={saving}
						endLabel={GHOST_CAM_SIZE_STEPS.at(-1)?.label ?? "XL"}
						label="Camera size"
						max={GHOST_CAM_SIZE_STEPS.length - 1}
						min={0}
						onValueChange={handleCameraSizeChange}
						startLabel={GHOST_CAM_SIZE_STEPS[0]?.label ?? "Small"}
						value={draft.video.sizeStep}
						valueLabel={
							GHOST_CAM_SIZE_STEPS[draft.video.sizeStep]?.label ?? "Medium"
						}
					/>
				</div>
			) : (
				<div className="layout-controls-v2" data-layout-controls="chat">
					<div
						aria-label="Chat display mode"
						className="layout-chat-mode-segmented-v2"
						data-state={chatDisplayMode}
						role="group"
					>
						<button
							aria-pressed={chatDisplayMode === "live"}
							disabled={saving}
							onClick={() => onChatDisplayModeChange("live")}
							type="button"
						>
							Live
						</button>
						<button
							aria-pressed={chatDisplayMode === "history"}
							disabled={saving}
							onClick={() => onChatDisplayModeChange("history")}
							type="button"
						>
							History
						</button>
					</div>
					<SteppedSettingSlider
						disabled={saving}
						endLabel="Wide"
						label="Chat width"
						max={OVERLAY_LAYOUT_MAX_CHAT_WIDTH}
						min={OVERLAY_LAYOUT_MIN_CHAT_WIDTH}
						onValueChange={handleChatWidthChange}
						startLabel="Narrow"
						value={draft.chat.width}
						valueLabel={formatChatWidth(draft.chat.width)}
					/>
					<SteppedSettingSlider
						disabled={saving}
						endLabel={CHAT_TEXT_SCALE_OPTIONS.at(-1)?.label ?? "XL"}
						label="Text scale"
						max={CHAT_TEXT_SCALE_OPTIONS.length - 1}
						min={0}
						onValueChange={handleTextScaleChange}
						startLabel={CHAT_TEXT_SCALE_OPTIONS[0]?.label ?? "Small"}
						value={Math.max(0, textScaleIndex)}
						valueLabel={
							CHAT_TEXT_SCALE_OPTIONS[textScaleIndex]?.label ?? "Medium"
						}
					/>
					<SteppedSettingSlider
						ariaValueText={
							draft.chat.maxMessages === "fill"
								? `Fill · ${fillMessageCapacity}`
								: `${draft.chat.maxMessages} messages`
						}
						disabled={saving}
						endLabel="Fill"
						label="Visible messages"
						max={messageSliderMax}
						min={OVERLAY_LAYOUT_MIN_MESSAGES}
						onValueChange={handleMessageCountChange}
						startLabel={`${OVERLAY_LAYOUT_MIN_MESSAGES}`}
						value={messageSliderValue}
						valueLabel={
							draft.chat.maxMessages === "fill"
								? `Fill · ${fillMessageCapacity}`
								: `${draft.chat.maxMessages}`
						}
					/>
					<SteppedSettingSlider
						disabled={saving}
						endLabel="100%"
						label="Text opacity"
						max={100 - OVERLAY_LAYOUT_MIN_CHAT_TRANSPARENCY}
						min={100 - OVERLAY_LAYOUT_MAX_CHAT_TRANSPARENCY}
						onValueChange={handleTextOpacityChange}
						startLabel="5%"
						step={5}
						value={100 - draft.chat.messageTransparency}
						valueLabel={`${100 - draft.chat.messageTransparency}%`}
					/>
				</div>
			)}

			<div className="layout-editor-actions-v2">
				<button type="button" disabled={saving || clean} onClick={handleRevert}>
					<RotateCcw aria-hidden="true" size={15} strokeWidth={2.2} />
					Revert
				</button>
				<button
					type="button"
					disabled={saving || clean}
					onClick={() => void handleApply()}
				>
					<Check aria-hidden="true" size={16} strokeWidth={2.4} />
					{saving ? "Applying" : "Apply"}
				</button>
			</div>
			{errorMessage !== null ? <p role="status">{errorMessage}</p> : null}
		</section>
	);
}

function getPercentageRectStyle(
	rect: PixelRect,
	viewportWidth: number,
	viewportHeight: number,
): CSSProperties {
	return {
		height: `${(rect.height / viewportHeight) * 100}%`,
		left: `${(rect.x / viewportWidth) * 100}%`,
		top: `${(rect.y / viewportHeight) * 100}%`,
		width: `${(rect.width / viewportWidth) * 100}%`,
	};
}

function createPreviewContext(
	layoutContext: OverlayLayoutContext,
): OverlayLayoutContext {
	const width = finitePositive(layoutContext.viewport.width);
	const height = finitePositive(layoutContext.viewport.height);
	if (width === null || height === null) {
		return FALLBACK_PREVIEW_CONTEXT;
	}

	return {
		cameraCount: 4,
		reservedRects: [],
		viewport: {
			height,
			safeInsets: { ...layoutContext.viewport.safeInsets },
			width,
		},
	};
}

function finitePositive(value: number): number | null {
	return Number.isFinite(value) && value > 0 ? value : null;
}

function getPreviewGridPointerBounds(
	preview: HTMLElement,
	safeRect: PixelRect,
	viewportWidth: number,
	viewportHeight: number,
) {
	const bounds = preview.getBoundingClientRect();
	const contentWidth =
		preview.clientWidth > 0 ? preview.clientWidth : bounds.width;
	const contentHeight =
		preview.clientHeight > 0 ? preview.clientHeight : bounds.height;
	const scaleX = contentWidth / viewportWidth;
	const scaleY = contentHeight / viewportHeight;

	return {
		height: safeRect.height * scaleY,
		left: bounds.left + preview.clientLeft + safeRect.x * scaleX,
		top: bounds.top + preview.clientTop + safeRect.y * scaleY,
		width: safeRect.width * scaleX,
	};
}

function getChatPointerSteps(
	pointerBounds: ReturnType<typeof getPreviewGridPointerBounds>,
	safeRect: PixelRect,
	chatRect: PixelRect,
) {
	const verticalTravel = Math.max(0, safeRect.height - chatRect.height);
	const verticalTravelRatio =
		safeRect.height > 0 ? verticalTravel / safeRect.height : 0;

	return {
		x: pointerBounds.width / OVERLAY_LAYOUT_GRID_COLUMNS,
		y:
			(pointerBounds.height * verticalTravelRatio) /
			Math.max(1, OVERLAY_LAYOUT_GRID_ROWS - 1),
	};
}

function getObjectDragPointer(
	objectId: OverlayLayoutObjectIdV2,
	clientX: number,
	clientY: number,
	pointerBounds: ReturnType<typeof getPreviewGridPointerBounds>,
	chatPointerSteps: { x: number; y: number } | null,
) {
	if (objectId === "video" || chatPointerSteps === null) {
		return getOverlayLayoutGridPointer(clientX, clientY, pointerBounds);
	}

	return {
		x: getUnboundedPointerCoordinate(
			clientX,
			pointerBounds.left,
			chatPointerSteps.x,
		),
		y: getUnboundedPointerCoordinate(
			clientY,
			pointerBounds.top,
			chatPointerSteps.y,
		),
	};
}

function getUnboundedPointerCoordinate(
	clientCoordinate: number,
	origin: number,
	stepSize: number,
) {
	if (
		!Number.isFinite(clientCoordinate) ||
		!Number.isFinite(origin) ||
		!Number.isFinite(stepSize) ||
		stepSize <= 0
	) {
		return 0;
	}

	return (clientCoordinate - origin) / stepSize;
}

function getArrowDelta(key: string): { x: number; y: number } | null {
	switch (key) {
		case "ArrowLeft":
			return { x: -1, y: 0 };
		case "ArrowRight":
			return { x: 1, y: 0 };
		case "ArrowUp":
			return { x: 0, y: -1 };
		case "ArrowDown":
			return { x: 0, y: 1 };
		default:
			return null;
	}
}

function getResolvedObjectGridOrigin(
	objectId: OverlayLayoutObjectIdV2,
	resolvedLayout: ReturnType<typeof resolveOverlayLayout>,
): { x: number; y: number } {
	if (objectId === "chat") {
		return resolvedLayout.chat.position;
	}

	return {
		x: resolvedLayout.video.anchor.x + 0.5,
		y: resolvedLayout.video.anchor.y + 0.5,
	};
}
