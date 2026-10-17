"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Pricing } from "./pricing";
import { HomeSectionHeader } from "./home-section-header";

type Props = { headingLevel?: 1 | 2; showPlanMatrix?: boolean };

function SelectedPricing(props: Props) {
	const search = useSearchParams();
	const period = search.get("billing") === "monthly" ? "monthly" : "yearly";
	return <Pricing {...props} key={period} initialPeriod={period} />;
}

/** The public page stays static; no yearly price is painted for a monthly link. */
export function PricingSelection(props: Props) {
	return (
		<Suspense
			fallback={
				<section
					id="pricing"
					className="pricing-plans relative bg-ani-canvas py-16 lg:py-20"
					aria-busy="true"
				>
					<div className="container relative mx-auto px-4">
						<HomeSectionHeader
							title="Watch together. Choose your plan."
							description="Join friends for free, or host your own room with Plus or Pro."
							titleAs={props.headingLevel === 1 ? "h1" : "h2"}
							align="center"
						/>
						<div className="pricing-plans__grid mt-24" aria-hidden="true">
							{[0, 1, 2].map((index) => (
								<div
									key={index}
									className="pricing-plans__card min-h-[560px]"
								/>
							))}
						</div>
						<span className="sr-only" role="status">
							Loading plans
						</span>
					</div>
				</section>
			}
		>
			<SelectedPricing {...props} />
		</Suspense>
	);
}
