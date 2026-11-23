import { PRIME_CATALOG_PAGE_BYTES } from "./catalog-page";

export function createPrimePageReader(
	signal: AbortSignal,
	alive: () => boolean,
	byteBudget: number,
) {
	let totalBytes = 0;
	return async (url: string, mime: "text/html" | "application/json") => {
		if (totalBytes >= byteBudget)
			throw new Error("Prime catalog size limit reached");
		const response = await fetch(url, {
			method: "GET",
			credentials: "same-origin",
			redirect: "error",
			signal: signal,
			headers: { Accept: mime },
		});
		const length = response.headers.get("content-length");
		if (
			!alive() ||
			!response.ok ||
			response.redirected ||
			response.url !== url ||
			response.headers
				.get("content-type")
				?.split(";")[0]
				?.trim()
				.toLowerCase() !== mime ||
			(length !== null &&
				(!/^\d+$/.test(length) || Number(length) > PRIME_CATALOG_PAGE_BYTES)) ||
			!response.body
		) {
			await response.body?.cancel();
			throw new Error("Incomplete Prime catalog response");
		}
		const reader = response.body.getReader(),
			decoder = new TextDecoder();
		const abortRead = () => {
			void reader.cancel().catch(() => undefined);
		};
		signal.addEventListener("abort", abortRead, { once: true });
		let bytes = 0,
			raw = "";
		try {
			while (alive()) {
				const part = await reader.read();
				if (!alive()) throw new Error("Incomplete Prime catalog response");
				if (part.done) break;
				bytes += part.value.byteLength;
				totalBytes += part.value.byteLength;
				if (bytes > PRIME_CATALOG_PAGE_BYTES || totalBytes > byteBudget)
					throw new Error("Incomplete Prime catalog response");
				raw += decoder.decode(part.value, { stream: true });
			}
			raw += decoder.decode();
		} finally {
			signal.removeEventListener("abort", abortRead);
			await reader.cancel().catch(() => undefined);
			reader.releaseLock();
		}
		if (!alive()) throw new Error("Prime catalog request expired");
		return raw;
	};
}
