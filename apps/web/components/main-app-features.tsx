"use client";

import { useState } from "react";
import { getPlanPolicy } from "@anidachi/protocol";
import styles from "./main-app-features.module.css";
import { ArrowDown, Plus } from "lucide-react";
import type { PageLocale } from "@/lib/locale/ui-strings";

const COPY = {
	en: {
		title: "20 free minutes a day.",
		accent: "Friends join free.",
		body: "Start a room for up to 4 people, including you. Choose Plus or Pro for a larger group and no daily time limit.",
		planLink: "Find your plan",
		access: "Everyone needs the AniDachi extension and their own access to the video.",
		figure: "Explore larger paid rooms with free guests",
		selector: "Explore paid room sizes",
		host: "Host",
		friendsJoin: "Friends join",
		free: "free",
		caption: (plan: string, guests: number) => `${plan}: one host and up to ${guests} friends joining free.`,
	},
	de: {
		title: "20 Minuten am Tag kostenlos.",
		accent: "Freunde treten kostenlos bei.",
		body: "Starte einen Raum für bis zu 4 Personen, dich eingeschlossen. Mit Plus oder Pro wird die Gruppe größer, ohne tägliches Zeitlimit.",
		planLink: "Plan finden",
		access: "Jeder braucht die AniDachi-Erweiterung und eigenen Zugriff auf das Video.",
		figure: "Größere bezahlte Räume mit kostenlosen Gästen",
		selector: "Raumgrößen der bezahlten Pläne",
		host: "Gastgeber",
		friendsJoin: "Freunde treten",
		free: "kostenlos bei",
		caption: (plan: string, guests: number) => `${plan}: ein Gastgeber und bis zu ${guests} Freunde, die kostenlos beitreten.`,
	},
} as const;

const roomPlans = [
	{ id: "plus", label: "Plus", people: getPlanPolicy("plus").maxParticipants },
	{ id: "pro", label: "Pro", people: getPlanPolicy("pro").maxParticipants },
] as const;

export function MainAppFeatures({ locale = "en" }: { locale?: PageLocale } = {}) {
	const copy = COPY[locale];
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
							{copy.title}
							<br />
							<span>{copy.accent}</span>
						</h2>
						<p className={styles.description}>
							{copy.body}
						</p>
						<a className={styles.planLink} href="#pricing">
							{copy.planLink} <ArrowDown size={17} aria-hidden="true" />
						</a>
						<p className={styles.accessNote}>
							{copy.access}
						</p>
					</div>

					<figure
						className={styles.room}
						aria-label={copy.figure}
					>
						<div
							className={styles.selector}
							role="group"
							aria-label={copy.selector}
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
							<strong className={styles.countLabel}>{copy.host}</strong>
							<strong className={`${styles.countLabel} ${styles.friendsLabel}`}>
								{copy.friendsJoin} <span>{copy.free}</span>
							</strong>
						</div>

						<figcaption
							className="sr-only"
							aria-live="polite"
							aria-atomic="true"
						>
							{copy.caption(planName, guestCount)}
						</figcaption>
					</figure>
				</div>
			</div>
		</section>
	);
}
