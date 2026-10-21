import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideBulletList,
	SeoGuideNote,
	SeoGuideRelated,
	SeoGuideSteps,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/guides/discord-watch-together";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const SOURCES = [
	{
		href: "https://support-apps.discord.com/hc/en-us/articles/26502500234519-Watch-Together-FAQ",
		label: "Discord: Watch Together FAQ",
	},
	{
		href: "https://support-apps.discord.com/hc/en-us/articles/26593412574359-How-to-Use-Apps",
		label: "Discord: How to Use Apps",
	},
];

const activitySteps = [
	{
		name: "Join a voice call",
		text: "Join a voice channel in your server, or start a call in a DM or group DM. On desktop, Discord asks you to turn on Hardware Acceleration in User Settings > Advanced before starting any Activity.",
	},
	{
		name: "Open the App Launcher",
		text: "Press the App Launcher button at the bottom of the call and choose Watch Together. The first time, Discord asks you to authorize the Activity.",
	},
	{
		name: "Add videos to the playlist",
		text: "Search YouTube from the Activity's search bar, or paste a YouTube link, and press + to add it. Videos play in playlist order.",
	},
	{
		name: "Bring your friends in",
		text: "Friends in the same voice call join the Activity you started. Each of them authorizes it the first time they use it.",
	},
	{
		name: "Choose Hosting or Sharing",
		text: "You start as host and control play, pause, skipping and order. Switch to Sharing mode if you want everyone to control playback; on mobile, use the lock button in the Playlist tab.",
	},
];

export const metadata: Metadata = {
	title: "Discord Watch Together: How It Works and Limits",
	description:
		"Discord Watch Together plays YouTube in a voice call. How to start it, Hosting vs Sharing, the 180-minute limit, and what to use for Crunchyroll or Netflix.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Discord Watch Together: How It Works and Limits",
		description:
			"Start Discord's Watch Together activity, understand its YouTube-only limits, and know when to use a watchroom instead.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Discord Watch Together: How It Works and Limits",
		description: "Discord's YouTube activity: setup, limits and alternatives.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "What is Discord Watch Together?",
		answer:
			"It's Discord's built-in Activity for watching YouTube with others in a voice call, DM or group DM. Everyone can add videos to a shared playlist, and Discord keeps playback in sync, so nobody has to count down to pressing play.",
	},
	{
		question: "How do you start Watch Together on Discord?",
		answer:
			"Join a voice call, press the App Launcher button at the bottom of the call, choose Watch Together and authorize it. Then search YouTube or paste a link to add videos. Friends in the same call join the Activity.",
	},
	{
		question: "Can you watch Netflix or Crunchyroll on Discord Watch Together?",
		answer:
			"No. Discord describes Watch Together as a way to watch YouTube videos, played through YouTube's embedded player. For Crunchyroll or Netflix, keep the Discord call for voice and sync each person's own player with AniDachi in desktop Chrome.",
	},
	{
		question: "Why does Discord Watch Together stop playing?",
		answer:
			"Discord limits playback to 180 minutes when watching with a group, or 30 minutes alone, then starts a 10-minute cool-down. Sessions also pause after 30 minutes without any interaction with the Activity.",
	},
	{
		question: "Why do I see ads in Watch Together with YouTube Premium?",
		answer:
			"Watch Together uses YouTube's embedded player and doesn't support signing in to your YouTube account during the Activity, so YouTube Premium benefits don't apply.",
	},
	{
		question: "Why can't I hear the video in Watch Together?",
		answer:
			"The Activity plays sound through your operating system's audio output, which may differ from the device Discord uses for voice. Change the system output in the taskbar on Windows or System Settings on a Mac.",
	},
	{
		question: "Why don't I see Watch Together in my server?",
		answer:
			"A server admin may have turned off the Use Activities permission for your role, the channel or its category. Some Activities are also unavailable in certain regions.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "what-it-does", label: "What it does and doesn't do", level: 2 },
	{ id: "setup", label: "How to start it", level: 2 },
	{ id: "hosting", label: "Hosting vs Sharing", level: 2 },
	{ id: "limits", label: "Limits and fixes", level: 2 },
	{ id: "instead", label: "When to use AniDachi instead", level: 2 },
	{ id: "sources", label: "Sources", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordWatchTogetherPage() {
	return (
		<>
			<HowToJsonLd
				name="How to start Discord Watch Together"
				description="Start Discord's Watch Together activity in a voice call and build a shared YouTube playlist."
				steps={activitySteps}
			/>
			<SeoPageLayout
				breadcrumbs={[
					{ name: "Home", url: "/" },
					{ name: "Discord watch party", url: "/discord-watch-party" },
					{ name: "Discord Watch Together", url: PAGE_PATH },
				]}
				title="Discord Watch Together"
				description="How Discord's Watch Together activity works, its YouTube-only limits, and when to use a synced watchroom instead."
				url={PAGE_PATH}
				datePublished="2026-09-27"
				dateModified="2026-10-20"
				faq={faq}
				headings={tocHeadings}
				articleImage={articleImage}
				aboveFoldCta
			>
				<SeoGuideTitle>Discord Watch Together: How It Works and Its Limits</SeoGuideTitle>
				<h2 id="answer" className="scroll-mt-24">
					Short answer
				</h2>
				<SeoGuideAnswer>
					<p>
						<strong>
							Discord Watch Together is a built-in Activity for watching
							YouTube in a voice call or DM. Everyone adds videos to a shared
							playlist and Discord keeps playback in sync. It only plays
							YouTube, through the embedded player, without your YouTube
							login, and stops after 180 minutes per person in a group.
						</strong>{" "}
						For Crunchyroll or Netflix you need a different setup.
					</p>
				</SeoGuideAnswer>

				<h2
					id="what-it-does"
					className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					What Watch Together does, and what it doesn&apos;t
				</h2>
				<p className="mb-4 leading-relaxed text-ani-muted">
					Watch Together is one of Discord&apos;s Activities: small apps that
					open in a window inside Discord. Discord&apos;s own FAQ describes it
					as &quot;a collaborative way to watch YouTube videos with
					others.&quot; Here is how that plays out in practice.
				</p>
				<ResponsiveCompareTable
					columns={[
						{ id: "does", label: "Watch Together" },
					]}
					rows={[
						{ feature: "Plays YouTube videos", values: { does: "yes" } },
						{ feature: "Shared playlist anyone can add to", values: { does: "yes" } },
						{ feature: "Syncs play and pause for everyone", values: { does: "yes" } },
						{ feature: "Works in server voice channels, DMs and group DMs", values: { does: "yes" } },
						{ feature: "Desktop and mobile", values: { does: "yes" } },
						{ feature: "Sign in to your YouTube account", values: { does: "no" } },
						{ feature: "YouTube Premium (no ads)", values: { does: "no" } },
						{ feature: "Netflix, Crunchyroll or other services", values: { does: "no" } },
						{ feature: "Unlimited playback", values: { does: "180 min per person in a group" } },
						{ feature: "Interface languages", values: { does: "English only" } },
					]}
				/>
				<p className="mb-8 leading-relaxed text-ani-muted">
					Volume is always local, so turning the video down or muting it
					affects only you. Your search history inside the Activity is saved on
					your device and only you can see it. Neither of those is a problem
					for a casual playlist night. The YouTube-only rule and the time limit
					are what decide whether it fits your plans.
				</p>

				<h2 id="setup" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
					How to start Watch Together on Discord
				</h2>
				<p className="mb-4 leading-relaxed text-ani-muted">
					These steps follow Discord&apos;s help pages. The mobile app has an
					App Launcher button too, and the playlist works the same way.
				</p>
				<SeoGuideSteps steps={activitySteps} />

				<h2 id="hosting" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
					Hosting vs Sharing mode
				</h2>
				<p className="mb-4 leading-relaxed text-ani-muted">
					Whoever starts Watch Together is the host. In <strong>Hosting</strong>{" "}
					mode the host controls playing, pausing, scrubbing, skipping and the
					playlist order, and can delete any video. Everyone else can still add
					videos and remove the ones they added. In <strong>Sharing</strong>{" "}
					mode everyone controls the playlist and the video, and whatever one
					person does applies to all.
				</p>
				<p className="mb-8 leading-relaxed text-ani-muted">
					Discord recommends Hosting for big groups and Sharing for small ones.
					In a big group in Sharing mode, it only takes one person to skip the
					video everyone was watching. If the host hits the playback limit,
					Discord hands host to someone who still has time left, and the
					original host doesn&apos;t get it back when the cool-down ends.
				</p>

				<h2 id="limits" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
					Limits and quick fixes
				</h2>
				<SeoGuideBulletList
					items={[
						{
							title: "It stops after a while",
							body: "Playback is limited to 180 minutes per person with a group, or 30 minutes alone, followed by a 10-minute cool-down. The timer follows you across servers and calls. A session also pauses after 30 minutes without interaction.",
						},
						{
							title: "You see ads despite YouTube Premium",
							body: "The embedded player doesn't support your YouTube login, so Premium benefits don't apply inside the Activity.",
						},
						{
							title: "You hear friends but not the video",
							body: "Watch Together plays through your operating system's audio output. If Discord voice uses a different device, change the system output.",
						},
						{
							title: "The button is missing",
							body: "An admin may have turned off Use Activities for your role, the channel or the category. Some Activities are unavailable in certain regions.",
						},
						{
							title: "It won't start on desktop",
							body: "Discord asks you to turn on Hardware Acceleration in User Settings > Advanced before starting any Activity.",
						},
					]}
				/>
				<SeoGuideNote>
					Watch Together is different from screen sharing. If you share a
					browser tab with Go Live instead, everyone watches one person&apos;s
					upload, and protected players like Netflix and Crunchyroll usually
					show a{" "}
					<Link href="/guides/discord-screen-share-black-screen">
						black screen on Discord
					</Link>
					.
				</SeoGuideNote>

				<h2 id="instead" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
					When to use AniDachi instead of Watch Together
				</h2>
				<p className="mb-4 leading-relaxed text-ani-muted">
					Watch Together is good at one thing: a YouTube playlist inside
					Discord, on any device, with nothing to install. Keep using it for
					that. It stops being the right tool when the video isn&apos;t a
					YouTube clip:
				</p>
				<SeoGuideBulletList
					items={[
						{
							title: "Anime on Crunchyroll",
							body: (
								<>
									The Activity can&apos;t open Crunchyroll. Each person opens the
									episode on their own account and AniDachi keeps the players
									together. See{" "}
									<Link href="/guides/how-to-watch-anime-with-friends-on-discord">
										how to watch anime with friends on Discord
									</Link>
									.
								</>
							),
						},
						{
							title: "Netflix movies and episodes",
							body: (
								<>
									Same idea, on Netflix watch pages. The Discord side is covered in{" "}
									<Link href="/guides/how-to-screen-share-netflix-on-discord">
										how to stream Netflix on Discord
									</Link>
									.
								</>
							),
						},
						{
							title: "Long YouTube videos or your own account",
							body: "An AniDachi room syncs the full youtube.com watch page, so each person is signed in to their own YouTube account (Premium included), picks their own quality, and has no 180-minute cap. Shorts, embeds and the mobile app aren't supported.",
						},
					]}
				/>
				<p className="mb-8 leading-relaxed text-ani-muted">
					AniDachi runs in desktop Chrome, not inside Discord, so the Discord
					call stays exactly where it is. A Plus, Pro or trial host creates the
					room and friends join free. To set it up,{" "}
					<InstallLink href="/extension">add AniDachi to Chrome</InstallLink>,
					open the video, and paste the room invite in the Discord chat. The
					three options side by side are on the{" "}
					<Link href="/discord-watch-party">Discord watch party</Link> page.
				</p>

				<h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
					Sources
				</h2>
				<p className="mb-8 leading-relaxed text-ani-muted">
					Discord details checked 20 Oct 2026:{" "}
					{SOURCES.map((source, index) => (
						<span key={source.href}>
							{index > 0 ? ", " : null}
							<a href={source.href} target="_blank" rel="noopener noreferrer">
								{source.label}
							</a>
						</span>
					))}
					. Watch Together is a Discord feature; AniDachi is not affiliated
					with Discord or YouTube.
				</p>

				<SeoGuideRelated
					links={[
						{ href: "/discord-watch-party", label: "Discord watch party" },
						{
							href: "/guides/youtube-watch-party-with-discord",
							label: "YouTube watch party with Discord",
						},
						{
							href: "/guides/can-you-screen-share-youtube-on-discord",
							label: "Can you screen share YouTube on Discord?",
						},
						{ href: "/guides/discord-go-live", label: "Discord Go Live" },
						{ href: "/watch-youtube-together", label: "YouTube watch party" },
					]}
				/>
			</SeoPageLayout>
		</>
	);
}
