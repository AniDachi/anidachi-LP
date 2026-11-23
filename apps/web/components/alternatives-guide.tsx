import type { ReactNode } from "react";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getSeoSiteOrigin } from "@/lib/site-url";
import {
  WATCH_PARTY_APPS,
  WATCH_PARTY_APPS_CHECKED_ON,
  watchPartyApps,
  watchPartySources,
  type WatchPartyAppId,
} from "@/lib/watch-party-apps";

type Section = { id: string; label: string; content: ReactNode };

/**
 * Shared layout for the "<app> alternatives" pages (ANI-44 step 4 / ANI-79): short answer,
 * a comparison table, one block per alternative, page-specific sections, when to stay,
 * sources and FAQ. Competitor facts come from lib/watch-party-apps.ts.
 */
export function AlternativesGuide({
  path,
  subject,
  alternatives,
  breadcrumbName,
  layoutTitle,
  description,
  h1,
  datePublished,
  faq,
  answer,
  sections = [],
  stay,
  extraSources = [],
  related,
}: {
  path: string;
  subject: WatchPartyAppId;
  alternatives: WatchPartyAppId[];
  breadcrumbName: string;
  layoutTitle: string;
  description: string;
  h1: string;
  datePublished: string;
  faq: { question: string; answer: string }[];
  answer: ReactNode;
  sections?: Section[];
  stay: ReactNode;
  extraSources?: { href: string; label: string }[];
  related: { href: string; label: string }[];
}) {
  const subjectApp = WATCH_PARTY_APPS[subject];
  const options = watchPartyApps(alternatives);
  const tableApps = watchPartyApps([...alternatives.slice(0, 4), subject]);
  const sources = [...watchPartySources([subject, ...alternatives]), ...extraSources];
  const headings: TocHeading[] = [
    { id: "answer", label: "Short answer", level: 2 },
    { id: "compared", label: "Compared side by side", level: 2 },
    { id: "picks", label: "The alternatives", level: 2 },
    ...sections.map((section) => ({ id: section.id, label: section.label, level: 2 as const })),
    { id: "stay", label: `When to stay on ${subjectApp.name}`, level: 2 },
    { id: "sources", label: "Sources", level: 2 },
    { id: "faq", label: "FAQ", level: 2 },
  ];

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/compare" },
        { name: breadcrumbName, url: path },
      ]}
      title={layoutTitle}
      description={description}
      url={path}
      datePublished={datePublished}
      dateModified="2026-11-23"
      faq={faq}
      headings={headings}
      itemList={options.map((app, index) => ({ name: app.name, url: app.href, position: index + 1 }))}
      articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      aboveFoldCta
      aboveFoldStyle="hero"
    >
      <SeoGuideTitle>{h1}</SeoGuideTitle>

      <h2 id="answer" className="scroll-mt-24">
        Short answer
      </h2>
      <SeoGuideAnswer>{answer}</SeoGuideAnswer>

      <h2 id="compared" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        {subjectApp.name} alternatives compared
      </h2>
      <p className="mb-4 leading-relaxed text-ani-muted">
        With every tool here, each viewer still needs their own access to the
        streaming service. The differences are where it runs, which services it
        covers, and what calls cost.
      </p>
      <ResponsiveCompareTable
        columns={tableApps.map((app) => ({
          id: app.id,
          label: app.name,
          highlight: app.id === "anidachi",
        }))}
        rows={[
          { feature: "How it runs", key: "runs" as const },
          { feature: "Phones", key: "phones" as const },
          { feature: "Netflix", key: "netflix" as const },
          { feature: "Crunchyroll", key: "crunchyroll" as const },
          { feature: "Voice and video chat", key: "calls" as const },
          { feature: "Price", key: "price" as const },
        ].map((row) => ({
          feature: row.feature,
          values: Object.fromEntries(tableApps.map((app) => [app.id, app[row.key]])),
        }))}
      />

      <h2 id="picks" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        The alternatives, and who each one suits
      </h2>
      <SeoGuideOptions
        options={options.map((app) => ({
          title: `${app.name}: ${app.tagline}`,
          highlight: app.id === "anidachi",
          body: (
            <>
              {app.summary}{" "}
              {app.href !== path ? (
                <>
                  More: <Link href={app.href}>{app.hrefLabel}</Link>.
                </>
              ) : null}
            </>
          ),
        }))}
      />

      {sections.map((section) => (
        <section key={section.id}>
          <h2 id={section.id} className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
            {section.label}
          </h2>
          {section.content}
        </section>
      ))}

      <h2 id="stay" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        When to stay on {subjectApp.name}
      </h2>
      <div className="mb-8 leading-relaxed text-ani-muted">{stay}</div>

      <h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Sources
      </h2>
      <p className="mb-8 leading-relaxed text-ani-muted">
        Competitor details come from each company&apos;s own pages, checked on{" "}
        {WATCH_PARTY_APPS_CHECKED_ON} unless a date is shown:{" "}
        {sources.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? ", " : null}
            <a href={source.href} target="_blank" rel="noopener noreferrer">
              {source.label}
            </a>
          </span>
        ))}
        . We re-check them on 21 Dec 2026. We make AniDachi and are not
        affiliated with any of the others.
      </p>

      <h2 id="related" className="scroll-mt-24">
        Related guides
      </h2>
      <SeoGuideRelated links={[{ href: "/compare", label: "Best watch party apps" }, ...related]} />
    </SeoPageLayout>
  );
}
