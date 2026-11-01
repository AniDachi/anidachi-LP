"use client";

import { PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";
import { useState } from "react";
import { getPlanPolicy } from "@anidachi/protocol";
import styles from "./main-app-features.module.css";
import { ArrowDown, Plus } from "lucide-react";

const roomPlans = [
	{ id: "plus", label: "Plus", people: getPlanPolicy("plus").maxParticipants },
	{ id: "pro", label: "Pro", people: getPlanPolicy("pro").maxParticipants },
] as const;

export function MainAppFeatures() {
	const [roomPlan, setRoomPlan] = useState<"plus" | "pro">("plus");
	const plan = roomPlans.find((option) => option.id === roomPlan)!;
	const guestCount = plan.people - 1;
	const planName = plan.label;

	return (
		<section
			className={styles.section}
			id="features"
			aria-labelledby="hosting-title"
		>
			<div className={styles.container}>
				<div className={styles.main}>
					<div className={styles.copy}>
						<h2 id="hosting-title">
							Free daily hosting.
							<br />
							<span>Friends join free.</span>
						</h2>
						<p className={styles.description}>
							{PRICING_FREE20_SUMMARY} The larger rooms below use Plus or Pro. Friends join on free accounts.
						</p>
						<a className={styles.planLink} href="#pricing">
							Find your plan <ArrowDown size={17} aria-hidden="true" />
						</a>
						<p className={styles.accessNote}>
							Everyone needs the AniDachi extension and their own access to the
							video.
						</p>
					</div>

					<figure
						className={styles.room}
						aria-label="Explore larger paid rooms with free guests"
					>
						<div
							className={styles.selector}
							role="group"
							aria-label="Explore paid room sizes"
						>
							{roomPlans.map((option) => (
								<button
									key={option.id}
									type="button"
									aria-pressed={roomPlan === option.id}
									onClick={() => setRoomPlan(option.id)}
								>
									<strong>{option.label}</strong>
								</button>
							))}
						</div>

						<div className={styles.equation}>
							<span className={styles.number}>1</span>
							<Plus
								className={styles.plusSign}
								strokeWidth={1}
								aria-hidden="true"
							/>
							<span className={`${styles.number} ${styles.friendsCount}`}>
								{guestCount}
							</span>
							<strong className={styles.countLabel}>Host</strong>
							<strong className={`${styles.countLabel} ${styles.friendsLabel}`}>
								Friends join <span>free</span>
							</strong>
						</div>

						<figcaption
							className="sr-only"
							aria-live="polite"
							aria-atomic="true"
						>
							{planName}: one host and up to {guestCount} friends joining free.
						</figcaption>
					</figure>
				</div>
			</div>
		</section>
	);
}
