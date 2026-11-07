/** Hard deadline as well as AbortSignal: an unavailable dependency must not keep
 * public enrollment/admission alive indefinitely. No sensitive input in errors. */
export async function boundedFree20<T>(
	timeoutMs: number,
	work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			Promise.resolve().then(() => work(controller.signal)),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					controller.abort();
					reject(new Error("ROOM_AUTHORITY_UNAVAILABLE"));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
export async function readBoundedFree20Json(
	body: ReadableStream<Uint8Array> | null,
	maxBytes: number,
	signal?: AbortSignal,
): Promise<unknown> {
	if (!body) throw new Error("Invalid request");
	const reader = body.getReader();
	// cancel() closes pending reads before awaiting the source's cancellation
	// callback. Do not await that callback: an uncooperative source must not keep
	// the reader locked after the request deadline.
	let cancelled = false;
	const cancel = () => {
		if (cancelled) return;
		cancelled = true;
		void reader.cancel().catch(() => {});
	};
	signal?.addEventListener("abort", cancel, { once: true });
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		signal?.throwIfAborted();
		for (;;) {
			const next = await reader.read();
			signal?.throwIfAborted();
			if (next.done) break;
			size += next.value.byteLength;
			if (size > maxBytes) throw new Error("Invalid request");
			chunks.push(next.value);
		}
		const bytes = new Uint8Array(size);
		let at = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, at);
			at += chunk.byteLength;
		}
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	} finally {
		signal?.removeEventListener("abort", cancel);
		cancel();
		reader.releaseLock();
	}
}
