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
import type { PageLocale } from "@/lib/locale/ui-strings";
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

/** German labels and values for /de, same rows and order as `rows` (checked 2026-09-30). */
const ROWS_DE: { feature: string; values: Record<Product, string> }[] = [
	{ feature: "Dienste", values: { anidachi: "Crunchyroll, YouTube, Netflix", teleparty: "YouTube, Netflix und mehr", crunchyrollParty: "Crunchyroll", discord: "Geteilte App oder geteilter Bildschirm" } },
	{ feature: "Zusammen schauen", values: { anidachi: "Synchrone Player", teleparty: "Synchrone Player", crunchyrollParty: "Synchrone Player", discord: "Bildschirm teilen" } },
	{ feature: "Chat & Reaktionen", values: { anidachi: "Direkt auf dem Video", teleparty: "Chat-Seitenleiste · Eigene Reaktionen (Premium)", crunchyrollParty: "Live-Chat & Reaktionen", discord: "Kanal oder DM · Reaktionen auf Nachrichten" } },
	{ feature: "Sprache & Video", values: { anidachi: "Eingebaut", teleparty: "Premium", crunchyrollParty: "Nicht angegeben", discord: "Eingebaut" } },
	{ feature: "Einladungen", values: { anidachi: "Freunde, Gruppen & Links", teleparty: "Party-Link", crunchyrollParty: "Party-Link", discord: "Server oder Anruf" } },
	{ feature: "Schaufortschritt", values: { anidachi: "Speichern mit Plus / Pro", teleparty: "Nicht angegeben", crunchyrollParty: "Nicht angegeben", discord: "Nicht angegeben" } },
];

const COPY = {
	en: {
		title: "How AniDachi compares",
		compareWith: "Compare AniDachi with",
		comparing: (name: string) => `Comparing AniDachi with ${name}.`,
		caption: "Browser watch party features compared with Discord screen sharing.",
		feature: "Feature",
		sources: "Sources & details",
		note1: "Compared on September 30, 2026. “Not listed” means the linked product information does not document the feature. Discord is compared using screen sharing.",
		note2: "AniDachi saves progress on Plus and Pro. Your saved history and resume remain available on Free. Everyone needs their own access to the video when using synchronized players.",
		sourcesList: "Comparison sources",
		plans: "Explore plans",
		plansHref: "/pricing",
	},
	de: {
		title: "AniDachi im Vergleich",
		compareWith: "AniDachi vergleichen mit",
		comparing: (name: string) => `AniDachi im Vergleich mit ${name}.`,
		caption: "Watchparty-Funktionen im Browser im Vergleich mit Bildschirmteilen auf Discord.",
		feature: "Funktion",
		sources: "Quellen & Details",
		note1: "Verglichen am 30. September 2026. „Nicht angegeben“ heißt, dass die verlinkten Produktinfos die Funktion nicht beschreiben. Discord wird mit Bildschirmteilen verglichen.",
		note2: "AniDachi speichert den Fortschritt mit Plus und Pro. Gespeicherter Verlauf und Fortsetzen bleiben mit Free verfügbar. Bei synchronen Playern braucht jeder eigenen Zugriff auf das Video.",
		sourcesList: "Quellen des Vergleichs",
		plans: "Pläne ansehen",
		plansHref: "#pricing",
	},
} as const;

export function CompareTable({ locale = "en" }: { locale?: PageLocale } = {}) {
	const copy = COPY[locale];
	const de = locale === "de";
	const shownRows = rows.map((row, i) => (de ? { ...row, ...ROWS_DE[i] } : row));
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
					<h2 id="compare-title">{copy.title}</h2>
				</header>
				<div
					className={styles.selector}
					role="group"
					aria-label={copy.compareWith}
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
					{copy.comparing(selectedLabel)}
				</p>
				<table className={styles.table} id="home-comparison">
					<caption className="sr-only">
						{copy.caption}
					</caption>
					<thead>
						<tr>
							<th scope="col" className={styles.featureHeading}>
								<span className="sr-only">{copy.feature}</span>
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
						{shownRows.map((row) => (
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
							{copy.sources} <ChevronDown size={15} aria-hidden="true" />
						</summary>
						<div className={styles.notesContent}>
							<p>{copy.note1}</p>
							<p>{copy.note2}</p>
							<ul aria-label={copy.sourcesList}>
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
						href={copy.plansHref}
						className={styles.planLink}
						onClick={() => {
							trackConversion("cta_click", {
								page_path: de ? "/de" : "/",
								page_template: de ? "de_pilot" : "home",
								placement: "home_compare",
								cta_variant: "compare_pricing",
							});
						}}
					>
						{copy.plans} <ArrowRight size={17} aria-hidden="true" />
					</Link>
				</div>
			</div>
		</section>
	);
}
