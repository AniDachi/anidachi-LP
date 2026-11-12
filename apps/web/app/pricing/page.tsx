import {
	PRICING_FREE20_SUMMARY,
	PRICING_FREE20_METERING_NOTE,
	PRICING_IS_ANIDACHI_FREE_ANSWER,
	PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
	PRICING_HISTORY_NOTE,
} from "@/lib/pricing-copy";
import type { Metadata } from "next";
import { languageAlternates } from "@/lib/hreflang";

import Link from "next/link";
import { PricingSelection } from "@/components/pricing-selection";
import { FAQSection } from "@/components/faq-section";
import { BreadcrumbJsonLd, FAQPageJsonLd } from "@/components/json-ld";
import { StoreReviews } from "@/components/store-reviews";
import { getPlanPolicy } from "@anidachi/protocol";

export const revalidate = 300;

export const metadata: Metadata = {
	title: { absolute: "AniDachi Pricing — Free Daily Hosting, Plus and Pro" },
	description:
		PRICING_FREE20_SUMMARY,
	alternates: languageAlternates({ en: "/pricing", de: "/de/preise" }, "en"),
	openGraph: {
		images: [
			{
				url: "/opengraph-image.png",
				width: 1200,
				height: 630,
				alt: "AniDachi – watch anime together, in perfect sync",
			},
		],

		title: "AniDachi Pricing — Free Chrome Watch Party",
		description:
			PRICING_FREE20_SUMMARY,
		url: "/pricing",
	},
	twitter: {
		images: ["/opengraph-image.png"],

		card: "summary_large_image",
		title: "AniDachi Pricing — Free Chrome Watch Party",
		description:
			PRICING_FREE20_SUMMARY,
	},
};

const faq = [
	{
		question: "Is AniDachi free?",
		answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
	},
	{
		question: "How do my free minutes work?",
		answer: PRICING_FREE20_METERING_NOTE,
	},
	{
		question: "Do my friends need a paid AniDachi subscription?",
		answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
	},
	{
		question: "What's the difference between Plus and Pro?",
		answer: `Plus supports up to ${getPlanPolicy("plus").maxParticipants} people and ${getPlanPolicy("plus").maxMicrophones} microphones. Pro supports up to ${getPlanPolicy("pro").maxParticipants} people and ${getPlanPolicy("pro").maxMicrophones} microphones, with priority support. Room sizes include the host. Both plans have no daily time limit and include personal watch history.`,
	},
	{
		question: "Can I keep my watch history on Free?",
		answer: PRICING_HISTORY_NOTE,
	},
	{
		question: "How do I cancel my subscription?",
		answer:
			"Open Account → Subscription and choose Cancel renewal. You keep access until the end of your current access period, and the subscription won’t renew.",
	},
	{
		question: "Do I still need Crunchyroll, YouTube, or Netflix?",
		answer:
			"Yes. Everyone needs their own access to the same video. A streaming subscription is required if the service charges for that title. AniDachi syncs your players; it doesn’t provide the video.",
	},
];

export default function PricingPage() {
	return (
		<>
			<BreadcrumbJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Pricing", url: "/pricing" },
				]}
			/>
			<FAQPageJsonLd questions={faq} />
			<main className="min-h-screen bg-ani-canvas">
				<nav
					aria-label="Breadcrumb"
					className="border-b border-ani-line bg-ani-canvas"
				>
					<div className="container mx-auto px-4 py-3.5 text-sm tracking-[-0.01em] text-ani-muted">
						<ol className="flex flex-wrap items-center gap-2">
							<li>
								<Link
									href="/"
									className="transition-colors duration-200 hover:text-ani-text"
								>
									Home
								</Link>
							</li>
							<li className="text-ani-line" aria-hidden="true">
								/
							</li>
							<li className="font-medium text-ani-text">Pricing</li>
						</ol>
					</div>
				</nav>

				<PricingSelection headingLevel={1} showPlanMatrix />
				<StoreReviews />
				<FAQSection title="Pricing FAQ" questions={faq} />
				<section className="container mx-auto max-w-3xl px-4 pb-16 text-center text-sm text-ani-muted">
					<p>
						Plus and Pro both cover Crunchyroll, YouTube and{" "}
						<Link
							href="/netflix-watch-party"
							className="font-medium text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
						>
							Netflix watch parties
						</Link>
						, and friends join free. Looking for how watch parties work? See{" "}
						<Link
							href="/watch-crunchyroll-together"
							className="font-medium text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
						>
							watch Crunchyroll together
						</Link>
						,{" "}
						<Link
							href="/watch-youtube-together"
							className="font-medium text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
						>
							YouTube watch party
						</Link>
						, or{" "}
						<Link
							href="/guides/best-watch-party-apps-for-anime"
							className="font-medium text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
						>
							best watch party apps for anime
						</Link>
						.
					</p>
				</section>
			</main>
		</>
	);
}
