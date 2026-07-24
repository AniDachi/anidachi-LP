export type PlaybackSyncStatus =
	| { kind: "synced" }
	| { kind: "host-controls-playback" }
	| { kind: "waiting-for-host-ad" }
	| { kind: "watching-local-ad" }
	| { kind: "buffering" }
	| { kind: "resume-required" }
	| { kind: "unsupported-media" }
	| { kind: "out-of-sync"; expectedTime: number; drift: number }
	| { kind: "source-mismatch"; message: string }
	| { kind: "sync-error"; message: string };
