"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Chrome, Loader2, ArrowUpRight } from "lucide-react";
import { AnidachiLogo } from "./anidachi-logo";
import { Button } from "./ui/button";
import { ProviderLogo } from "../../extension/src/provider-logo";
import { CHROME_WEB_STORE_URL } from "@/lib/install-cta";
import {
	EXTENSION_WELCOME_PATH,
	type ExtensionWelcome,
} from "@/lib/extension-welcome";
import { requestExtensionPresence } from "@/lib/extension-presence-client";
import { isMobileInstallDevice } from "@/lib/mobile-install";
import { InstallLink } from "./install-link";
import styles from "./extension-install.module.css";

export function ExtensionWelcomeHero({
	welcome,
	extensionId,
}: {
	welcome: ExtensionWelcome;
	extensionId?: string | null;
}) {
	const router = useRouter();
	const [present, setPresent] = useState<boolean | null>(null);
	const [mobile, setMobile] = useState<boolean | null>(null);
	const [expired, setExpired] = useState(false);
	const [checking, setChecking] = useState(false);
	const boundedHosting = welcome.kind === "free20" || welcome.kind === "manual";
	const hostingDeparted = useRef(false);
	const activationGeneration = useRef(0);
	// Initial SSR uses document age; later snapshots use the refresh request age.
	// Both clocks are monotonic and independent of the user's wall-clock setting.
	const snapshotRequestStarted = useRef(0);
	const refreshPending = useRef(false);
	const pendingRequestGeneration = useRef(0);
	const pendingDeadline = useRef<ReturnType<typeof setTimeout> | null>(null);
	const clearPending = useCallback(() => {
		pendingRequestGeneration.current++;
		if (pendingDeadline.current !== null) clearTimeout(pendingDeadline.current);
		pendingDeadline.current = null;
		refreshPending.current = false;
	}, []);
	useEffect(() => () => clearPending(), [clearPending]);
	const refresh = useCallback(() => {
		if (
			refreshPending.current ||
			(boundedHosting &&
				(hostingDeparted.current || document.visibilityState === "hidden"))
		)
			return;
		snapshotRequestStarted.current = performance.now();
		refreshPending.current = true;
		setChecking(true);
		const requestGeneration = ++pendingRequestGeneration.current;
		const activation = activationGeneration.current;
		// router.refresh() returns void. Retire only this presentation lock if no
		// replacement props arrive; Next's underlying request is not cancelled.
		pendingDeadline.current = setTimeout(() => {
			if (
				requestGeneration !== pendingRequestGeneration.current ||
				activation !== activationGeneration.current
			)
				return;
			clearPending();
			setChecking(false);
			setExpired(true);
		}, 10_000);
		router.refresh();
	}, [router, boundedHosting, clearPending]);
	const active =
		!expired &&
		(welcome.kind === "trial" ||
			welcome.kind === "paid" ||
			welcome.kind === "free20" ||
			welcome.kind === "manual");
	const expiredSnapshot = useRef<ExtensionWelcome | null>(null);
	const hostingExpiryUsed = useRef(false);
	const hostingResetUsed = useRef(false);
	const expiresInMs =
		"expiresInMs" in welcome ? welcome.expiresInMs : undefined;

	useEffect(() => {
		clearPending();
		setChecking(false);
		setExpired(false);
		const generation = activationGeneration.current;
		const currentActivation = () =>
			!boundedHosting ||
			(generation === activationGeneration.current &&
				!hostingDeparted.current &&
				document.visibilityState !== "hidden");
		if (
			boundedHosting &&
			(hostingDeparted.current || document.visibilityState === "hidden")
		) {
			setExpired(true);
			return;
		}
		if (expiresInMs === undefined) return;
		const remaining = Math.max(
			0,
			expiresInMs -
				Math.max(0, performance.now() - snapshotRequestStarted.current),
		);
		if (remaining === 0) {
			if (!currentActivation()) return;
			setExpired(true);
			if (
				boundedHosting
					? !hostingExpiryUsed.current
					: expiredSnapshot.current !== welcome
			) {
				hostingExpiryUsed.current = true;
				expiredSnapshot.current = welcome;
				refresh();
			}
			return;
		}
		const deadline = performance.now() + remaining;
		let timer: ReturnType<typeof setTimeout>;
		const checkBoundary = () => {
			if (!currentActivation()) return;
			const left = deadline - performance.now();
			if (left <= 0) {
				setExpired(true);
				if (
					boundedHosting
						? !hostingExpiryUsed.current
						: expiredSnapshot.current !== welcome
				) {
					hostingExpiryUsed.current = true;
					expiredSnapshot.current = welcome;
					refresh();
				}
				return;
			}
			// Long annual subscriptions may exceed the browser timer limit.
			timer = setTimeout(checkBoundary, Math.min(left, 2_147_483_647));
		};
		checkBoundary();
		return () => clearTimeout(timer);
	}, [welcome, expiresInMs, boundedHosting, refresh, clearPending]);

	useEffect(() => {
		if (
			welcome.kind !== "free20" ||
			welcome.resetInMs === undefined ||
			hostingResetUsed.current
		)
			return;
		const remaining = Math.max(
			0,
			welcome.resetInMs -
				Math.max(0, performance.now() - snapshotRequestStarted.current),
		);
		const generation = activationGeneration.current;
		const timer = setTimeout(() => {
			if (
				generation !== activationGeneration.current ||
				hostingDeparted.current ||
				document.visibilityState === "hidden" ||
				hostingResetUsed.current
			)
				return;
			hostingResetUsed.current = true;
			setExpired(true);
			refresh();
		}, remaining);
		return () => clearTimeout(timer);
	}, [welcome, refresh]);

	useEffect(() => {
		const isMobile = isMobileInstallDevice(navigator);
		setMobile(isMobile);
		let abort = new AbortController();
		let focusTimer: ReturnType<typeof setTimeout> | undefined;
		let lastFocus = 0;
		const probe = () => {
			abort.abort();
			abort = new AbortController();
			const current = abort;
			if (!active || isMobile) return;
			void requestExtensionPresence(extensionId, current.signal).then(
				(value) => {
					if (!current.signal.aborted) setPresent(value);
				},
			);
		};
		probe();
		const retire = () => {
			if (boundedHosting) {
				activationGeneration.current++;
				hostingDeparted.current = true;
				clearTimeout(focusTimer);
				clearPending();
				setChecking(false);
				setExpired(true);
				abort.abort();
			}
		};
		const onFocus = () => {
			if (document.visibilityState === "hidden") {
				retire();
				return;
			}
			if (Date.now() - lastFocus < 1000) return;
			clearTimeout(focusTimer);
			const generation = activationGeneration.current;
			focusTimer = setTimeout(() => {
				if (
					generation !== activationGeneration.current ||
					document.visibilityState === "hidden" ||
					refreshPending.current
				)
					return;
				if (boundedHosting) activationGeneration.current++;
				lastFocus = Date.now();
				hostingDeparted.current = false;
				hostingExpiryUsed.current = false;
				hostingResetUsed.current = false;
				probe();
				refresh();
			}, 150);
		};
		window.addEventListener("blur", retire);
		window.addEventListener("pagehide", retire);
		window.addEventListener("anidachi:before-sign-out", retire);
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onFocus);
		return () => {
			window.removeEventListener("blur", retire);
			window.removeEventListener("pagehide", retire);
			window.removeEventListener("anidachi:before-sign-out", retire);
			abort.abort();
			clearTimeout(focusTimer);
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onFocus);
		};
	}, [active, boundedHosting, extensionId, refresh, clearPending]);

	const retry = () => {
		if (refreshPending.current || document.visibilityState === "hidden") return;
		activationGeneration.current++;
		hostingDeparted.current = false;
		hostingExpiryUsed.current = false;
		hostingResetUsed.current = false;
		refresh();
	};

	const plan =
		"plan" in welcome ? (welcome.plan === "pro" ? "Pro" : "Plus") : "";
	return (
		<section
			className={`${styles.hero} ${styles.welcome}`}
			aria-labelledby="welcome-title"
		>
			<div className={styles.brand}>
				<AnidachiLogo size={44} priority aria-hidden />
				<span>AniDachi</span>
			</div>
			<h1 id="welcome-title" className={styles.title}>
				{active && welcome.kind === "free20" ? (
					"You’re ready to watch with friends."
				) : active && welcome.kind === "manual" ? (
					"Your hosting access is ready."
				) : active ? (
					<>
						Your <span className={styles.welcomeAccent}>{plan}</span>
						{welcome.kind === "trial" ? " access is active." : " plan is active."}
					</>
				) : checking ? (
					"Checking your access…"
				) : expired ? (
					"Check your current access."
				) : welcome.kind === "sign_in" ? (
					"Sign in to continue."
				) : welcome.kind === "error" ? (
					"Let’s check your access."
				) : (
					"Check your account."
				)}
			</h1>
			<p className={styles.welcomeDescription}>
				{active && welcome.kind === "free20"
					? welcome.activeRoom
						? "You’re already in a room. Return to it before creating another."
						: welcome.remainingSeconds === 0
							? "Today’s host time is used. Resets at 00:00 UTC. You can still install and join friends free."
							: `${Math.ceil(welcome.remainingSeconds / 60)} host minutes remaining today. Free time resets at 00:00 UTC.`
					: active
						? welcome.kind === "trial" && welcome.cardlessWithoutRenewal
							? "No card needed. No automatic charge."
							: "You’re ready to watch with friends."
						: checking
							? "Your latest access status will appear here."
							: expired
								? "This access check has expired. Try again for your current status."
								: welcome.kind === "sign_in"
									? "Use your AniDachi account to finish setup."
									: welcome.kind === "error"
										? "We couldn’t confirm your access. Try again in a moment."
										: "View your account for current access and available plans."}
			</p>
			{active ? (
				<>
					<div className={styles.welcomeSetup} aria-live="polite">
						{mobile === null || (!mobile && present === null) ? (
							<div role="status" className={styles.welcomeChecking}>
								<Loader2
									size={20}
									className="animate-spin motion-reduce:animate-none"
									aria-hidden="true"
								/>
								<span className="sr-only">Preparing your next step</span>
							</div>
						) : mobile ? (
							<>
								<p>Open AniDachi in Chrome on your computer.</p>
								<Button
									asChild
									variant="cream"
									size="control"
									className={styles.installButton}
								>
									<InstallLink
										href={CHROME_WEB_STORE_URL}
										shareHref={EXTENSION_WELCOME_PATH}
										storePlacement="extension_welcome"
										target="_blank"
										rel="noopener noreferrer"
									>
										<Chrome size={22} aria-hidden="true" />
										Install AniDachi
									</InstallLink>
								</Button>
							</>
						) : present ? (
							<span className={styles.welcomeReady}>
								<Check size={17} aria-hidden="true" />
								Extension ready
							</span>
						) : (
							<>
								<Button
									asChild
									variant="cream"
									size="control"
									className={styles.installButton}
								>
									<InstallLink
										href={CHROME_WEB_STORE_URL}
										shareHref={EXTENSION_WELCOME_PATH}
										storePlacement="extension_welcome"
										target="_blank"
										rel="noopener noreferrer"
									>
										<Chrome size={22} aria-hidden="true" />
										Install AniDachi
										<span className="sr-only">, opens in a new tab</span>
									</InstallLink>
								</Button>
								<p>
									Install the extension, then open a video. Already installed?
									Choose a platform below.
								</p>
							</>
						)}
					</div>
					{mobile === false && present !== null ? (
						<>
							<h2 className={styles.welcomePrompt}>Where are we watching?</h2>
							<div className={styles.welcomePlatforms}>
								{(["youtube", "crunchyroll", "netflix"] as const).map(
									(provider) => (
										<a
											key={provider}
											href={`https://www.${provider}.com`}
											target="_blank"
											rel="noopener noreferrer"
										>
											<ProviderLogo
												provider={provider}
												label={
													provider === "youtube"
														? "YouTube"
														: provider === "netflix"
															? "Netflix"
															: "Crunchyroll"
												}
											/>
											<span>
												{provider === "youtube"
													? "YouTube"
													: provider === "netflix"
														? "Netflix"
														: "Crunchyroll"}
											</span>
											<ArrowUpRight size={17} aria-hidden="true" />
											<span className="sr-only">, opens in a new tab</span>
										</a>
									),
								)}
							</div>
							<p className={styles.welcomeHint}>
								Choose a video, then open the AniDachi capsule in the player.
							</p>
						</>
					) : null}
					<Link className={styles.welcomeSecondary} href="/account/billing">
						{boundedHosting ? "View account" : "Manage subscription"}
					</Link>
				</>
			) : (
				<div className={styles.action}>
					{welcome.kind === "error" || expired || checking ? (
						<Button variant="cream" onClick={retry} disabled={checking}>
							{checking ? "Checking access…" : "Try again"}
						</Button>
					) : (
						<Button asChild variant="cream">
							<Link
								href={
									welcome.kind === "sign_in"
										? `/login?next=${encodeURIComponent(EXTENSION_WELCOME_PATH)}`
										: "/account/billing"
								}
							>
								{welcome.kind === "sign_in" ? "Sign in" : "View account"}
							</Link>
						</Button>
					)}
				</div>
			)}
		</section>
	);
}
