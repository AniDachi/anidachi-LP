import type { ReactNode } from "react";
import Link from "next/link";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import type { SectionGroup } from "@/lib/section-index";
import { getSeoSiteOrigin } from "@/lib/site-url";

const headingClass = "mt-12 mb-4 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";

/** Shared layout for the section index pages: an intro, then grouped link lists. */
export function SectionIndexPage({
  url,
  name,
  heading,
  summary,
  intro,
  groups,
  datePublished = "2026-10-19",
  dateModified = "2026-10-19",
}: {
  url: string;
  name: string;
  heading: string;
  /** Plain-text summary for structured data. */
  summary: string;
  intro: ReactNode;
  groups: SectionGroup[];
  datePublished?: string;
  dateModified?: string;
}) {
  const showGroupHeadings = groups.length > 1;
  const headings: TocHeading[] = showGroupHeadings
    ? groups.map((group) => ({ id: group.id, label: group.heading, level: 2 }))
    : [];
  const itemList = groups
    .flatMap((group) => group.entries)
    .map((entry, index) => ({ name: entry.label, url: entry.href, position: index + 1 }));

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name, url },
      ]}
      title={heading}
      description={summary}
      url={url}
      datePublished={datePublished}
      dateModified={dateModified}
      headings={headings}
      itemList={itemList}
      articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
    >
      <SeoGuideTitle>{heading}</SeoGuideTitle>
      <SeoGuideAnswer>{intro}</SeoGuideAnswer>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={showGroupHeadings ? group.id : undefined}>
          {showGroupHeadings ? (
            <h2 id={group.id} className={headingClass}>
              {group.heading}
            </h2>
          ) : null}
          <ul className="mb-8 space-y-3">
            {group.entries.map((entry) => (
              <li key={entry.href}>
                <Link href={entry.href} className="font-medium text-ani-progress underline-offset-4 hover:underline">
                  {entry.label}
                </Link>
                {entry.description ? (
                  <span className="text-ani-muted"> — {entry.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </SeoPageLayout>
  );
}
