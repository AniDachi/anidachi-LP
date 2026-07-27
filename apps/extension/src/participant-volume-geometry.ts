const ACTIVE_ARC_START_DEGREES = 135;
const ACTIVE_ARC_DEGREES = 270;
const MIN_HIT_BAND_PX = 12;
const VOLUME_KEY_STEP = 5;

export interface ParticipantVolumePointerInput {
	centerX: number;
	centerY: number;
	radius: number;
	pointerX: number;
	pointerY: number;
	previousValue: number;
	captured: boolean;
	hitBandPx?: number;
}

function clampVolume(value: number): number {
	return Math.min(100, Math.max(0, value));
}

function getClockwiseAngleDegrees(deltaX: number, deltaY: number): number {
	return ((Math.atan2(deltaY, deltaX) * 180) / Math.PI + 360) % 360;
}

export function getParticipantVolumeFromPointer(
	input: ParticipantVolumePointerInput,
): number | null {
	const deltaX = input.pointerX - input.centerX;
	const deltaY = input.pointerY - input.centerY;

	if (!input.captured) {
		const distance = Math.hypot(deltaX, deltaY);
		const hitBandPx = Math.max(
			MIN_HIT_BAND_PX,
			input.hitBandPx ?? MIN_HIT_BAND_PX,
		);

		if (Math.abs(distance - input.radius) > hitBandPx / 2) {
			return null;
		}
	}

	const angleDegrees = getClockwiseAngleDegrees(deltaX, deltaY);
	const activeArcProgress =
		(angleDegrees - ACTIVE_ARC_START_DEGREES + 360) % 360;

	if (activeArcProgress > ACTIVE_ARC_DEGREES) {
		return input.captured ? clampVolume(input.previousValue) : null;
	}

	return clampVolume((activeArcProgress / ACTIVE_ARC_DEGREES) * 100);
}

export function getParticipantVolumeFromKey(
	currentValue: number,
	key: string,
): number | null {
	switch (key) {
		case "ArrowUp":
		case "ArrowRight":
			return clampVolume(currentValue + VOLUME_KEY_STEP);
		case "ArrowDown":
		case "ArrowLeft":
			return clampVolume(currentValue - VOLUME_KEY_STEP);
		case "Home":
			return 0;
		case "End":
			return 100;
		default:
			return null;
	}
}
