import type { Env } from "./index";

export type SchedulerEnv = Pick<
	Env,
	| "ANIDACHI_MAINTENANCE_MODE"
	| "ANIDACHI_ENV"
	| "ANIDACHI_WEB_INTERNAL_BASE_URL"
	| "ANIDACHI_INTERNAL_API_SECRET"
>;
const DRAIN_TIMEOUT_MS = 40_000;
const MAX_ACKNOWLEDGEMENT_BYTES = 1024;

function canonicalWebOrigin(env: SchedulerEnv): string {
	const base = env.ANIDACHI_WEB_INTERNAL_BASE_URL;
	if (!base || !env.ANIDACHI_INTERNAL_API_SECRET)
		throw new Error("invalid_config");
	const canonical =
		env.ANIDACHI_ENV === "staging"
			? "https://staging.anidachi.app"
			: env.ANIDACHI_ENV === "production"
				? "https://www.anidachi.app"
				: null;
	if (canonical) {
		if (base !== canonical) throw new Error("invalid_config");
	} else {
		// Loopback is explicit local-only: no normalized aliases, paths or credentials.
		if (
			env.ANIDACHI_ENV !== "local" ||
			!/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::[1-9]\d{0,4})?$/.test(
				base,
			) ||
			new URL(base).origin !== base
		)
			throw new Error("invalid_config");
	}
	return base;
}

const targets = {
	notifications: {
		path: "/api/internal/notifications/drain",
		logPrefix: "[anidachi/inbox-push] scheduler",
		error: "notification_drain_unavailable",
	},
	free20_refresh: {
		path: "/api/internal/rooms/free20-refresh/drain",
		logPrefix: "[anidachi/free20-refresh] scheduler",
		error: "free20_refresh_drain_unavailable",
	},
} as const;

/** Fixed internal targets only; one total deadline also bounds response parsing. */
export async function drainScheduledOutbox(
	env: SchedulerEnv,
	target: keyof typeof targets,
): Promise<void> {
	const destination = targets[target];
	const startedAt = performance.now();
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	try {
		const url = `${canonicalWebOrigin(env)}${destination.path}`;
		const deadline = new Promise<never>((_resolve, reject) => {
			timer = setTimeout(() => {
				controller.abort();
				reject(new Error("timeout"));
			}, DRAIN_TIMEOUT_MS);
		});
		await Promise.race([
			deadline,
			(async () => {
				const response = await fetch(url, {
					// workerd supports manual, not error. Reject redirects below without following them.
					method: "POST",
					redirect: "manual",
					headers: {
						Authorization: `Bearer ${env.ANIDACHI_INTERNAL_API_SECRET}`,
					},
					signal: controller.signal,
				});
				reader = response.body?.getReader();
				if (!response.ok || !reader) throw new Error("invalid_response");
				let bytes = 0;
				let text = "";
				const decoder = new TextDecoder("utf-8", { fatal: true });
				while (true) {
					const chunk = await reader.read();
					if (chunk.done) break;
					bytes += chunk.value.byteLength;
					if (bytes > MAX_ACKNOWLEDGEMENT_BYTES)
						throw new Error("invalid_response");
					text += decoder.decode(chunk.value, { stream: true });
				}
				text += decoder.decode();
				const acknowledgement: unknown = JSON.parse(text);
				if (
					!acknowledgement ||
					typeof acknowledgement !== "object" ||
					Array.isArray(acknowledgement) ||
					Object.keys(acknowledgement).length !== 1 ||
					!("ok" in acknowledgement) ||
					acknowledgement.ok !== true
				)
					throw new Error("invalid_response");
			})(),
		]);
		console.info(destination.logPrefix, {
			outcome: "completed",
			durationMs: Math.max(0, performance.now() - startedAt),
		});
	} catch {
		console.error(destination.logPrefix, {
			outcome: "unavailable",
			durationMs: Math.max(0, performance.now() - startedAt),
		});
		// Reject the scheduled event so platform history does not show false success.
		throw new Error(destination.error);
	} finally {
		clearTimeout(timer);
		controller.abort();
		// Cancellation itself must not extend the total deadline on a stalled stream.
		if (reader) void reader.cancel().catch(() => undefined);
	}
}
