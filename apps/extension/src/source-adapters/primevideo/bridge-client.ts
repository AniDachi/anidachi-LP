import { boundedMessage, PRIME_REQUEST, PrimeRequestSchema, PrimeResultSchema, type PrimeRequest, type PrimeResult } from "./contract";
export function runPrimeCommand(input: Omit<PrimeRequest, "id" | "source">, signal?: AbortSignal): Promise<PrimeResult | null> {
  if (signal?.aborted) return Promise.resolve(null);
  const parsed = PrimeRequestSchema.safeParse({ ...input, source: PRIME_REQUEST, id: crypto.randomUUID() });
  if (!parsed.success) return Promise.resolve(null);
  const request = parsed.data;
  return new Promise(resolve => {
    let done = false;
    const finish = (result: PrimeResult | null) => {
      if (done) return; done = true; clearTimeout(timer);
      window.removeEventListener("message", listener); signal?.removeEventListener("abort", abort); resolve(result);
    };
    const abort = () => { if (done) return; finish(null); const { time: _time, rate: _rate, ...cancel } = request;
      window.postMessage({ ...cancel, action: "cancel" }, location.origin); };
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.id !== request.id || !boundedMessage(event.data)) return;
      const parsedResult = PrimeResultSchema.safeParse(event.data); if (!parsedResult.success) return;
      const result = parsedResult.data, snapshot = result.snapshot;
      if (result.ok && (!snapshot || snapshot.contentId !== input.contentId || input.generation && snapshot.generation !== input.generation)) return;
      if (result.catalog && (input.action !== "catalog" || !snapshot || snapshot.metadata.identity?.kind !== "episode" ||
        result.catalog.providerSeriesId !== snapshot.metadata.identity.seriesAnchorSeasonId)) return;
      finish(result);
    };
    const timer = setTimeout(abort, 3500);
    window.addEventListener("message", listener); signal?.addEventListener("abort", abort, { once: true });
    window.postMessage(request, location.origin);
  });
}
