"use client";

import { useState } from "react";
import { getPlanPolicy } from "@anidachi/protocol";
import styles from "./main-app-features.module.css";
import { ArrowDown, Check, Plus } from "lucide-react";

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
						<p className={styles.kicker}>YOUR ROOM. YOUR PEOPLE.</p>
						<h2 id="hosting-title">
							One subscription.
							<br />
							<span>Friends join free.</span>
						</h2>
						<p className={styles.description}>
							Only the host needs Plus or Pro. Your friends can join your room
							with a free AniDachi account.
						</p>
						<p className={styles.noGuestFees}>
							<Check size={18} strokeWidth={2} aria-hidden="true" /> No extra
							charge for each friend.
						</p>
						<a className={styles.planLink} href="#pricing">
							Find your plan <ArrowDown size={17} aria-hidden="true" />
						</a>
						<p className={styles.trialNote}>
							Friends join free during your 3-day trial, too.
						</p>
					</div>

					<figure
						className={styles.room}
						aria-label="Explore a room with one host subscription and free guests"
					>
						<div className={styles.roomHeading}>
							<span>One room. Everyone together.</span>
							<span className={styles.capacity}>
								Up to {guestCount + 1} people
							</span>
						</div>

						<div
							className={styles.selector}
							role="group"
							aria-label="Explore room sizes"
						>
							{roomPlans.map((option) => (
								<button
									key={option.id}
									type="button"
									aria-pressed={roomPlan === option.id}
									onClick={() => setRoomPlan(option.id)}
								>
									<strong>{option.label}</strong>
									<span>You + {option.people - 1} friends</span>
								</button>
							))}
						</div>

						<div className={styles.equation}>
							<div className={styles.personCount}>
								<span className={styles.number}>1</span>
								<strong>You, the host</strong>
								<span className={styles.countDetail}>
									{planName} subscription
								</span>
							</div>
							<Plus
								className={styles.plusSign}
								strokeWidth={1}
								aria-hidden="true"
							/>
							<div className={`${styles.personCount} ${styles.friendsCount}`}>
								<span className={styles.number}>{guestCount}</span>
								<strong>Up to {guestCount} friends</strong>
								<span className={styles.countDetail}>
									Join with Free accounts
								</span>
							</div>
						</div>

						<figcaption
							className={styles.caption}
							aria-live="polite"
							aria-atomic="true"
						>
							<span>
								You + up to <strong>{guestCount} friends.</strong> One
								subscription.
							</span>
						</figcaption>
					</figure>
				</div>

				<ol className={styles.steps}>
					<li>
						<span className={styles.stepNumber}>01</span>
						<div>
							<h3>Create a room</h3>
							<p>Choose Plus or Pro and pick a video.</p>
						</div>
					</li>
					<li>
						<span className={styles.stepNumber}>02</span>
						<div>
							<h3>Send the link</h3>
							<p>Your friends join with Free accounts.</p>
						</div>
					</li>
					<li>
						<span className={styles.stepNumber}>03</span>
						<div>
							<h3>Watch together</h3>
							<p>Stay in sync, chat, and use voice or video.</p>
						</div>
					</li>
				</ol>
				<p className={styles.accessNote}>
					Everyone needs the AniDachi extension and their own access to the
					video.
				</p>
			</div>
		</section>
	);
}
