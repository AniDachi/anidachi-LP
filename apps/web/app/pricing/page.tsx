import type { Metadata } from "next";
import { initialPricingPrices } from "@/lib/anidachi-auth/pricing-catalog";

import Link from "next/link";
import { Pricing } from "@/components/pricing";
import { FAQSection } from "@/components/faq-section";
import { BreadcrumbJsonLd, FAQPageJsonLd } from "@/components/json-ld";
import { SocialProof } from "@/components/social-proof";
import { getPlanPolicy } from "@anidachi/protocol";

export const revalidate = 300;

export const metadata: Metadata = {
	title: "AniDachi Pricing — Free Chrome Watch Party for Crunchyroll & YouTube",
	description:
		"Join friends for free. Compare Plus and Pro for hosting Crunchyroll and YouTube watchrooms, and check your trial availability.",
	alternates: { canonical: "/pricing" },
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
			"Join friends for free. Compare Plus and Pro for hosting Crunchyroll and YouTube watchrooms.",
		url: "/pricing",
	},
	twitter: {
		images: ["/opengraph-image.png"],

		card: "summary_large_image",
		title: "AniDachi Pricing — Free Chrome Watch Party",
		description:
			"Join friends for free. Compare Plus and Pro for your next watch night.",
	},
};

const faq = [
	{
		question: "Is AniDachi free?",
		answer:
			"Yes. Install the extension and join a Plus, Pro or trial host for free. Plus and Pro include hosting and personal watch history. The plan cards above show the current hosting options.",
	},
	{
		question: "Do my friends need a paid AniDachi subscription?",
		answer:
			"No. Friends can join your room on Free accounts. Room size, microphone and camera limits follow the host's plan. Each viewer needs their own Plus or Pro access to record personal history.",
	},
	{
		question: "What's the difference between Plus and Pro?",
		answer: `Plus supports up to ${getPlanPolicy("plus").maxParticipants} people and ${getPlanPolicy("plus").maxMicrophones} microphones. Pro supports up to ${getPlanPolicy("pro").maxParticipants} people and ${getPlanPolicy("pro").maxMicrophones} microphones, with priority support. Both include unlimited daily hosting and personal history on Crunchyroll and YouTube.`,
	},
	{
		question: "How does the free trial work?",
		answer:
			"If your account is eligible, you can try Plus or Pro once for 3 days with a card. After that, the subscription renews monthly at the price shown before you confirm in Stripe. Cancel renewal before the trial ends to avoid the first charge. Switching plans during the trial does not restart it.",
	},
	{
		question: "How do I cancel my subscription?",
		answer:
			"Open Account → Subscription and choose Cancel subscription. Trial access lasts until its original end; paid access lasts until the end of the paid period. Canceling renewal prevents the next scheduled charge.",
	},
	{
		question: "Do I still need Crunchyroll or YouTube?",
		answer:
			"Yes. Each person streams under their own Crunchyroll or YouTube account. AniDachi adds watchrooms, sync, and chat, plus history recording on paid plans — it does not replace a streaming subscription.",
	},
];

export default async function PricingPage() {
	const prices = await initialPricingPrices();
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

				<Pricing headingLevel={1} showPlanMatrix initialPrices={prices} />
				<SocialProof />
				<FAQSection
					title="Pricing FAQ"
					questions={faq}
					defaultOpenIndexes={[0]}
				/>
				<section className="container mx-auto max-w-3xl px-4 pb-16 text-center text-sm text-ani-muted">
					<p>
						Looking for how watch parties work? See{" "}
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
