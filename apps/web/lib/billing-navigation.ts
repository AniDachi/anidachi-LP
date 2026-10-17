export class BillingOwnerChangedError extends Error {
	constructor() {
		super("Your account changed. Please reload this page.");
		this.name = "BillingOwnerChangedError";
	}
}

/** Backgrounding does not cancel a server operation. Wait, then verify its owner
 * before a new mutation or redirect; never reuse this read as trial authorization. */
export async function guardBillingNavigation(
	owner: string,
	signal: AbortSignal,
	departed: boolean,
	departureRevision?: () => number,
): Promise<void> {
	signal.throwIfAborted();
	let recheck = departed || document.visibilityState === "hidden";
	let revision = departureRevision?.();
	do {
		if (document.visibilityState === "hidden") {
			await new Promise<void>((resolve, reject) => {
				const finish = (error?: unknown) => {
					document.removeEventListener("visibilitychange", resume);
					window.removeEventListener("focus", resume);
					signal.removeEventListener("abort", cancel);
					if (error) reject(error);
					else resolve();
				};
				const resume = () => {
					if (document.visibilityState !== "hidden") finish();
				};
				const cancel = () =>
					finish(signal.reason ?? new Error("Navigation canceled"));
				document.addEventListener("visibilitychange", resume);
				window.addEventListener("focus", resume);
				signal.addEventListener("abort", cancel, { once: true });
				if (signal.aborted) cancel();
				else resume();
			});
		}
		signal.throwIfAborted();
		revision = departureRevision?.();
		if (recheck) {
			const response = await fetch("/api/billing/offer", {
				cache: "no-store",
				signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
			});
			if (!response.ok)
				throw new Error("Could not confirm your account. Please try again.");
			const result = await response.json();
			signal.throwIfAborted();
			if (result.ownerUserId !== owner || result.action === "sign_in")
				throw new BillingOwnerChangedError();
		}
		recheck = true;
	} while (
		document.visibilityState === "hidden" ||
		revision !== departureRevision?.()
	);
}
