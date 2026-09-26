import type { ReactNode } from "react";
import Link from "next/link";
import { FAQSection, type FAQItem } from "@/components/faq-section";
import {
  BreadcrumbJsonLd,
  ArticleJsonLd,
  FAQPageJsonLd,
  ItemListJsonLd,
} from "@/components/json-ld";
import { TableOfContents, type TocHeading } from "@/components/table-of-contents";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { SeoBelowTitleCta } from "@/components/seo-below-title-cta";
import { SocialProof } from "@/components/social-proof";
import type { PageTemplateId } from "@/lib/conversion-events";
import { inferPageTemplateFromPath } from "@/lib/conversion-events";

export type { TocHeading };

export interface SeoPageLayoutProps {
  breadcrumbs: { name: string; url: string }[];
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  faq?: FAQItem[];
  headings?: TocHeading[];
  itemList?: { name: string; url: string; position: number }[];
  aboveFoldCta?: boolean;
  /** Override autodetected template (from `url`) for conversion analytics + CTA copy */
  conversionTemplate?: PageTemplateId;
  /** Primary image URL(s) for Article JSON-LD (absolute URLs preferred). */
  articleImage?: string | string[];
  /** Optional CTA or promo block between main content and bottom checkout CTA (e.g. after intro on long guides) */
  midContentSlot?: ReactNode;
  /** FAQ items open by default (defaults to pricing/refund question index 4 when FAQ present) */
  faqDefaultOpenIndexes?: number[];
  /**
   * Show organizational accountability line (dates + link to About / Editorial Policy).
   * Defaults to true. Set false only for pages that already render equivalent meta.
   */
  showEditorialByline?: boolean;
  children: React.ReactNode;
}

function formatIsoDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function SeoPageLayout({
  breadcrumbs,
  title,
  description,
  url,
  datePublished,
  dateModified,
  faq,
  headings,
  itemList,
  aboveFoldCta,
  conversionTemplate,
  articleImage,
  midContentSlot,
  faqDefaultOpenIndexes,
  showEditorialByline = true,
  children,
}: SeoPageLayoutProps) {
  const hasToc = headings && headings.length > 0;
  const pageTemplate = conversionTemplate ?? inferPageTemplateFromPath(url);

  const editorialByline = showEditorialByline ? (
    <p className="not-prose mt-8 border-t border-ani-line pt-4 text-xs leading-relaxed text-ani-muted">
      Published {formatIsoDate(datePublished)}
      {dateModified !== datePublished
        ? ` · Updated ${formatIsoDate(dateModified)}`
        : null}
      {" · "}
      By{" "}
      <Link href="/about" className="text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary">
        AniDachi
      </Link>
      {" · "}
      <Link
        href="/editorial-policy"
        className="text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
      >
        Editorial policy
      </Link>
    </p>
  ) : null;

  const articleBody = (
    <div className="seo-prose">
      {aboveFoldCta ? (
        <SeoBelowTitleCta pagePath={url} pageTemplate={pageTemplate}>
          {children}
        </SeoBelowTitleCta>
      ) : (
        children
      )}
      {midContentSlot ? <div className="not-prose">{midContentSlot}</div> : null}
      {editorialByline}
      <div className="not-prose mt-8">
        <PrimaryCheckoutCta
          pagePath={url}
          pageTemplate={pageTemplate}
          placement="content_bottom"
        />
      </div>
    </div>
  );

  return (
    <>
      <main
        id="main-content"
        className="min-h-screen bg-ani-canvas"
      >
        <nav
          aria-label="Breadcrumb"
          className="border-b border-ani-line bg-ani-canvas"
        >
          <div className="container mx-auto px-4 py-3.5">
            <ol className="flex flex-wrap items-center gap-2 text-sm tracking-[-0.01em] text-ani-muted">
              {breadcrumbs.map((crumb, i) => (
                <li key={crumb.url} className="flex items-center gap-2">
                  {i > 0 && (
                    <span className="text-ani-line" aria-hidden="true">
                      /
                    </span>
                  )}
                  {i < breadcrumbs.length - 1 ? (
                    <Link
                      href={crumb.url}
                      className="transition-colors duration-200 hover:text-ani-text"
                    >
                      {crumb.name}
                    </Link>
                  ) : (
                    <span className="max-w-[min(100%,12rem)] truncate font-medium text-ani-text sm:max-w-xs md:max-w-md">
                      {crumb.name}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </nav>

        {hasToc ? (
          <div className="container mx-auto max-w-6xl px-4 py-10 lg:py-16">
            <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
              <aside
                className="order-1 w-full flex-shrink-0 lg:order-2 lg:w-64"
                aria-label="Table of contents"
              >
                <TableOfContents headings={headings!} />
              </aside>
              <article className="order-2 min-w-0 flex-1 max-w-3xl lg:order-1 lg:max-w-none">
                {articleBody}
              </article>
            </div>
          </div>
        ) : (
          <article className="container mx-auto max-w-3xl px-4 py-10 lg:py-16">
            {articleBody}
          </article>
        )}

        {faq && faq.length > 0 && (
          <>
            <SocialProof />
            <FAQSection
              questions={faq}
              defaultOpenIndexes={faqDefaultOpenIndexes ?? [0]}
            />
          </>
        )}
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
      {itemList && itemList.length > 0 && (
        <ItemListJsonLd name={title} items={itemList} />
      )}
    </>
  );
}
