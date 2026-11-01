"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	acceptAccountHostingStatus,
	type AccountHostingStatus,
} from "@anidachi/protocol";
import { requestAccountHostingStatus } from "./account-hosting-status-client";
type State = {
	owner: string;
	mode: "unknown" | "legacy" | "free20";
	status: AccountHostingStatus | null;
	started: number;
	busy: boolean;
	error: boolean;
};
const empty = (owner: string): State => ({
	owner,
	mode: "unknown",
	status: null,
	started: 0,
	busy: false,
	error: false,
});

/** Owner-bound presentation, not logical-login identity or room admission.
 * Invisible same-owner relogin can remain unobserved only within the original
 * short observation lifetime. Departure/sign-out intent always retires it. */
export function useAccountHostingStatus(
	owner: string,
	request = requestAccountHostingStatus,
	enabled = true,
) {
	const [state, setState] = useState(() => empty(owner));
	const action = useRef<() => void>(() => {});
	const refresh = useCallback(() => action.current(), []);
	useEffect(() => {
		if (!enabled) {
			setState(empty(owner));
			return;
		}
		let alive = true,
			generation = 0,
			pending = false,
			departed = false;
		let current = empty(owner),
			lastAttempt = -Infinity,
			expiryUsed = false,
			resetUsed = false;
		let period: {
			serverTime: number;
			resetAt: number;
			started: number;
		} | null = null;
		let expiry: ReturnType<typeof setTimeout> | undefined;
		let controller: AbortController | null = null,
			retry: ReturnType<typeof setTimeout> | undefined;
		const publish = (patch: Partial<State>) => {
			current = { ...current, ...patch };
			if (alive) setState(current);
		};
		const clearRetry = () => {
			clearTimeout(retry);
			retry = undefined;
		};
		const retire = () => {
			generation++;
			pending = false;
			controller?.abort();
			clearTimeout(expiry);
			clearRetry();
			publish({ mode: "unknown", status: null, busy: false });
		};
		async function load() {
			if (
				!alive ||
				pending ||
				departed ||
				document.visibilityState === "hidden"
			)
				return;
			const started = performance.now();
			if (started - lastAttempt < 5000) {
				if (retry === undefined)
					retry = setTimeout(
						() => {
							retry = undefined;
							void load();
						},
						5000 - (started - lastAttempt),
					);
				return;
			}
			lastAttempt = started;
			pending = true;
			const own = ++generation;
			controller = new AbortController();
			const wall = Date.now();
			publish({ mode: "unknown", status: null, busy: true, error: false });
			try {
				const result = await request(owner, controller.signal);
				if (
					!alive ||
					own !== generation ||
					departed ||
					String(document.visibilityState) === "hidden"
				)
					return;
				const elapsed = performance.now() - started;
				if (elapsed < 0 || Math.abs(Date.now() - wall - elapsed) > 2000)
					throw Error("Stale hosting read");
				if (result.mode === "legacy") {
					period = null;
					publish({ mode: "legacy", status: null, busy: false });
					return;
				}
				const status = acceptAccountHostingStatus(owner, result.status);
				const observedAt =
					status && period
						? Math.min(
								started,
								period.started + status.serverTime - period.serverTime,
							)
						: started;
				if (
					!status ||
					status.serverTime + performance.now() - observedAt >=
						status.validUntil
				)
					throw Error("Expired hosting read");
				period = {
					serverTime: status.serverTime,
					resetAt: status.period.resetAt,
					started: observedAt,
				};
				publish({ mode: "free20", status, started: observedAt, busy: false });
				clearTimeout(expiry);
				expiry = setTimeout(
					() => {
						if (!alive || own !== generation || departed) return;
						publish({ mode: "unknown", status: null });
						if (!expiryUsed) {
							expiryUsed = true;
							void load();
						}
					},
					status.validUntil -
						status.serverTime -
						(performance.now() - observedAt),
				);
			} catch {
				if (alive && own === generation)
					publish({ mode: "unknown", status: null, busy: false, error: true });
			} finally {
				if (own === generation) pending = false;
			}
		}
		const resume = () => {
			if (document.visibilityState === "hidden") {
				departed = true;
				retire();
				return;
			}
			if (
				!departed &&
				(pending || (current.status && performance.now() - lastAttempt < 5000))
			)
				return;
			departed = false;
			expiryUsed = false;
			resetUsed = false;
			void load();
		};
		const depart = () => {
			departed = true;
			retire();
		};
		action.current = () => {
			departed = false;
			expiryUsed = false;
			resetUsed = false;
			void load();
		};
		let previous = performance.now(),
			previousWall = Date.now();
		const timer = setInterval(() => {
			const now = performance.now(),
				wall = Date.now(),
				jump = Math.abs(wall - previousWall - (now - previous)) > 2000;
			previous = now;
			previousWall = wall;
			if (departed || document.visibilityState === "hidden") return;
			if (jump) {
				retire();
				if (!expiryUsed) {
					expiryUsed = true;
					void load();
				}
				return;
			}
			if (
				period &&
				!resetUsed &&
				period.serverTime + now - period.started >= period.resetAt
			) {
				resetUsed = true;
				period = null;
				retire();
				void load();
			}
			if (
				current.status &&
				current.status.serverTime + now - current.started >=
					current.status.validUntil
			) {
				publish({ mode: "unknown", status: null });
				if (!expiryUsed) {
					expiryUsed = true;
					void load();
				}
			} else if (current.status) publish({});
		}, 1000);
		publish({});
		void load();
		window.addEventListener("focus", resume);
		window.addEventListener("pageshow", resume);
		window.addEventListener("blur", depart);
		window.addEventListener("pagehide", depart);
		window.addEventListener("anidachi:before-sign-out", depart);
		document.addEventListener("visibilitychange", resume);
		return () => {
			alive = false;
			retire();
			clearInterval(timer);
			action.current = () => {};
			window.removeEventListener("focus", resume);
			window.removeEventListener("pageshow", resume);
			window.removeEventListener("blur", depart);
			window.removeEventListener("pagehide", depart);
			window.removeEventListener("anidachi:before-sign-out", depart);
			document.removeEventListener("visibilitychange", resume);
		};
	}, [owner, request, enabled]);
	const scoped = state.owner === owner ? state : empty(owner);
	const elapsed =
		typeof performance === "undefined"
			? 0
			: Math.max(0, performance.now() - scoped.started);
	const status =
		enabled &&
		scoped.status &&
		scoped.status.serverTime + elapsed < scoped.status.validUntil
			? scoped.status
			: null;
	return {
		...scoped,
		status,
		remainingSeconds:
			status?.access.kind === "daily_free"
				? Math.max(
						0,
						status.access.remainingSeconds -
							(status.access.metering ? Math.floor(elapsed / 1000) : 0),
					)
				: null,
		refresh,
	};
}
