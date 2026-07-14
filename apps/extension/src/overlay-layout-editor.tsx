import {
	type ChangeEvent,
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { GHOST_CAM_SIZE_STEPS } from "./ghost-cam-size";
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
	type OverlayLayoutCameraSizeStep,
	type OverlayLayoutDefinition,
	type OverlayLayoutMessageCount,
	type OverlayLayoutTextScale,
} from "./overlay-layout-model";

export interface OverlayLayoutEditorProps {
	appliedLayout: OverlayLayoutDefinition;
	cameraEnabled: boolean;
	cameraStatus: string;
	layoutContext: OverlayLayoutContext;
	onCameraToggle: () => void;
	onApply: (layout: OverlayLayoutDefinition) => Promise<void>;
	onPreviewChange: (layout: OverlayLayoutDefinition | null) => void;
}

interface PointerSession {
	objectId: OverlayLayoutObjectIdV2;
	offset: OverlayLayoutDragOffset;
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
	reservedRects: [
		{
			height: 56,
			width: 144,
			x: FALLBACK_PREVIEW_WIDTH - PREVIEW_SAFE_PADDING - 144,
			y: PREVIEW_SAFE_PADDING,
		},
	],
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
const CHAT_WIDTH_OPTIONS = [3, 4, 5, 6] as const;
const CHAT_TEXT_SCALE_OPTIONS: ReadonlyArray<{
	label: string;
	value: OverlayLayoutTextScale;
}> = [
	{ label: "Compact", value: "compact" },
	{ label: "Normal", value: "normal" },
	{ label: "Large", value: "large" },
];
const CHAT_MESSAGE_OPTIONS: readonly OverlayLayoutMessageCount[] = [3, 5, 8];
const CHAT_GHOST_WIDTHS = [72, 48, 84, 61, 76, 43, 68, 55];

export function OverlayLayoutEditor({
	appliedLayout,
	cameraEnabled,
	cameraStatus,
	layoutContext,
	onCameraToggle,
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

		const pointer = getOverlayLayoutGridPointer(
			event.clientX,
			event.clientY,
			getPreviewGridPointerBounds(
				previewRef.current,
				previewSafeRect,
				previewWidth,
				previewHeight,
			),
		);
		pointerSessionRef.current = {
			objectId,
			offset: getOverlayLayoutDragOffsetFromOrigin(
				pointer,
				getResolvedObjectGridOrigin(
					objectId,
					resolvedLayout,
				),
			),
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
		const pointer = getOverlayLayoutGridPointer(
			event.clientX,
			event.clientY,
			getPreviewGridPointerBounds(
				previewRef.current,
				previewSafeRect,
				previewWidth,
				previewHeight,
			),
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

	const handleCameraSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const sizeStep = Number(event.target.value) as OverlayLayoutCameraSizeStep;
		updateDraft((current) => ({
			...current,
			video: { ...current.video, sizeStep },
		}));
	};

	const handleChatWidthChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const width = Number(event.target.value);
		updateDraft((current) => ({
			...current,
			chat: { ...current.chat, width },
		}));
	};

	const handleTextScaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const textScale = event.target.value as OverlayLayoutTextScale;
		updateDraft((current) => ({
			...current,
			chat: { ...current.chat, textScale },
		}));
	};

	const handleMessageCountChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const maxMessages = Number(event.target.value) as OverlayLayoutMessageCount;
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
				{previewContext.reservedRects.map((rect, index) => (
					<div
						key={`reserved-${index}`}
						aria-hidden="true"
						className="layout-reserved-preview-v2"
						style={{
							...getPercentageRectStyle(rect, previewWidth, previewHeight),
							position: "absolute",
						}}
					/>
				))}
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
					style={{
						...getPercentageRectStyle(
							resolvedLayout.chat.rect,
							previewWidth,
							previewHeight,
						),
						fontSize: `${(resolvedLayout.chat.fontSizePx / previewWidth) * 100}cqw`,
						lineHeight: `${(resolvedLayout.chat.lineHeightPx / previewWidth) * 100}cqw`,
						overflow: "hidden",
						position: "absolute",
						touchAction: "none",
					}}
					tabIndex={0}
				>
					{Array.from(
						{ length: resolvedLayout.chat.effectiveMaxMessages },
						(_, index) => (
							<span
								key={`chat-ghost-${index}`}
								aria-hidden="true"
								className="layout-chat-ghost-v2"
								data-layout-chat-ghost=""
								style={{
									width: `${CHAT_GHOST_WIDTHS[index % CHAT_GHOST_WIDTHS.length]}%`,
								}}
							/>
						),
					)}
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
					Video
				</button>
				<button
					type="button"
					aria-pressed={selectedObject === "chat"}
					disabled={saving}
					onClick={() => setSelectedObject("chat")}
				>
					Chat
				</button>
			</div>

			{selectedObject === "video" ? (
				<div className="layout-controls-v2" data-layout-controls="video">
					<button
						type="button"
						aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
						disabled={saving}
						onClick={onCameraToggle}
					>
						{cameraEnabled ? "Turn camera off" : "Turn camera on"}
					</button>
					<span className="layout-camera-status-v2">{cameraStatus}</span>
					<label>
						<span>Camera size</span>
						<select
							aria-label="Camera size"
							disabled={saving}
							onChange={handleCameraSizeChange}
							value={draft.video.sizeStep}
						>
							{GHOST_CAM_SIZE_STEPS.map((option) => (
								<option key={option.step} value={option.step}>
									{option.label}
								</option>
							))}
						</select>
					</label>
				</div>
			) : (
				<div className="layout-controls-v2" data-layout-controls="chat">
					<label>
						<span>Chat width</span>
						<select
							aria-label="Chat width"
							disabled={saving}
							onChange={handleChatWidthChange}
							value={draft.chat.width}
						>
							{CHAT_WIDTH_OPTIONS.map((width) => (
								<option key={width} value={width}>
									{width}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>Text scale</span>
						<select
							aria-label="Text scale"
							disabled={saving}
							onChange={handleTextScaleChange}
							value={draft.chat.textScale}
						>
							{CHAT_TEXT_SCALE_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>Visible messages</span>
						<select
							aria-label="Visible messages"
							disabled={saving}
							onChange={handleMessageCountChange}
							value={draft.chat.maxMessages}
						>
							{CHAT_MESSAGE_OPTIONS.map((count) => (
								<option key={count} value={count}>
									{count}
								</option>
							))}
						</select>
					</label>
				</div>
			)}

			<div className="layout-editor-actions-v2">
				<button type="button" disabled={saving || clean} onClick={handleRevert}>
					Revert
				</button>
				<button
					type="button"
					disabled={saving || clean}
					onClick={() => void handleApply()}
				>
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
		reservedRects: layoutContext.reservedRects.map((rect) => ({ ...rect })),
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
	const contentWidth = preview.clientWidth > 0 ? preview.clientWidth : bounds.width;
	const contentHeight = preview.clientHeight > 0 ? preview.clientHeight : bounds.height;
	const scaleX = contentWidth / viewportWidth;
	const scaleY = contentHeight / viewportHeight;

	return {
		height: safeRect.height * scaleY,
		left: bounds.left + preview.clientLeft + safeRect.x * scaleX,
		top: bounds.top + preview.clientTop + safeRect.y * scaleY,
		width: safeRect.width * scaleX,
	};
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
