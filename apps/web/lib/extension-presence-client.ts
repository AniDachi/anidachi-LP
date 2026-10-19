import { WEBSITE_PRESENCE, WebsitePresenceResponseSchema } from "@anidachi/protocol";

type Runtime = { sendMessage(id: string, message: unknown, reply: (value: unknown) => void): void; lastError?: unknown };
/** Missing, older and disabled extensions are indistinguishable. This is only a UI hint. */
export function requestExtensionPresence(extensionId: string | null | undefined, signal: AbortSignal): Promise<boolean> {
  const runtime = (globalThis as { chrome?: { runtime?: Runtime } }).chrome?.runtime;
  if (signal.aborted || !extensionId || !/^[a-p]{32}$/.test(extensionId) || !runtime?.sendMessage) return Promise.resolve(false);
  return new Promise(resolve => {
    let settled = false;
    const finish = (present = false) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal.removeEventListener("abort", abort); resolve(present);
    };
    const abort = () => finish();
    const timer = setTimeout(() => finish(), 1000);
    signal.addEventListener("abort", abort, { once: true });
    try {
      runtime.sendMessage(extensionId, { type: WEBSITE_PRESENCE }, reply => {
        const error = runtime.lastError;
        finish(!error && WebsitePresenceResponseSchema.safeParse(reply).success);
      });
    } catch { finish(); }
  });
}
