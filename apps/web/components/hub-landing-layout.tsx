import type { ReactNode } from "react";
import { FAQSection, type FAQItem } from "@/components/faq-section";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
  ItemListJsonLd,
} from "@/components/json-ld";
import { HomeSectionHeader } from "@/components/home-section-header";
import { InstallLink } from "@/components/install-link";
import { HubHero } from "@/components/hub-hero";
import { LazyExtensionDemo } from "@/components/lazy-extension-demo";
import { type SeoGuideStep } from "@/components/seo-guide-blocks";
import { EditorialByline, SeoBreadcrumbNav } from "@/components/seo-page-layout";
import { StoreReviews } from "@/components/store-reviews";
import type { TocHeading } from "@/components/table-of-contents";
import { CHROME_WEB_STORE_URL, INSTALL_HOWTO_STEP_TEXT } from "@/lib/install-cta";

/** Shared first step for hub HowTo lists; rendered with a link to the Store listing. */
export const HUB_INSTALL_STEP = { name: "Install AniDachi", text: INSTALL_HOWTO_STEP_TEXT };

function InstallStepText() {
  return (
    <>
      Open the{" "}
      <InstallLink
        href={CHROME_WEB_STORE_URL}
        storePlacement="hub_how_it_works"
        target="_blank"
        rel="noopener noreferrer"
      >
        official AniDachi Chrome Web Store listing
      </InstallLink>{" "}
      and choose Add to Chrome.
    </>
  );
}

export interface HubLandingLayoutProps {
  breadcrumbs: { name: string; url: string }[];
  /** Article JSON-LD headline and description. */
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  faq?: FAQItem[];
  /** "On this page" anchors. Ids must exist on the page (hero answer, steps, reading sections). */
  headings: TocHeading[];
  itemList?: { name: string; url: string; position: number }[];
  articleImage?: string | string[];
  /** The page's only H1. */
  h1: string;
  heroLead: string;
  heroFinePrint: string;
  /** Platform-specific hero button text; defaults to the site-wide install label. */
  heroCtaLabel?: string;
  /** Supported platforms, this page's first. */
  heroWorksOn?: string[];
  /** Lead-in for the platforms line; defaults to "Works on". */
  heroWorksOnLabel?: string;
  /** Short answer for featured snippets, shown right under the hero. */
  answer: ReactNode;
  steps: { id: string; heading: string; intro?: ReactNode; items: SeoGuideStep[] };
  /** The reading section: H2 sections, tables, tips, related links. */
  children: ReactNode;
}

/** Homepage-style feature cards for the hub reading section (two columns from small screens up). */
export function HubFeatureGrid({
  items,
  columns = 2,
}: {
  items: { title: string; body: ReactNode; id?: string }[];
  columns?: 2 | 3;
}) {
  return (
    <ul className={`not-prose mb-6 grid gap-4 sm:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : ""}`.trim()}>
      {items.map((item) => (
        <li key={item.title} className="rounded-[20px] border border-ani-line bg-ani-panel px-5 py-5">
          <h3
            id={item.id}
            className={`mb-2 text-base font-semibold tracking-[-0.02em] text-ani-text ${item.id ? "scroll-mt-24" : ""}`.trim()}
          >
            {item.title}
          </h3>
          <p className="text-[0.95rem] leading-relaxed text-ani-muted [&_a]:font-medium [&_a]:text-ani-text [&_a]:underline [&_a]:decoration-ani-line [&_a]:underline-offset-2">
            {item.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Platform hub template (ANI-28): the homepage's converting sequence on top (hero, demo, reviews,
 * how it works), then a centered reading section that keeps the hub's SEO depth. One H1, an H2
 * with an anchor per section, server-rendered text, and the same JSON-LD as SeoPageLayout.
 */
export function HubLandingLayout({
  breadcrumbs,
  title,
  description,
  url,
  datePublished,
  dateModified,
  faq,
  headings,
  itemList,
  articleImage,
  h1,
  heroLead,
  heroFinePrint,
  heroCtaLabel,
  heroWorksOn,
  heroWorksOnLabel,
  answer,
  steps,
  children,
}: HubLandingLayoutProps) {
  return (
    <>
      <main id="main-content" className="min-h-screen bg-ani-canvas text-ani-text">
        <SeoBreadcrumbNav breadcrumbs={breadcrumbs} />

        <section className="container mx-auto px-4 pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <h1 className="mb-5 text-balance text-4xl font-semibold tracking-[-0.035em] text-ani-text md:text-6xl md:leading-[1.05]">
              {h1}
            </h1>
            <HubHero
              pagePath={url}
              lead={heroLead}
              finePrint={heroFinePrint}
              demoHref="#product-demo"
              align="center"
              ctaLabel={heroCtaLabel}
              worksOn={heroWorksOn}
              worksOnLabel={heroWorksOnLabel}
            />
          </div>
          <div
            id="answer"
            className="mx-auto mt-14 max-w-2xl scroll-mt-24 border-t border-ani-line pt-8 text-center text-[0.95rem] leading-relaxed text-ani-muted md:mt-20 [&_a]:text-ani-text [&_a]:underline [&_a]:decoration-ani-line [&_a]:underline-offset-4 [&_strong]:font-normal [&_strong]:text-ani-text"
          >
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-ani-muted">
              Short answer
            </h2>
            <p className="text-pretty">{answer}</p>
          </div>
        </section>

        <LazyExtensionDemo />

        <StoreReviews />

        <section id={steps.id} className="scroll-mt-20 bg-ani-canvas py-16 lg:py-24">
          <div className="container mx-auto px-4">
            <HomeSectionHeader title={steps.heading} description={steps.intro} />
            <ol className="mx-auto max-w-2xl">
              {steps.items.map((step, i) => (
                <li key={step.name} className="flex gap-4 sm:gap-5">
                  <div className="flex shrink-0 flex-col items-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ani-control-border text-sm font-semibold tabular-nums text-ani-text">
                      {i + 1}
                    </span>
                    {i < steps.items.length - 1 ? (
                      <span className="my-1 w-px flex-1 bg-ani-line" aria-hidden />
                    ) : null}
                  </div>
                  <div className={i === steps.items.length - 1 ? "min-w-0 flex-1" : "min-w-0 flex-1 pb-8"}>
                    <h3 className="mb-1.5 text-lg font-semibold tracking-[-0.02em] text-ani-text">
                      {step.name}
                    </h3>
                    <div className="text-[0.95rem] leading-relaxed text-ani-muted [&_a]:font-medium [&_a]:text-ani-progress [&_a]:underline-offset-4 hover:[&_a]:underline">
                      {step.text === INSTALL_HOWTO_STEP_TEXT ? <InstallStepText /> : step.text}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="container mx-auto max-w-3xl px-4 pb-16 pt-8 lg:pb-24">
          <nav aria-label="On this page" className="not-prose mb-20 border-y border-ani-line py-6 text-center">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.12em] text-ani-muted">
              On this page
            </p>
            <ol className="flex flex-wrap justify-center gap-2">
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    className="inline-flex rounded-full border border-ani-line px-3.5 py-1.5 text-sm text-ani-muted transition-colors hover:border-ani-control-border hover:text-ani-text"
                  >
                    {heading.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="seo-prose [&>h2]:mb-6 [&>h2]:mt-24 [&>h2]:text-balance [&>h2]:text-3xl [&>h2]:leading-[1.1] [&>h2]:tracking-[-0.03em] md:[&>h2]:text-4xl [&>h2:first-child]:mt-0">
            {children}
            <EditorialByline datePublished={datePublished} dateModified={dateModified} />
          </article>
        </div>

        {faq && faq.length > 0 ? <FAQSection questions={faq} /> : null}
      </main>
      <BreadcrumbJsonLd items={breadcrumbs} />
      <ArticleJsonLd
        title={title}
        description={description}
        url={url}
        datePublished={datePublished}
        dateModified={dateModified}
        image={articleImage}
      />
      {faq && faq.length > 0 && <FAQPageJsonLd questions={faq} />}
      {itemList && itemList.length > 0 && <ItemListJsonLd name={title} items={itemList} />}
    </>
  );
}
