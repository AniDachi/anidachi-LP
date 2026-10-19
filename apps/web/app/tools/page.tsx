import type { Metadata } from "next";
import { SectionIndexPage } from "@/components/section-index-page";
import { TOOLS_ENTRIES } from "@/lib/section-index";

const url = "/tools";
const groups = [{ id: "tools", heading: "Tools", entries: TOOLS_ENTRIES }];

export const metadata: Metadata = {
  title: "Free Anime Tools: Filler Lists and Watch Orders",
  description:
    "Free anime tools: filler lists for Naruto, One Piece, Bleach and Black Clover, watch orders, a weekly Crunchyroll simulcast calendar and a random picker.",
  alternates: { canonical: url },
  openGraph: {
    title: "Free Anime Tools: Filler Lists and Watch Orders",
    description: "Filler lists, watch orders, the Crunchyroll simulcast calendar and a random anime picker.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Anime Tools: Filler Lists and Watch Orders",
    description: "Filler lists, watch orders, the Crunchyroll simulcast calendar and a random anime picker.",
    images: ["/opengraph-image.png"],
  },
};

export default function ToolsIndexPage() {
  return (
    <SectionIndexPage
      url={url}
      name="Tools"
      heading="Free anime tools"
      summary={`${TOOLS_ENTRIES.length} free tools for planning what to watch: filler lists, watch orders and more.`}
      groups={groups}
      intro={
        <>
          <p>
            <strong>{TOOLS_ENTRIES.length} free tools for planning what to watch:</strong> filler lists,
            watch orders, this week&apos;s Crunchyroll simulcast calendar and a random anime picker.
            No sign-up needed.
          </p>
        </>
      }
    />
  );
}
