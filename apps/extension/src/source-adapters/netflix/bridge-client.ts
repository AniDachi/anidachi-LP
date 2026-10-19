import {
	NETFLIX_REQUEST,
	hasBoundedNetflixResult,
	NetflixRequestSchema,
	NetflixResultSchema,
	type NetflixRequest,
	type NetflixResult,
} from "./contract";

export function runNetflixCommand(
	input: Omit<NetflixRequest, "id" | "source">,
	signal?: AbortSignal,
): Promise<NetflixResult | null> {
	if (signal?.aborted) return Promise.resolve(null);
	const request = NetflixRequestSchema.safeParse({
		...input,
		id: crypto.randomUUID(),
		source: NETFLIX_REQUEST,
	});
	if (!request.success) return Promise.resolve(null);
	return new Promise((resolve) => {
		let done = false;
		const finish = (result: NetflixResult | null) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			window.removeEventListener("message", listener);
			signal?.removeEventListener("abort", abort);
			resolve(result);
		};
		const abort = () => {
			if (done) return;
			finish(null);
			window.postMessage(
				{ ...request.data, action: "cancel" },
				location.origin,
			);
		};
		const listener = (event: MessageEvent) => {
			if (event.source !== window || event.origin !== location.origin) return;
			// Cheap header check before parsing potentially large catalog messages.
			if (
				!event.data ||
				event.data.id !== request.data.id ||
				!hasBoundedNetflixResult(event.data)
			)
				return;
			const result = NetflixResultSchema.safeParse(event.data);
			if (!result.success) return;
			const snapshot = result.data.snapshot;
			if (result.data.ok && !snapshot) return;
			if (
				snapshot &&
				(snapshot.movieId !== input.movieId ||
					(input.generation && snapshot.generation !== input.generation))
			)
				return;
			finish(result.data);
		};
		const timer = setTimeout(abort, 3500);
		window.addEventListener("message", listener);
		signal?.addEventListener("abort", abort, { once: true });
		window.postMessage(request.data, location.origin);
	});
}
