import type { AdapterDetectionResult, VideoAdapter } from "./types";

export interface ActiveAdapterHooks {
	mounted(adapter: VideoAdapter): void;
	relocated(adapter: VideoAdapter): void;
	suspended(previous: VideoAdapter): void;
	replaced(previous: VideoAdapter, next: VideoAdapter): void;
	detached(previous: VideoAdapter): void;
}

export type AdapterReconcileResult =
	| "mounted"
	| "relocated"
	| "suspended"
	| "replaced"
	| "detached"
	| "idle";

export class AdapterManager {
	private activeAdapter: VideoAdapter | null = null;
	private activeFingerprint: string | null = null;
	private suspended = false;
	private disposed = false;

	constructor(private readonly hooks: ActiveAdapterHooks) {}

	get current(): VideoAdapter | null {
		return this.activeAdapter;
	}

	reconcile(result: AdapterDetectionResult): AdapterReconcileResult {
		if (this.disposed) {
			return "idle";
		}

		if (result.status === "ready") {
			return this.activate(result.adapter);
		}

		if (result.status === "blocked") {
			return this.detach();
		}

		if (this.activeAdapter && !this.suspended) {
			this.suspended = true;
			this.hooks.suspended(this.activeAdapter);
			return "suspended";
		}

		return "idle";
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.detach();
	}

	private activate(next: VideoAdapter): AdapterReconcileResult {
		const nextFingerprint = next.getFingerprint();
		const previous = this.activeAdapter;

		if (!previous) {
			this.activeAdapter = next;
			this.activeFingerprint = nextFingerprint;
			this.suspended = false;
			this.hooks.mounted(next);
			return "mounted";
		}

		const samePlayerIdentity =
			!this.suspended &&
			previous.id === next.id &&
			previous.video === next.video &&
			previous.container === next.container &&
			this.activeFingerprint === nextFingerprint;
		if (samePlayerIdentity) {
			this.hooks.relocated(previous);
			return "relocated";
		}

		this.activeAdapter = next;
		this.activeFingerprint = nextFingerprint;
		this.suspended = false;
		this.hooks.replaced(previous, next);
		return "replaced";
	}

	private detach(): AdapterReconcileResult {
		const previous = this.activeAdapter;
		if (!previous) {
			return "idle";
		}

		this.activeAdapter = null;
		this.activeFingerprint = null;
		this.suspended = false;
		this.hooks.detached(previous);
		return "detached";
	}
}
