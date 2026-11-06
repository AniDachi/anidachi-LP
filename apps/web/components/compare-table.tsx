"use client";

import { useState } from "react";
import Link from "next/link";
import {
	ArrowRight,
	Bookmark,
	ChevronDown,
	Link as LinkIcon,
	MessageCircle,
	Monitor,
	Users,
	Video,
	type LucideIcon,
} from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { trackConversion } from "@/lib/conversion-events";
import styles from "./compare-table.module.css";

const alternatives = [
	{
		id: "teleparty",
		label: "Teleparty",
		shortLabel: "Teleparty",
		source: "https://dev.teleparty.com/support",
	},
	{
		id: "crunchyrollParty",
		label: "Crunchyroll Party",
		shortLabel: "CR Party",
		source:
			"https://chromewebstore.google.com/detail/crunchyroll-party-watch-t/migkmndeenhgfopajdcipneifcdkjjpm",
	},
	{
		id: "discord",
		label: "Discord",
		shortLabel: "Discord",
		source:
			"https://support.discord.com/hc/en-us/articles/360040816151-Go-Live-and-Screen-Share",
	},
] as const;
type Alternative = (typeof alternatives)[number]["id"];
type Product = "anidachi" | Alternative;

// Public information checked 2026-09-30; the section notes link the sources.
// "Not listed" means undocumented there, never a claim of feature absence.
const rows: {
	feature: string;
	icon: LucideIcon;
	values: Record<Product, string>;
}[] = [
	{
		feature: "Platforms",
		icon: Monitor,
		values: {
			anidachi: "Crunchyroll, YouTube, Netflix",
			teleparty: "YouTube, Netflix + more",
			crunchyrollParty: "Crunchyroll",
			discord: "Shared app or screen",
		},
	},
	{
		feature: "Watching together",
		icon: Users,
		values: {
			anidachi: "Synced players",
			teleparty: "Synced players",
			crunchyrollParty: "Synced players",
			discord: "Screen sharing",
		},
	},
	{
		feature: "Chat & reactions",
		icon: MessageCircle,
		values: {
			anidachi: "On your video",
			teleparty: "Chat sidebar · Custom reactions (Premium)",
			crunchyrollParty: "Live chat & reactions",
			discord: "Channel or DM · Message reactions",
		},
	},
	{
		feature: "Voice & video",
		icon: Video,
		values: {
			anidachi: "Built in",
			teleparty: "Premium",
			crunchyrollParty: "Not listed",
			discord: "Built in",
		},
	},
	{
		feature: "Invites",
		icon: LinkIcon,
		values: {
			anidachi: "Friends, groups & links",
			teleparty: "Party link",
			crunchyrollParty: "Party link",
			discord: "Server or call",
		},
	},
	{
		feature: "Watch progress",
		icon: Bookmark,
		values: {
			anidachi: "Save on Plus / Pro",
			teleparty: "Not listed",
			crunchyrollParty: "Not listed",
			discord: "Not listed",
		},
	},
];

export function CompareTable() {
	const [selected, setSelected] = useState<Alternative>("teleparty");
	const selectedLabel = alternatives.find(
		(item) => item.id === selected,
	)!.label;
	return (
		<section
			id="compare"
			className={styles.section}
			aria-labelledby="compare-title"
		>
			<div className={styles.container}>
				<header className={styles.header}>
					<h2 id="compare-title">How AniDachi compares</h2>
				</header>
				<div
					className={styles.selector}
					role="group"
					aria-label="Compare AniDachi with"
				>
					{alternatives.map((product) => (
						<button
							key={product.id}
							type="button"
							aria-label={product.label}
							aria-pressed={selected === product.id}
							aria-controls="home-comparison"
							onClick={() => setSelected(product.id)}
						>
							{product.shortLabel}
						</button>
					))}
				</div>
				<p
					className={styles.selectionStatus}
					aria-live="polite"
					aria-atomic="true"
				>
					Comparing AniDachi with {selectedLabel}.
				</p>
				<table className={styles.table} id="home-comparison">
					<caption className="sr-only">
						Browser watch party features compared with Discord screen sharing.
					</caption>
					<thead>
						<tr>
							<th scope="col" className={styles.featureHeading}>
								<span className="sr-only">Feature</span>
							</th>
							<th scope="col" className={styles.ours}>
								<span className={styles.brandHeading}>
									<AnidachiLogo size={24} aria-hidden />
									<span>AniDachi</span>
								</span>
							</th>
							{alternatives.map((product) => (
								<th
									key={product.id}
									scope="col"
									className={styles.alternative}
									data-selected={selected === product.id}
									aria-label={product.label}
								>
									<span className={styles.fullLabel}>{product.label}</span>
									<span className={styles.shortLabel} aria-hidden="true">
										{product.shortLabel}
									</span>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.feature}>
								<th scope="row">
									<span className={styles.featureLabel}>
										<row.icon size={19} strokeWidth={1.5} aria-hidden="true" />
										<span>{row.feature}</span>
									</span>
								</th>
								<td className={styles.ours}>{row.values.anidachi}</td>
								{alternatives.map((product) => (
									<td
										key={product.id}
										className={styles.alternative}
										data-selected={selected === product.id}
									>
										{row.values[product.id]}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
				<div className={styles.footer}>
					<details className={styles.notes}>
						<summary>
							Sources & details <ChevronDown size={15} aria-hidden="true" />
						</summary>
						<div className={styles.notesContent}>
							<p>
								Compared on September 30, 2026. “Not listed” means the linked
								product information does not document the feature. Discord is
								compared using screen sharing.
							</p>
							<p>
								AniDachi saves progress on Plus and Pro. Your saved history and
								resume remain available on Free. Everyone needs their own access
								to the video when using synchronized players.
							</p>
							<ul aria-label="Comparison sources">
								{alternatives.map((product) => (
									<li key={product.id}>
										<a
											href={product.source}
											target="_blank"
											rel="noopener noreferrer"
										>
											{product.label}
										</a>
									</li>
								))}
								<li>
									<a
										href="https://dev.teleparty.com/premium"
										target="_blank"
										rel="noopener noreferrer"
									>
										Teleparty Premium
									</a>
								</li>
								<li>
									<a
										href="https://support.discord.com/hc/en-us/articles/12102061808663-Reactions-and-Super-Reactions-FAQ"
										target="_blank"
										rel="noopener noreferrer"
									>
										Discord reactions
									</a>
								</li>
							</ul>
						</div>
					</details>
					<Link
						href="/pricing"
						className={styles.planLink}
						onClick={() => {
							trackConversion("cta_click", {
								page_path: "/",
								page_template: "home",
								placement: "home_compare",
								cta_variant: "compare_pricing",
							});
						}}
					>
						Explore plans <ArrowRight size={17} aria-hidden="true" />
					</Link>
				</div>
			</div>
		</section>
	);
}
