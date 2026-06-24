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
import { StickyMobileCheckoutBar } from "@/components/sticky-mobile-checkout-bar";
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
  children: React.ReactNode;
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
  children,
}: SeoPageLayoutProps) {
  const hasToc = headings && headings.length > 0;
  const pageTemplate = conversionTemplate ?? inferPageTemplateFromPath(url);
  const showStickyBar = Boolean(aboveFoldCta || hasToc || (faq && faq.length > 0));

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
      <main id="main-content" className="min-h-screen bg-background">
        <nav aria-label="Breadcrumb" className="border-b border-brand-border bg-brand-surface">
          <div className="container mx-auto px-4 py-3">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-foreground/50">
              {breadcrumbs.map((crumb, i) => (
                <li key={crumb.url} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {i < breadcrumbs.length - 1 ? (
                    <Link
                      href={crumb.url}
                      className="transition-colors hover:text-brand-orange"
                    >
                      {crumb.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">
                      {crumb.name}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </nav>

        {hasToc ? (
          <div className="container mx-auto max-w-6xl px-4 py-10 lg:py-14">
            <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
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
          <article className="container mx-auto max-w-3xl px-4 py-10 lg:py-14">
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
      {showStickyBar && (
        <StickyMobileCheckoutBar pagePath={url} pageTemplate={pageTemplate} />
      )}

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
