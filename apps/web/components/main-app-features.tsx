"use client";

import { useState } from "react";
import Image from "next/image";
import { getPlanPolicy } from "@anidachi/protocol";
import styles from "./main-app-features.module.css";
import { ArrowDown, Check, Link2, UserRound } from "lucide-react";

const roomPlans = [
	{ id: "plus", label: "Plus", people: getPlanPolicy("plus").maxParticipants },
	{ id: "pro", label: "Pro", people: getPlanPolicy("pro").maxParticipants },
] as const;

export function MainAppFeatures() {
	const [roomPlan, setRoomPlan] = useState<"plus" | "pro">("plus");
	const pro = roomPlan === "pro";
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
							<div>
								<Image src="/Anidachi_logo.png" width="24" height="24" alt="" />
								<span>A room for your people</span>
							</div>
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

						<div className={styles.host}>
							<span className={styles.hostAvatar} aria-hidden="true">
								<UserRound size={25} strokeWidth={1.6} />
							</span>
							<div className={styles.hostIdentity}>
								<strong>You, the host</strong>
								<span>Create the room & share the link</span>
							</div>
							<span className={styles.planTag}>{planName}</span>
						</div>

						<div className={styles.guests}>
							<div className={styles.guestLabel}>
								<Link2 size={15} aria-hidden="true" />
								<span>Your friends join with Free accounts</span>
							</div>
							<div
								className={`${styles.guestGrid} ${pro ? styles.proGrid : ""}`}
								aria-hidden="true"
								key={roomPlan}
							>
								{Array.from({ length: guestCount }, (_, i) => (
									<div
										className={styles.guest}
										key={`guest-${i + 1}`}
										style={{ animationDelay: `${i * 18}ms` }}
									>
										<span className={styles.guestAvatar}>
											<UserRound size={21} strokeWidth={1.5} />
										</span>
										<span>Free</span>
									</div>
								))}
							</div>
						</div>

						<figcaption
							className={styles.caption}
							aria-live="polite"
							aria-atomic="true"
						>
							<Check size={16} aria-hidden="true" />
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
