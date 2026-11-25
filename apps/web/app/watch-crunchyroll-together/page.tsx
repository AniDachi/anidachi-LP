import { PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";
import type { Metadata } from "next";
import { languageAlternates } from "@/lib/hreflang";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import { HubCtaBand } from "@/components/hub-cta-band";
import { HUB_INSTALL_STEP, HubFeatureGrid, HubLandingLayout } from "@/components/hub-landing-layout";
import { getPlanPolicy } from "@anidachi/protocol";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import {
	SeoGuideBulletList,
	SeoGuideNote,
	SeoGuideOptions,
	SeoGuideRelated,
} from "@/components/seo-guide-blocks";
import type { TocHeading } from "@/components/table-of-contents";
import {
	PRICING_FREE_TIER_TABLE,
} from "@/lib/pricing-copy";

export const metadata: Metadata = {
	title: "Crunchyroll Watch Party: Sync & Chat with Friends",
	description:
		"Crunchyroll has no built-in watch party. Add AniDachi from the Chrome Web Store, open your own tab, and watch Crunchyroll together in sync with friends.",
	alternates: languageAlternates({ en: "/watch-crunchyroll-together", de: "/de/crunchyroll-watchparty" }, "en"),
	openGraph: {
		images: [
			{
				url: "/opengraph-image.png",
				width: 1200,
				height: 630,
				alt: "AniDachi – watch anime together, in perfect sync",
			},
		],

		title: "Crunchyroll Watch Party with AniDachi — Sync & Chat (2026)",
		description:
			"Does Crunchyroll have watch party? No — use AniDachi watchrooms for live sync and chat on each person's account.",
		url: "/watch-crunchyroll-together",
	},
};

const faq = [
	{
		question: "Does Crunchyroll have a watch party feature?",
		answer:
			"No. As of 2026, Crunchyroll has no built-in watch party, watch together or group watch feature. To watch together, each friend uses a Chrome extension such as AniDachi, or Teleparty with its Premium plan, on their own Crunchyroll account.",
	},
	{
		question: "How do you watch Crunchyroll together with friends?",
		answer:
			"Add AniDachi from the Chrome Web Store and open a Crunchyroll episode in desktop Chrome. With Free, Plus or Pro access, choose Create room and share the invite link. Friends open the same episode on their own accounts, and playback stays in sync with live chat.",
	},
	{
		question: "Do all my friends need Crunchyroll accounts?",
		answer:
			"Yes. Each person streams from their own Crunchyroll account. Crunchyroll's plans page (checked 20 Oct 2026) lists only paid plans, with a free trial for new and eligible subscribers. AniDachi adds the sync, the room and the chat on top.",
	},
	{
		question:
			"Can two people watch Crunchyroll at the same time on one account?",
		answer:
			"Not reliably. Crunchyroll limits concurrent streams per plan, and its terms limit an account to one household, so friends should not share one login for a watch party. Each friend opens the episode on their own account; AniDachi only syncs those tabs.",
	},
	{
		question: "Is there a free way to watch Crunchyroll together?",
		answer: `Yes, on the AniDachi side. ${PRICING_FREE20_SUMMARY} Friends join free. Each friend still needs their own Crunchyroll plan to play the episode.`,
	},
	{
		question: "Does Teleparty work with Crunchyroll?",
		answer:
			"Yes, but only with Teleparty Premium. Its support FAQ lists Crunchyroll among the premium services, at $6.59 a month or $47.88 a year when we checked on November 23, 2026; guests can join a Premium host's party free. AniDachi works on Crunchyroll on its Free plan, with live sync, chat and calls.",
	},
	{
		question: "Does Watch2Gether work with Crunchyroll?",
		answer:
			"Watch2Gether is a free browser room site that works best for public video links. It is not a reliable Crunchyroll watch party, because licensed episodes need to play on each person's own Crunchyroll account. Use an extension watchroom such as AniDachi instead.",
	},
	{
		question: "What happened to Crunchyroll Party?",
		answer:
			"Crunchyroll Party was never a Crunchyroll product; it is the name of several unofficial extensions. The best-known one was removed from the Chrome Web Store on March 29, 2025, and Chrome-Stats lists the reason as malware. Smaller extensions with similar names are still listed, so check the developer before installing one.",
	},
	{
		question: "What is a Crunchyroll watch party extension?",
		answer:
			"A Chrome extension that sits on top of each person's Crunchyroll tab. It creates a shared room, keeps play, pause and seeking aligned, and usually adds chat. Each friend still streams from their own account.",
	},
	{
		question: "What is a Crunchyroll group watch?",
		answer:
			"A group watch is when several people watch the same anime on Crunchyroll at the same time, with synced playback and shared chat. Crunchyroll has no built-in group watch, so you set one up with an extension such as AniDachi.",
	},
	{
		question: "Why is Teleparty not syncing on Crunchyroll?",
		answer:
			"The usual causes are drift after a Crunchyroll player update, one person on a different episode, another streaming extension interfering, or an outdated Teleparty build. Check that everyone has the same series and episode open, pause on a title card and resync. If drift keeps coming back, turn off other streaming extensions and reload the Crunchyroll tab, or try a different extension such as AniDachi.",
	},
	{
		question: "What is a good Crunchyroll Party alternative?",
		answer:
			"The best-known Crunchyroll Party extension was removed from the Chrome Web Store in March 2025. AniDachi does the same job on Crunchyroll, synced playback and chat, and adds voice and video calls, YouTube and Netflix rooms, and a personal watch history. Each friend still needs their own Crunchyroll plan.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "step-by-step", label: "Step-by-step", level: 2 },
	{ id: "quick-answers", label: "Does Crunchyroll have a watch party?", level: 2 },
	{ id: "with-friends", label: "How to watch Crunchyroll with friends online", level: 2 },
	{ id: "compare-methods", label: "Compare methods", level: 2 },
	{ id: "teleparty-crunchyroll", label: "Teleparty on Crunchyroll", level: 2 },
	{ id: "crunchyroll-party", label: "What happened to Crunchyroll Party?", level: 2 },
	{ id: "group-watch", label: "Crunchyroll group watch tips", level: 2 },
	{ id: "anidachi-difference", label: "What makes AniDachi different", level: 2 },
	{ id: "continue-watching", label: "Continue Watching and watch history", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

/** One step list for the visible "How to watch" section and the HowTo JSON-LD, so they always match. */
const howToSteps = [
	HUB_INSTALL_STEP,
	{
		name: "Open a Crunchyroll episode",
		text: "Open the episode in desktop Chrome. AniDachi detects the player automatically.",
	},
	{
		name: "Create a room and invite friends",
		text: "With Free, Plus or Pro access, choose Create room and share the invite link. Friends join free.",
	},
	{
		name: "Watch together",
		text: "Friends open the same episode on their own accounts. Playback stays in sync, with live chat and reactions.",
	},
];

const PAGE_PATH = "/watch-crunchyroll-together";

export default function WatchCrunchyrollTogetherPage() {

	return (
		<>
			<HowToJsonLd
				name="How to watch Crunchyroll together with friends"
				description="Set up a Crunchyroll watchroom with AniDachi for synced live anime viewing."
				steps={howToSteps}
			/>
			<HubLandingLayout
				breadcrumbs={[
					{ name: "Home", url: "/" },
					{
						name: "Crunchyroll Watch Party",
						url: "/watch-crunchyroll-together",
					},
				]}
				title="Watch Crunchyroll Together — Sync Anime with Friends"
				description="Host a Crunchyroll watch party with AniDachi — synced playback and live chat on each person's account."
				url="/watch-crunchyroll-together"
				datePublished="2026-04-23"
				dateModified="2026-11-24"
				faq={faq}
				headings={tocHeadings}
				h1="Crunchyroll Watch Party"
				heroLead="Crunchyroll has no watch party button. AniDachi adds one."
				heroCtaLabel="Start a Crunchyroll Watch Party"
				heroWorksOn={["Crunchyroll", "YouTube", "Netflix"]}
				heroFinePrint="20 free minutes a day. Friends join free."
				answer={
					<>
							<strong>
								Does Crunchyroll have a watch party? No, not as of 2026. To watch
								Crunchyroll together, each friend adds the AniDachi Chrome
								extension, opens the same episode on their own account and joins
								one watchroom.
							</strong>{" "}
							Step-by-step:{" "}
							<Link href="/guides/how-to-watch-crunchyroll-with-friends">
								how to watch Crunchyroll with friends
							</Link>
							.
					</>
				}
				steps={{
					id: "step-by-step",
					heading: "How to Watch Crunchyroll Together (Step by Step)",
					items: howToSteps,
				}}
			>
				<h2 id="quick-answers" className="scroll-mt-24">
					Does Crunchyroll Have a Watch Party, and Does Teleparty Work?
				</h2>
				<SeoGuideOptions
					options={[
						{
							title: "Does Crunchyroll have a watch party?",
							body: (
								<>
									No. As of 2026, Crunchyroll has no built-in watch party, watch
									together or group-watch button, so each person needs a Chrome
									extension on their own Crunchyroll tab. More answers are in the{" "}
									<a href="#faq">FAQ</a> below.
								</>
							),
						},
						{
							title: "Does Teleparty work with Crunchyroll?",
							body: (
								<>
									Only with Teleparty Premium, which lists Crunchyroll as a
									premium service. AniDachi works on Crunchyroll on its Free plan.
									Details in <a href="#teleparty-crunchyroll">Teleparty on Crunchyroll</a>
									; full compare:{" "}
									<Link href="/guides/best-teleparty-alternatives-for-anime">
										Best Teleparty alternatives
									</Link>
									.
								</>
							),
							highlight: true,
						},
						{
							title: "Can you screen share Crunchyroll on Discord instead?",
							body: (
								<>
									Often a black screen because of DRM. Keep Discord for voice;
									sync video in AniDachi. More on the black screen:{" "}
									<Link href="/guides/can-you-screen-share-crunchyroll-on-discord">
										how to stream Crunchyroll on Discord
									</Link>
									.
								</>
							),
						},
					]}
				/>

				<h2 id="with-friends" className="scroll-mt-24">
					How to Watch Crunchyroll with Friends Online
				</h2>
				<p>
					To watch Crunchyroll with friends online, everyone opens the same episode
					on their own Crunchyroll account in desktop Chrome. One person hosts an
					AniDachi room and sends the invite link. Friends join free, and the room
					keeps every player on the same moment, with chat, reactions, and voice
					and video calls.
				</p>
				<p>
					Each friend needs their own Crunchyroll plan; Fan, the cheapest, is
					enough. Whether two people can share one account is covered in{" "}
					<Link href="/guides/how-to-watch-crunchyroll-with-friends">
						how to watch Crunchyroll with friends
					</Link>
					. AniDachi is a <Link href="/">watch party app</Link> that also works on
					Netflix and YouTube, so the same group can switch services on another
					night.
				</p>

				<h2 id="compare-methods" className="scroll-mt-24">
					Best Ways to Watch Crunchyroll with Friends
				</h2>
				<p>How the main options compare for a Crunchyroll night:</p>
				<ResponsiveCompareTable
					columns={[
						{ id: "anidachi", label: "AniDachi", highlight: true },
						{ id: "teleparty", label: "Teleparty" },
						{ id: "crunchyroll", label: "Crunchyroll's own feature" },
						{ id: "discord", label: "Discord" },
					]}
					rows={[
						{
							feature: "Sync",
							values: {
								anidachi: "yes",
								teleparty: "yes",
								crunchyroll: "No watch party feature",
								discord: "Manual",
							},
						},
						{
							feature: "Chat",
							values: {
								anidachi: "yes",
								teleparty: "yes",
								crunchyroll: "No feature",
								discord: "Voice/Text",
							},
						},
						{
							feature: "Everyone watches on their own account",
							values: {
								anidachi: "yes",
								teleparty: "yes",
								crunchyroll: "No feature",
								discord: "Screen share only",
							},
						},
						{
							feature: "Cost on Crunchyroll",
							values: {
								anidachi: PRICING_FREE_TIER_TABLE,
								teleparty: "Premium only",
								crunchyroll: "No feature",
								discord: "Free",
							},
						},
					]}
				/>
				<SeoGuideNote className="mt-4">
					<strong>Watch2Gether note:</strong> W2G is fine for public links, but
					it is not a Crunchyroll account watch party. Licensed Crunchyroll
					episodes need a party extension on each person&apos;s Crunchyroll tab
					— see also{" "}
					<Link href="/guides/watch2gether-alternatives-for-anime">
						Watch2Gether alternatives
					</Link>
					.
				</SeoGuideNote>
				<p className="mt-6">
					Party not syncing?{" "}
					<Link href="/guides/crunchyroll-watch-party-not-working">
						Crunchyroll watch party not working
					</Link>{" "}
					has the step-by-step fixes.
				</p>

				<h2 id="teleparty-crunchyroll" className="scroll-mt-24">
					Teleparty on Crunchyroll
				</h2>
				<p>
					Teleparty works on Crunchyroll only with Teleparty Premium. Its support
					FAQ lists Crunchyroll among the premium services, next to Paramount+ and
					ESPN+, and voice and video chat need Premium too. Premium cost $6.59 a
					month or $47.88 a year on its website when we checked on November 23,
					2026. Guests can join a Premium host&apos;s party for free. The free tier
					covers Netflix, YouTube, Disney+, Hulu, HBO Max and Prime Video.
				</p>
				<p>
					AniDachi works on Crunchyroll on its Free plan. {PRICING_FREE20_SUMMARY}{" "}
					Calls are included. Teleparty&apos;s tiers and privacy are covered in{" "}
					<Link href="/guides/is-teleparty-free">is Teleparty free and safe</Link>.
				</p>

				<h2 id="crunchyroll-party" className="scroll-mt-24">
					What Happened to Crunchyroll Party?
				</h2>
				<p>
					Crunchyroll Party was never a Crunchyroll product. It is the name several
					unofficial Chrome extensions used. The best-known one, with about 10,000
					users, was removed from the Chrome Web Store on March 29, 2025, and
					Chrome-Stats lists the reason as malware. Its store page has been empty
					since (checked November 24, 2026).
				</p>
				<p>
					Smaller extensions with similar names are still listed, made by
					independent developers. Check who publishes one before you install it.
					AniDachi does the same job on Crunchyroll, with synced playback and chat,
					and adds voice and video calls. Sources:{" "}
					<a
						href="https://www.teleparty.com/support"
						target="_blank"
						rel="noopener noreferrer"
					>
						Teleparty support FAQ
					</a>
					,{" "}
					<a
						href="https://chrome-stats.com/d/doiccohjdlfcjejcpoddcolekfgipkna"
						target="_blank"
						rel="noopener noreferrer"
					>
						Chrome-Stats on the removed Crunchyroll Party extension
					</a>
					.
				</p>

				<HubCtaBand
					pagePath={PAGE_PATH}
					ctaLabel="Start a Crunchyroll Watch Party"
					heading="Start your Crunchyroll watch party"
					body="Install AniDachi, open an episode and send the invite. 20 free minutes a day, and friends join free."
				/>

				<h2 id="group-watch" className="scroll-mt-24">
					Crunchyroll Group Watch: Tips for Bigger Groups
				</h2>
				<p>
					Running a <strong>Crunchyroll group watch</strong> for more than two
					or three people introduces some logistics worth planning for. To pick
					a night, check the{" "}
					<Link href="/tools/crunchyroll-schedule">
						Crunchyroll release schedule
					</Link>{" "}
					for when new episodes drop. Groups that watch in English can use the{" "}
					<Link href="/tools/crunchyroll-dub-schedule">
						Crunchyroll dub schedule
					</Link>{" "}
					to see which English dubs arrive this week:
				</p>
				<SeoGuideBulletList
					items={[
						{
							title: "Everyone needs their own account",
							body: (
								<>
									Crunchyroll&apos;s terms limit an account to one household, and
									the plans page (checked 20 Oct 2026) lists only paid plans, with
									a free trial for new and eligible subscribers. Fan, the cheapest
									plan, is enough to join. Details:{" "}
									<Link href="/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing">
										does everyone need Crunchyroll Premium?
									</Link>
								</>
							),
						},
						{
							title: "Use a watchroom invite link",
							body: "With AniDachi, you create one watchroom and share a single link. No manual setup for each person.",
						},
						{
							title: "Set a spoiler rule before episode one",
							body: "Agree on whether to pause for reactions or discuss after each episode. Keep later-episode details in a separate chat; AniDachi room chat is live and does not automatically hide spoilers.",
						},
						{
							title: "Agree on a shared time",
							body: "Live rooms need everyone online together. If someone misses a session, let them catch up independently before the next meeting.",
						},
					]}
				/>

				<h2 id="anidachi-difference" className="scroll-mt-24">
					What Makes AniDachi Different
				</h2>
				<HubFeatureGrid
					items={[
						{
							title: "One extension, three platforms",
							body: (
								<>
									The same watchroom works on Crunchyroll, on{" "}
									<Link href="/watch-youtube-together">YouTube</Link> and for a{" "}
									<Link href="/netflix-watch-party">Netflix watch party</Link>.
									Friends install it once. Prime Video isn&apos;t supported
									yet; what works today is in{" "}
									<Link href="/prime-video-watch-party">
										Prime Video watch party
									</Link>
									.
								</>
							),
						},
						{
							title: "Chat, reactions, camera and mic",
							body: "Everything happens on top of the Crunchyroll player, so nobody needs a second app open to talk.",
						},
						{
							title: "Rooms that fit your group",
							body: `Free rooms hold up to ${getPlanPolicy("free").maxParticipants} people, including you. Plus holds ${getPlanPolicy("plus").maxParticipants} and Pro holds ${getPlanPolicy("pro").maxParticipants}. Friends join free.`,
						},
						{
							title: "Your own watch history",
							body: "Plus or Pro records which episodes you watched in rooms, so you can pick up where you left off.",
						},
					]}
				/>
				<p className="text-sm">
					Not here yet: async catch-up, for friends who watch at different
					times, is planned and not available today.
				</p>

				<h2 id="continue-watching" className="scroll-mt-24">
					Continue Watching and watch history
				</h2>
				<p>
					Crunchyroll&apos;s Continue Watching row lists the shows you started.
					To take one off, see{" "}
					<Link href="/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll">
						how to remove shows from Continue Watching on Crunchyroll
					</Link>
					. Your full episode list is your{" "}
					<Link href="/crunchyroll-watch-history">Crunchyroll watch history</Link>,
					and you can{" "}
					<Link href="/guides/how-to-clear-watch-history-on-crunchyroll">
						clear watch history on Crunchyroll
					</Link>{" "}
					at any time.
				</p>
				<p>
					AniDachi keeps its own record of episodes watched in rooms. Plus or
					Pro records it, and Free accounts can still open saved history and{" "}
					<Link href="/guides/resume-anime">resume</Link>.
				</p>

				<h2 id="related" className="scroll-mt-24">
					Related Guides
				</h2>
				<SeoGuideRelated
					className="divide-y-0 sm:grid sm:grid-cols-2 sm:gap-x-10 [&>li]:border-b [&>li]:border-ani-line"
					links={[
						{
							href: "/guides/best-way-to-watch-crunchyroll-with-friends",
							label: "Best way to watch Crunchyroll with friends",
						},
						{
							href: "/guides/crunchyroll-watch-party-with-discord",
							label: "Crunchyroll watch party with Discord",
						},
						{
							href: "/guides/how-to-watch-crunchyroll-on-two-screens",
							label: "Watch Crunchyroll on two screens at once",
						},
						{
							href: "/guides/crunchyroll-watch-party-not-working",
							label: "Crunchyroll watch party not working? Fixes",
						},
						{
							href: "/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing",
							label: "Watch without account sharing",
						},
						{
							href: "/guides/best-teleparty-alternatives-for-anime",
							label: "Best Teleparty alternatives for anime",
						},
						{
							href: "/watch-crunchyroll-together-long-distance",
							label: "Watch Crunchyroll together long distance",
						},
						{
							href: "/watch-anime-together",
							label: "Watch anime together",
						},
						{
							href: "/virtual-movie-night",
							label: "Virtual movie night",
						},
					]}
				/>
			</HubLandingLayout>
		</>
	);
}
