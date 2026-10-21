import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { ResponsiveDataTable } from "@/components/responsive-data-table";
import {
	SeoGuideAnswer,
	SeoGuideNote,
	SeoGuideOptions,
	SeoGuideRelated,
	SeoGuideSteps,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { INSTALL_HOWTO_STEP_TEXT_VIA_HUB } from "@/lib/install-cta";

const PAGE_PATH = "/guides/crunchyroll-watch-party-chrome-extension";

const SOURCES = [
	{ href: "https://www.teleparty.com/crunchyroll", label: "Teleparty Crunchyroll page" },
	{ href: "https://www.teleparty.com/", label: "Teleparty home page" },
	{ href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
	{ href: "https://www.crunchyroll.com/premium", label: "Crunchyroll plans page" },
];

export const metadata: Metadata = {
	title: "Crunchyroll Watch Party Extension: Install & Use",
	description:
		"Install a Crunchyroll watch party Chrome extension in five steps, see each permission AniDachi asks for in plain English, and how it compares with others.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		images: [
			{
				url: "/opengraph-image.png",
				width: 1200,
				height: 630,
				alt: "AniDachi – watch anime together, in perfect sync",
			},
		],

		title: "Crunchyroll Watch Party Extension: Install & Use",
		description:
			"Install steps, the permissions explained, and how AniDachi compares with other Crunchyroll party extensions.",
		url: PAGE_PATH,
	},
};

const faq = [
	{
		question: "Is there a Crunchyroll watch party extension?",
		answer:
			"Yes. Crunchyroll has no built-in watch party, so groups use Chrome extensions. AniDachi is one: it adds a room to the Crunchyroll player in desktop Chrome, keeps everyone's own player in sync, and adds chat, voice and video. Friends join free; the host needs Plus, Pro or a trial.",
	},
	{
		question: "How do I install the Crunchyroll party extension?",
		answer:
			"Open anidachi.app/extension, follow the link to the official Chrome Web Store listing, choose Add to Chrome, then Add extension. Pin it from the puzzle-piece menu, open a Crunchyroll episode, click the AniDachi capsule on the player and sign in.",
	},
	{
		question: "Is the Crunchyroll watch party extension safe?",
		answer:
			"Check what it asks for. AniDachi's store build only gets site access to Crunchyroll, YouTube, Netflix, anidachi.app and AniDachi's own server, not every website. It reads the title, episode and playback position on those pages to sync the room. It never asks for your Crunchyroll password.",
	},
	{
		question: "Does the extension work on the Crunchyroll app or on a phone?",
		answer:
			"No. Extensions only run in a desktop browser. AniDachi supports desktop Chrome 121 or newer and Chromium Microsoft Edge. Safari, Firefox, phone browsers and the Crunchyroll mobile and TV apps cannot load it.",
	},
	{
		question: "Is Crunchyroll Party made by Crunchyroll?",
		answer:
			"Crunchyroll's plans page and Terms of Service, checked 20 Oct 2026, list no watch party feature, so party extensions, including ones with Crunchyroll in the name, are separate third-party tools. Check the publisher on the Chrome Web Store listing before installing any of them.",
	},
	{
		question: "Do my friends need the extension too?",
		answer:
			"Yes. Everyone in the room installs AniDachi on their own computer and plays the episode on their own Crunchyroll account. Guests can join on a free AniDachi account; only the person who creates the room needs Plus or Pro, including a trial.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "install", label: "Install in five steps", level: 2 },
	{ id: "first-room", label: "Start your first room", level: 2 },
	{ id: "permissions", label: "Permissions in plain English", level: 2 },
	{ id: "what-it-reads", label: "What it reads and what it doesn't", level: 2 },
	{ id: "compare", label: "Other Crunchyroll extensions", level: 2 },
	{ id: "sources", label: "Sources", level: 2 },
	{ id: "related", label: "Related guides", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

const installSteps = [
	{
		name: "Open the install page",
		text: INSTALL_HOWTO_STEP_TEXT_VIA_HUB,
	},
	{
		name: "Confirm in Chrome",
		text: "Chrome shows the sites and permissions the extension asks for. Read them (they are explained below) and choose Add extension.",
	},
	{
		name: "Pin AniDachi",
		text: "Open the puzzle-piece menu in Chrome's toolbar, find AniDachi and click the pin so the icon stays visible.",
	},
	{
		name: "Open a Crunchyroll episode",
		text: "Sign in to your own Crunchyroll account on crunchyroll.com and press play. Refresh the tab if it was open before you installed.",
	},
	{
		name: "Sign in to AniDachi",
		text: "Click the AniDachi capsule at the top-right of the player and sign in. A free account is enough to join friends.",
	},
];

const permissionRows = [
	{
		permission: "Crunchyroll, YouTube and Netflix sites",
		use: "Show the room capsule on the player, read the title, episode and position, and play, pause or seek for sync.",
	},
	{
		permission: "anidachi.app and AniDachi's server",
		use: "Sign in, create and join rooms, and send live sync, chat and call signals.",
	},
	{
		permission: "Storage",
		use: "Keep your settings, layout and current room on your computer.",
	},
	{
		permission: "Identity",
		use: "Open Chrome's sign-in window for your AniDachi account.",
	},
	{
		permission: "Cookies",
		use: "Check whether you are already signed in on anidachi.app, so you don't sign in twice.",
	},
	{
		permission: "Notifications",
		use: "Show room invite alerts from friends. You can switch alerts off in the extension's settings.",
	},
	{
		permission: "Alarms",
		use: "Schedule small background retries, such as finishing a room exit after a dropped connection.",
	},
	{
		permission: "Clipboard (write)",
		use: "Copy the room invite link when you press copy.",
	},
];

export default function CrunchyrollExtensionsPage() {
	const relatedGuideLinks = getGuideLinks({
		includeTags: ["pillar-watch-crunchyroll"],
		excludeHref: PAGE_PATH,
		limit: 4,
	});

	return (
		<>
			<HowToJsonLd
				name="How to install a Crunchyroll watch party Chrome extension"
				description="Add AniDachi from the official Chrome Web Store listing, pin it, open a Crunchyroll episode and sign in from the player."
				steps={installSteps}
			/>
			<SeoPageLayout
				breadcrumbs={[
					{ name: "Home", url: "/" },
					{
						name: "Watch Crunchyroll Together",
						url: "/watch-crunchyroll-together",
					},
					{
						name: "Crunchyroll Watch Party Extension",
						url: PAGE_PATH,
					},
				]}
				title="Crunchyroll watch party extension: install and use"
				description="Install steps, permissions in plain English, and how AniDachi compares with other Crunchyroll party extensions."
				url={PAGE_PATH}
				datePublished="2026-04-23"
				dateModified="2026-10-20"
				faq={faq}
				headings={tocHeadings}
				aboveFoldCta
			>
				<SeoGuideTitle>
					Crunchyroll Watch Party Extension: Install and Use
				</SeoGuideTitle>

				<h2 id="answer" className="scroll-mt-24">
					Short answer
				</h2>
				<SeoGuideAnswer>
					<strong>
						Crunchyroll has no built-in watch party, so you add one with a
						Chrome extension. AniDachi installs from the Chrome Web Store in
						about a minute, sits on the Crunchyroll player in desktop Chrome,
						and syncs each friend&apos;s own Crunchyroll stream. It only asks
						for access to Crunchyroll, YouTube, Netflix and AniDachi&apos;s
						own sites.
					</strong>
				</SeoGuideAnswer>

				<p className="text-foreground/80 leading-relaxed mb-6">
					This page is the practical walkthrough: what to click, what Chrome
					will ask you, and what each permission is for. If you are still
					deciding whether you need an extension at all, the{" "}
					<Link href="/watch-crunchyroll-together" className="text-brand-orange hover:underline">
						Crunchyroll watch party guide
					</Link>{" "}
					compares the extension route with Discord and countdown methods.
				</p>

				<h2
					id="install"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					Install in five steps
				</h2>
				<p className="text-foreground/80 leading-relaxed mb-4">
					Use a computer. Extensions run in desktop Chrome 121 or newer and
					in Chromium Microsoft Edge; phones, tablets and the Crunchyroll app
					cannot load them.
				</p>
				<SeoGuideSteps steps={installSteps} />
				<p className="text-foreground/80 leading-relaxed mb-8">
					Ready?{" "}
					<InstallLink href="/extension" className="text-brand-orange hover:underline">
						Open the AniDachi install page
					</InstallLink>{" "}
					and use the Chrome Web Store link there. Install only from that
					listing; copies on other sites are not ours. Chrome Web Store
					installs update on their own, usually after a browser restart.
				</p>

				<h2
					id="first-room"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					Start your first room
				</h2>
				<p className="text-foreground/80 leading-relaxed mb-4">
					Installing is the same for everyone. What happens next depends on
					whether you host or join.
				</p>
				<SeoGuideOptions
					options={[
						{
							title: "If you host",
							body: (
								<>
									With the episode playing, open the capsule and choose Create
									room, then copy the invite. Creating rooms needs Plus or Pro,
									including the 3-day trial for eligible accounts; see{" "}
									<Link href="/pricing">AniDachi pricing</Link>. You control
									play, pause, seek and the episode for the whole room.
								</>
							),
							highlight: true,
						},
						{
							title: "If you join",
							body: "Open the invite link in desktop Chrome with your own Crunchyroll account signed in. A free AniDachi account is enough. While you are in the room, AniDachi moves your tab to the host's episode and keeps it there.",
						},
						{
							title: "During the episode",
							body: "Chat from the player, send quick reactions, and turn on your microphone or camera if the host gives you a seat. Push-to-talk is the default: hold V to talk.",
						},
					]}
				/>
				<p className="text-foreground/80 leading-relaxed mb-8">
					Plus rooms hold up to 6 people and Pro rooms up to 15, host
					included. For a full first-night plan, read{" "}
					<Link
						href="/guides/how-to-host-a-crunchyroll-watch-party"
						className="text-brand-orange hover:underline"
					>
						how to host a Crunchyroll watch party
					</Link>
					. If something goes wrong, the{" "}
					<Link
						href="/guides/crunchyroll-watch-party-not-working"
						className="text-brand-orange hover:underline"
					>
						Crunchyroll watch party troubleshooting guide
					</Link>{" "}
					lists every message the extension shows.
				</p>

				<h2
					id="permissions"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					Permissions in plain English
				</h2>
				<p className="text-foreground/80 leading-relaxed mb-4">
					When you choose Add to Chrome, Chrome lists the sites and features
					the extension wants. This is the full list for the AniDachi store
					build, and what each item is used for:
				</p>
				<ResponsiveDataTable
					titleKey="permission"
					columns={[
						{ key: "permission", label: "Permission" },
						{ key: "use", label: "What AniDachi uses it for" },
					]}
					rows={permissionRows}
				/>
				<p className="text-foreground/80 leading-relaxed mb-8">
					What is not on the list matters too. The store build does not ask
					to read every website you visit, and it does not request access to
					your downloads or files. Broad site access exists only in our
					internal development builds, which are never published. The{" "}
					<Link href="/security" className="text-brand-orange hover:underline">
						security page
					</Link>{" "}
					describes how accounts and room data are handled.
				</p>

				<h2
					id="what-it-reads"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					What it reads and what it doesn&apos;t
				</h2>
				<p className="text-foreground/80 leading-relaxed mb-4">
					On a Crunchyroll episode page, AniDachi reads which episode is
					open, where the player is, and whether it is playing. That is what
					it needs to keep the room aligned and to send a guest&apos;s tab to
					the host&apos;s episode. It does not ask for your Crunchyroll
					password, and it does not capture or relay the video: each person
					gets the picture straight from Crunchyroll under their own plan.
				</p>
				<p className="text-foreground/80 leading-relaxed mb-8">
					Personal watch history is separate and optional. It records your
					progress to your AniDachi account only when you turn recording on
					and have your own Plus or Pro access. Saved history and Resume stay
					available on a free account.
				</p>
				<SeoGuideNote>
					Because every viewer streams from their own account, everyone needs
					Crunchyroll access that can play the chosen episode in their region.
					The extension cannot unlock an episode for a friend. See{" "}
					<Link href="/guides/does-everyone-need-crunchyroll-premium-for-watch-party">
						does everyone need Crunchyroll Premium
					</Link>
					.
				</SeoGuideNote>

				<h2
					id="compare"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					How it compares with other Crunchyroll extensions
				</h2>
				<p className="text-foreground/80 leading-relaxed mb-4">
					Several third-party tools add a party to Crunchyroll. None of them
					is a Crunchyroll feature: Crunchyroll&apos;s own plans page and terms
					list no watch party. The short version:
				</p>
				<SeoGuideOptions
					options={[
						{
							title: "AniDachi",
							body: "Crunchyroll, YouTube and Netflix rooms in desktop Chrome. Synced players, on-player chat and reactions, voice and video calls. Host needs Plus, Pro or a trial; friends join free.",
							highlight: true,
						},
						{
							title: "Teleparty",
							body: "Teleparty's Crunchyroll page says hosting a Crunchyroll party needs Teleparty Premium, with a free trial, and that guests join free; its support FAQ says voice and video chat need Premium too. It also covers other services such as Disney+ and Hulu, which AniDachi does not.",
						},
						{
							title: "Crunchyroll Party and similar extensions",
							body: (
								<>
									Smaller extensions built mainly around live sync and text
									chat. Features and upkeep differ between them; check the
									publisher and last update date on the store listing. Our
									side-by-side is{" "}
									<Link href="/compare/anidachi-vs-crunchyroll-party">
										AniDachi vs Crunchyroll Party
									</Link>
									.
								</>
							),
						},
					]}
				/>
				<p className="text-foreground/80 leading-relaxed mb-8">
					Pick AniDachi when you want to see and hear each other while you
					watch, or your group also watches YouTube or Netflix together. Pick
					Teleparty when someone needs Disney+ or Hulu. Full table:{" "}
					<Link href="/compare/anidachi-vs-teleparty" className="text-brand-orange hover:underline">
						AniDachi vs Teleparty
					</Link>
					.
				</p>

				<h2
					id="sources"
					className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
				>
					Sources
				</h2>
				<p className="text-foreground/80 mb-8">
					Permissions are taken from the AniDachi store build. Third-party
					details checked 20 Oct 2026:{" "}
					{SOURCES.map((source, index) => (
						<span key={source.href}>
							{index > 0 ? ", " : null}
							<a
								href={source.href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-brand-orange hover:underline"
							>
								{source.label}
							</a>
						</span>
					))}
					. AniDachi is not affiliated with Crunchyroll or Teleparty.
				</p>

				<h2 id="related" className="scroll-mt-24">
					Related guides
				</h2>
				<SeoGuideRelated
					links={[
						{ href: "/watch-crunchyroll-together", label: "Crunchyroll watch party guide" },
						{
							href: "/guides/how-to-watch-crunchyroll-with-friends",
							label: "How to watch Crunchyroll with friends",
						},
						{ href: "/guides/chrome-watch-party", label: "Chrome watch party" },
						{ href: "/compare/anidachi-vs-crunchyroll-party", label: "AniDachi vs Crunchyroll Party" },
						...relatedGuideLinks
							.filter(
								(g) =>
									![
										"/watch-crunchyroll-together",
										"/guides/how-to-watch-crunchyroll-with-friends",
										"/guides/chrome-watch-party",
										"/compare/anidachi-vs-crunchyroll-party",
									].includes(g.href),
							)
							.map((g) => ({ href: g.href, label: g.label })),
					]}
				/>
			</SeoPageLayout>
		</>
	);
}
