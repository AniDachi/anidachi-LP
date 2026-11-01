export class RoomUpdateRequiredError extends Error {
	constructor(readonly free20: boolean) {
		super("ROOM_UPDATE_REQUIRED");
		this.name = "RoomUpdateRequiredError";
	}
}

/** SQL uses the differentiated reason only internally; HTTP retains its existing code. */
export function roomUpdateRequiredBody(free20 = false) {
	return {
		code: "ROOM_UPDATE_REQUIRED" as const,
		error: "Update required",
		message: free20
			? "Update AniDachi to use your daily free hosting time. You can still join friends' rooms."
			: "Update AniDachi to host or join this room.",
	};
}
