import type { Metadata } from "next";
import { SectionIndexPage } from "@/components/section-index-page";
import { getGuideGroups } from "@/lib/section-index";

const url = "/guides";
const groups = getGuideGroups();
const count = groups.reduce((total, group) => total + group.entries.length, 0);

export const metadata: Metadata = {
  title: "Anime Watch Party Guides and How-Tos",
  description:
    "Every AniDachi guide in one place: Crunchyroll, Netflix, YouTube and Discord watch parties, long-distance nights, and what anime to watch together.",
  alternates: { canonical: url },
  openGraph: {
    title: "Anime Watch Party Guides and How-Tos",
    description: "Every AniDachi guide: Crunchyroll, Netflix, YouTube, Discord and long-distance watch parties.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Watch Party Guides and How-Tos",
    description: "Every AniDachi guide: Crunchyroll, Netflix, YouTube, Discord and long-distance watch parties.",
    images: ["/opengraph-image.png"],
  },
};

export default function GuidesIndexPage() {
  return (
    <SectionIndexPage
      url={url}
      name="Guides"
      heading="Anime watch party guides"
      summary={`${count} guides for watching anime and shows together online, grouped by platform and plan.`}
      groups={groups}
      intro={
        <>
          <p>
            <strong>{count} guides for watching anime and shows together online,</strong>{" "}
            grouped by platform and by what you are planning. Start with the platform your group
            uses, or jump to the picks if you have not chosen a show yet.
          </p>
        </>
      }
    />
  );
}
