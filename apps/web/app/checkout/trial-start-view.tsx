"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckoutSelection } from "@/lib/checkout-selection";

export function TrialStartView({
	selection,
	onStart,
}: {
	selection: CheckoutSelection;
	onStart?: () => void;
}) {
	const label = selection.plan === "plus" ? "Plus" : "Pro";

	return (
		<main
			id="main-content"
			className="flex min-h-[calc(100svh-69px)] items-center justify-center bg-ani-canvas px-6 py-12 text-ani-text sm:py-16"
		>
			<div className="w-full max-w-[490px] text-center">
				<h1 className="text-[clamp(2.5rem,5vw,3.75rem)] leading-[1.08] font-semibold tracking-[-0.045em]">
					Try <span className="text-[var(--ani-menu-accent)]">{label}</span> free
					<br />
					for 3 days
				</h1>
				<p className="mx-auto mt-6 max-w-[390px] text-base leading-relaxed text-ani-muted sm:text-xl">
					Create a room, invite your friends,
					<br />
					and watch together.
				</p>
				<ul className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13px] text-ani-muted sm:mt-10 sm:gap-x-10 sm:text-sm">
					{["No card required", "No automatic charge"].map((text) => (
						<li key={text} className="flex items-center gap-2.5">
							<CheckCircle2
								className="size-5 shrink-0"
								strokeWidth={1.5}
								aria-hidden="true"
							/>
							{text}
						</li>
					))}
				</ul>
				<Button
					type="button"
					variant="cream"
					onClick={onStart}
					aria-describedby="trial-start-terms"
					className="mt-8 h-auto min-h-[58px] w-full justify-between gap-4 rounded-[10px] px-6 py-4 text-base has-[>svg]:px-6 motion-reduce:transition-none motion-reduce:active:scale-100"
				>
					Start my 3-day trial
					<ArrowRight className="size-5" strokeWidth={1.75} aria-hidden="true" />
				</Button>
				<p
					id="trial-start-terms"
					className="mt-6 text-[13px] leading-relaxed text-ani-muted sm:text-sm"
				>
					<span className="block">Your 72 hours start when you click.</span>
					<span className="mt-1 block">
						After that, you return to Free unless you choose to subscribe.
					</span>
				</p>
				<Link
					href={`/pricing?plan=${selection.plan}&billing=${selection.billing}`}
					className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-ani-muted underline underline-offset-4 hover:text-ani-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ani-focus sm:mt-8"
				>
					<ChevronLeft className="size-4" aria-hidden="true" />
					Back to plans
				</Link>
			</div>
		</main>
	);
}
