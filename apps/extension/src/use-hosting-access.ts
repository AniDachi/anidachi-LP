import { useCallback, useEffect, useRef, useState } from "react";
import {
	requestHostingAccess,
	type HostingAccountAccess,
} from "./hosting-access-client";

export type HostingPolicyMode = "unknown" | "legacy" | "paid-hosting";
export type HostingDisplayState = {
	mode: HostingPolicyMode;
	access?: HostingAccountAccess;
	error: boolean;
	busy: boolean;
};
const UNKNOWN: HostingDisplayState = {
	mode: "unknown",
	error: false,
	busy: false,
};

/** One display read for quota and the offer. Never grants room creation. */
export function useHostingAccess({
	ownerUserId,
	sessionKey,
	enabled,
	request = requestHostingAccess,
}: {
	ownerUserId: string | null;
	sessionKey: string | null;
	enabled: boolean;
	request?: typeof requestHostingAccess;
}) {
	const [result, setResult] = useState<{
		ownerUserId: string;
		sessionKey: string;
		state: HostingDisplayState;
	} | null>(null);
	const refreshRef = useRef<(supersede: boolean) => void>(() => {});
	const refresh = useCallback(() => refreshRef.current(false), []);
	const invalidate = useCallback(() => refreshRef.current(true), []);
	useEffect(() => {
		if (!enabled || !ownerUserId || !sessionKey) return;
		let alive = true;
		let pending = false;
		let generation = 0;
		let last: HostingDisplayState = UNKNOWN;
		let refreshedAt = 0;
		let departed = false;
		const show = (state: HostingDisplayState) => {
			last = state;
			setResult({ ownerUserId, sessionKey, state });
		};
		async function load(supersede = false, retire = false) {
			if (!alive || (pending && !supersede)) return;
			const ownGeneration = ++generation;
			pending = true;
			if (retire) last = UNKNOWN;
			show({ ...last, error: false, busy: true });
			try {
				const access = await request(ownerUserId!, supersede);
				if (!alive || ownGeneration !== generation) return;
				if (access.ownerUserId !== ownerUserId)
					throw new Error("Hosting access owner changed");
				const hosting = access.hosting;
				const mode: HostingPolicyMode = !hosting
					? "unknown"
					: hosting.hostingActivationAt !== null &&
							Date.parse(hosting.hostingActivationAt) <=
								Date.parse(access.serverTime)
						? "paid-hosting"
						: "legacy";
				show({ mode, access, error: false, busy: false });
				refreshedAt = Date.now();
			} catch {
				if (alive && ownGeneration === generation)
					show({ ...last, error: true, busy: false });
			} finally {
				if (ownGeneration === generation) pending = false;
			}
		}
		refreshRef.current = (supersede) => {
			void load(supersede, supersede);
		};
		const leave = () => {
			departed = true;
		};
		const resume = () => {
			if (document.visibilityState === "hidden") {
				leave();
				return;
			}
			if (departed || Date.now() - refreshedAt >= 30_000) {
				const supersede = departed;
				departed = false;
				void load(supersede);
			}
		};
		const online = () => {
			if (document.visibilityState !== "hidden") void load();
		};
		void load();
		window.addEventListener("focus", resume);
		window.addEventListener("blur", leave);
		window.addEventListener("pageshow", resume);
		window.addEventListener("online", online);
		document.addEventListener("visibilitychange", resume);
		return () => {
			alive = false;
			setResult(null);
			refreshRef.current = () => {};
			window.removeEventListener("focus", resume);
			window.removeEventListener("blur", leave);
			window.removeEventListener("pageshow", resume);
			window.removeEventListener("online", online);
			document.removeEventListener("visibilitychange", resume);
		};
	}, [ownerUserId, sessionKey, enabled, request]);
	const state =
		enabled &&
		result?.ownerUserId === ownerUserId &&
		result?.sessionKey === sessionKey
			? result.state
			: UNKNOWN;
	return { state, refresh, invalidate };
}
