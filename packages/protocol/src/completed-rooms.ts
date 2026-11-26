import { z } from "zod";
import { RoomLobbyProviderSchema } from "./room-session";

const timestamp = z.iso.datetime({ offset: true });
export const CompletedRoomCursorSchema = z.object({
	endedAt: timestamp,
	roomId: z.string().min(1).max(128),
});
export const CompletedRoomSchema = z.strictObject({
	roomId: z.string().min(1).max(128),
	provider: RoomLobbyProviderSchema.nullable(),
	createdAt: timestamp,
	endedAt: timestamp,
	companions: z.array(
		z.strictObject({
			id: z.uuid(),
			name: z.string(),
			avatar: z.string().nullable(),
		}),
	),
});
export const CompletedRoomsPageSchema = z.strictObject({
	ownerUserId: z.uuid(),
	rooms: z.array(CompletedRoomSchema),
	next: CompletedRoomCursorSchema.nullable(),
});
export type CompletedRoom = z.infer<typeof CompletedRoomSchema>;
export type CompletedRoomCursor = z.infer<typeof CompletedRoomCursorSchema>;
export type CompletedRoomsPage = z.infer<typeof CompletedRoomsPageSchema>;
