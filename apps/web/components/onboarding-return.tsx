"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
	BillingOwnerChangedError,
	guardBillingNavigation,
} from "@/lib/billing-navigation";
import {
	forgetOnboardingCheckout,
	requestOnboardingReturn,
} from "@/lib/onboarding-return-client";

/** Mount only after authoritative trial activation or checkout confirmation. */
export function OnboardingReturn({
	token,
	owner,
	extensionId,
}: {
	token: string;
	owner: string;
	extensionId?: string | null;
}) {
	const [attempt, setAttempt] = useState(0);
	const [state, setState] = useState<
		"returning" | "returned" | "fallback" | "account-changed"
	>("returning");
	useEffect(() => {
		const abort = new AbortController();
		// Deferring also prevents StrictMode's discarded mount from sending a second return.
		const timer = setTimeout(() => {
			void (async () => {
				setState("returning");
				try {
					await guardBillingNavigation(owner, abort.signal, true);
					const returned = await requestOnboardingReturn(
						extensionId,
						token,
						owner,
						abort.signal,
					);
					if (!abort.signal.aborted) {
						setState(returned ? "returned" : "fallback");
						if (returned) forgetOnboardingCheckout(token);
					}
				} catch (error) {
					if (!abort.signal.aborted)
						setState(
							error instanceof BillingOwnerChangedError
								? "account-changed"
								: "fallback",
						);
				}
			})();
		}, 0);
		return () => {
			clearTimeout(timer);
			abort.abort();
		};
	}, [attempt, extensionId, owner, token]);
	return (
		<div className="my-6 text-center" aria-live="polite">
			<p className="text-sm text-ani-muted">
				{state === "returning"
					? "Returning to your video…"
					: state === "returned"
						? "Continue the tour in your video tab."
						: state === "account-changed"
							? "Your account changed. Open your account to check your subscription."
							: "Return to your video tab to continue. If it is closed, open a video and click the AniDachi capsule."}
			</p>
			{state === "fallback" && (
				<Button
					variant="cream"
					className="mt-5"
					onClick={() => setAttempt((n) => n + 1)}
				>
					Back to onboarding
				</Button>
			)}
		</div>
	);
}
