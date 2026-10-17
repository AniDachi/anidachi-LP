import {
	ONBOARDING_RETURN,
	ONBOARDING_RETURN_TTL_MS,
	OnboardingTokenSchema,
} from "@anidachi/protocol";
const KEY = "anidachi.onboardingCheckout";
type Receipt = {
	token: string;
	owner: string;
	sessionId: string;
	expiresAt: number;
};

/** Tab-local navigation receipt, not payment evidence or authorization. */
export function rememberOnboardingCheckout(
	token: string | undefined,
	owner: string,
	sessionId?: string,
) {
	try {
		window.sessionStorage.removeItem(KEY);
		if (
			!OnboardingTokenSchema.safeParse(token).success ||
			!sessionId?.startsWith("cs_")
		)
			return;
		window.sessionStorage.setItem(
			KEY,
			JSON.stringify({
				token,
				owner,
				sessionId,
				expiresAt: Date.now() + ONBOARDING_RETURN_TTL_MS,
			}),
		);
	} catch {
		/* Restricted storage must not block a purchase. */
	}
}
export function readOnboardingCheckout(
	owner: string,
	sessionId?: string,
): Receipt | null {
	try {
		const saved = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
		if (!saved) return null;
		if (
			!OnboardingTokenSchema.safeParse(saved.token).success ||
			saved.owner !== owner ||
			!Number.isFinite(saved.expiresAt) ||
			saved.expiresAt <= Date.now() ||
			saved.expiresAt > Date.now() + ONBOARDING_RETURN_TTL_MS ||
			typeof saved.sessionId !== "string"
		) {
			window.sessionStorage.removeItem(KEY);
			return null;
		}
		return sessionId && saved.sessionId !== sessionId ? null : saved;
	} catch {
		return null;
	}
}
export function forgetOnboardingCheckout(token: string) {
	try {
		const saved = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
		if (saved?.token === token) window.sessionStorage.removeItem(KEY);
	} catch {
		/* Navigation fallback remains available. */
	}
}
type ReturnPort = {
	postMessage(message: unknown): void;
	disconnect(): void;
	onMessage: { addListener(listener: (value: unknown) => void): void };
	onDisconnect: { addListener(listener: () => void): void };
};
type Runtime = {
	connect(id: string, options: { name: string }): ReturnPort;
	lastError?: unknown;
};
export function requestOnboardingReturn(
	extensionId: string | null | undefined,
	token: string,
	owner: string,
	signal: AbortSignal,
): Promise<boolean> {
	const runtime = (
		globalThis as typeof globalThis & { chrome?: { runtime?: Runtime } }
	).chrome?.runtime;
	if (
		!extensionId ||
		!/^[a-p]{32}$/.test(extensionId) ||
		!runtime?.connect ||
		signal.aborted ||
		!OnboardingTokenSchema.safeParse(token).success
	)
		return Promise.resolve(false);
	return new Promise((resolve) => {
		let settled = false;
		let port: ReturnPort | undefined;
		const finish = (returned: boolean) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			signal.removeEventListener("abort", abort);
			window.removeEventListener("pagehide", abort);
			try {
				port?.disconnect();
			} catch {
				/* Already disconnected. */
			}
			resolve(returned);
		};
		const abort = () => finish(false);
		const timer = setTimeout(() => finish(false), 3000);
		signal.addEventListener("abort", abort, { once: true });
		window.addEventListener("pagehide", abort, { once: true });
		try {
			port = runtime.connect(extensionId, { name: ONBOARDING_RETURN });
			port.onDisconnect.addListener(() => {
				void runtime.lastError;
				finish(false);
			});
			port.onMessage.addListener((value) => {
				const error = runtime.lastError;
				finish(
					!error && (value as { returned?: boolean } | null)?.returned === true,
				);
			});
			port.postMessage({ type: ONBOARDING_RETURN, token, ownerUserId: owner });
		} catch {
			finish(false);
		}
	});
}
