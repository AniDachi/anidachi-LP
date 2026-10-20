import type { Metadata } from "next";
import { SectionIndexPage } from "@/components/section-index-page";
import { GLOSSARY_ENTRIES } from "@/lib/section-index";

const url = "/glossary";
const groups = [{ id: "terms", heading: "Terms", entries: GLOSSARY_ENTRIES }];

export const metadata: Metadata = {
  title: "Anime and Watch Party Glossary",
  description:
    "Plain definitions of anime and watch party terms: watchroom, simulcast, filler, OVA, shonen, dub vs sub, anime marathon and more.",
  alternates: { canonical: url },
  openGraph: {
    title: "Anime and Watch Party Glossary",
    description: "Plain definitions: watchroom, simulcast, filler, OVA, shonen, dub vs sub and more.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime and Watch Party Glossary",
    description: "Plain definitions: watchroom, simulcast, filler, OVA, shonen, dub vs sub and more.",
    images: ["/opengraph-image.png"],
  },
};

export default function GlossaryIndexPage() {
  return (
    <SectionIndexPage
      url={url}
      name="Glossary"
      heading="Anime and watch party glossary"
      summary={`Plain definitions of ${GLOSSARY_ENTRIES.length} anime and watch party terms.`}
      groups={groups}
      intro={
        <>
          <p>
            <strong>Plain definitions of {GLOSSARY_ENTRIES.length} anime and watch party terms,</strong>{" "}
            with what each one means for a group watching together.
          </p>
        </>
      }
    />
  );
}
