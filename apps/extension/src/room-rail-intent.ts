export const ROOM_RAIL_OPEN_DELAY_MS = 240;

const ROOM_RAIL_EDGE_PROXIMITY_PX = 20;
const ROOM_RAIL_EDGE_INTENT_PX = 6;

interface RoomRailVisibilityInput {
  participantCount: number;
  panelOpen: boolean;
  roomActive: boolean;
}

export function shouldRenderRoomRail({
  participantCount,
  panelOpen,
  roomActive,
}: RoomRailVisibilityInput): boolean {
  return roomActive && !panelOpen && participantCount > 0;
}

export function isRoomRailEdgeIntent({
  clientX,
  edgeRight,
}: {
  clientX: number;
  edgeRight: number;
}): boolean {
  const distanceToEdge = Math.max(0, edgeRight - clientX);
	return distanceToEdge <= ROOM_RAIL_EDGE_INTENT_PX;
}

export function isRoomRailEdgeProximity({
	clientX,
	edgeRight,
}: {
	clientX: number;
	edgeRight: number;
}): boolean {
	const distanceToEdge = Math.max(0, edgeRight - clientX);
	return distanceToEdge <= ROOM_RAIL_EDGE_PROXIMITY_PX;
}

export function selectVoiceRailParticipants<T extends { id: string }>(
  participants: T[],
  mountedCameraParticipantIds: ReadonlySet<string>,
): T[] {
  return participants.filter((participant) => !mountedCameraParticipantIds.has(participant.id));
}
