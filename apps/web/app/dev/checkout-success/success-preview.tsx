"use client";

import { useState, type ReactNode } from "react";
import {
	CheckoutSessionStatus,
	type SyncState,
} from "../../success/checkout-session-sync";
import { SuccessPageFrame } from "../../success/success-content";
import { formatBillingTime } from "@/lib/billing-view";

export function SuccessPreview({ children }: { children: ReactNode }) {
	const [trial, setTrial] = useState(false);
	const [trialEnd, setTrialEnd] = useState("");
	const state: SyncState = trial
		? {
				status: "synced",
				heading: "Your free trial has started",
				trialActive: true,
				message: `Your Plus trial ends ${trialEnd} (your local time).`,
			}
		: { status: "synced", message: "Your AniDachi account is active on Plus." };

	return (
		<>
			<aside
				className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-ani-muted"
				aria-label="Local preview controls"
			>
				<span>Local preview · sample data · no account changes</span>
				<div className="flex gap-4" role="group" aria-label="Checkout state">
					<button
						type="button"
						aria-pressed={!trial}
						onClick={() => setTrial(false)}
						className={
							!trial
								? "text-ani-primary underline underline-offset-4"
								: "hover:text-ani-text"
						}
					>
						Paid Plus
					</button>
					<button
						type="button"
						aria-pressed={trial}
						onClick={() => {
							setTrialEnd(
								formatBillingTime(
									new Date(Date.now() + 3 * 86_400_000).toISOString(),
								),
							);
							setTrial(true);
						}}
						className={
							trial
								? "text-ani-primary underline underline-offset-4"
								: "hover:text-ani-text"
						}
					>
						3-day trial
					</button>
				</div>
			</aside>
			<SuccessPageFrame preview>
				<CheckoutSessionStatus state={state} onRetry={() => undefined}>
					{children}
				</CheckoutSessionStatus>
			</SuccessPageFrame>
		</>
	);
}
