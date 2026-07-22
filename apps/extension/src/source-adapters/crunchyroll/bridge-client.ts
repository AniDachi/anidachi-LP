import {
	CRUNCHYROLL_CONTROL_RESULT_SOURCE,
	CRUNCHYROLL_CONTROL_SOURCE,
	type CrunchyrollControlAction,
	type CrunchyrollControlResult,
} from "./bridge-contract";

export function runCrunchyrollMainCommand(
	action: CrunchyrollControlAction,
	payload: {
		contentId?: string;
		locale?: string;
		seriesId?: string;
		time?: number;
		url?: string;
	} = {},
	timeoutMs = action === "seek"
		? 1000
		: action === "navigate"
			? 5200
			: action === "seriesPoster"
				? 3500
				: 450,
): Promise<CrunchyrollControlResult> {
	const id = createMessageId();

	return new Promise((resolve) => {
		let completed = false;
		let timeout = 0;
		const cleanup = () => {
			window.clearTimeout(timeout);
			window.removeEventListener("message", onMessage);
		};
		const complete = (result: CrunchyrollControlResult) => {
			if (completed) {
				return;
			}

			completed = true;
			cleanup();
			resolve(result);
		};
		const onMessage = (event: MessageEvent) => {
			if (
				(event.source && event.source !== window) ||
				!isCrunchyrollControlResult(event.data, id)
			) {
				return;
			}

			complete(event.data);
		};

		window.addEventListener("message", onMessage);
		timeout = window.setTimeout(() => {
			complete({
				action,
				error: "MAIN_BRIDGE_TIMEOUT",
				id,
				ok: false,
				source: CRUNCHYROLL_CONTROL_RESULT_SOURCE,
				timedOut: true,
			});
		}, timeoutMs);

		window.postMessage(
			{
				action,
				id,
				source: CRUNCHYROLL_CONTROL_SOURCE,
				...payload,
			},
			"*",
		);
	});
}

function isCrunchyrollControlResult(
	value: unknown,
	id: string,
): value is CrunchyrollControlResult {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<CrunchyrollControlResult>;
	return (
		candidate.source === CRUNCHYROLL_CONTROL_RESULT_SOURCE &&
		candidate.id === id
	);
}

function createMessageId(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
