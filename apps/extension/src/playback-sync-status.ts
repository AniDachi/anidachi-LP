export type PlaybackSyncStatus =
	| { kind: "synced" }
	| { kind: "host-controls-playback" }
	| { kind: "out-of-sync"; expectedTime: number; drift: number }
	| { kind: "source-mismatch"; message: string }
	| { kind: "sync-error"; message: string };
