import { Children, isValidElement, type ReactNode } from "react";
import { HubHero } from "@/components/hub-hero";
import { PrimaryCheckoutCta, type CtaCopyKey } from "@/components/primary-checkout-cta";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import type { PageTemplateId } from "@/lib/conversion-events";
import type { PageLocale } from "@/lib/locale/ui-strings";

function isParagraphElement(child: ReactNode): boolean {
  return isValidElement(child) && child.type === "p";
}

function isDateMetaParagraph(child: ReactNode): boolean {
  if (!isValidElement(child)) return false;
  const className =
    typeof child.props === "object" &&
    child.props !== null &&
    "className" in child.props &&
    typeof (child.props as { className?: string }).className === "string"
      ? (child.props as { className: string }).className
      : "";
  return className.includes("text-xs");
}

/** Guide copy for the hub-style install block (ANI-64). Supported platforms only. */
export const GUIDE_HERO_LEAD =
  "Watch Crunchyroll, YouTube or Netflix together in sync, each on your own player.";
export const GUIDE_HERO_FINE_PRINT = "20 free minutes a day. Friends join free.";

/**
 * Keep the introduction or short-answer block together before the install CTA.
 * `style="hero"` swaps the card for the hubs' install block (one button, platform links,
 * joined count), which desktop visitors click far more often (ANI-64).
 */
export function SeoBelowTitleCta({
  children,
  pagePath,
  pageTemplate,
  ctaCopy,
  locale = "en",
  style = "card",
}: {
  children: ReactNode;
  pagePath: string;
  pageTemplate: PageTemplateId;
  ctaCopy?: CtaCopyKey;
  locale?: PageLocale;
  style?: "card" | "hero";
}) {
  const arr = Children.toArray(children);
  let insertAt = Math.min(2, arr.length);

  const h1Index = arr.findIndex(
    (child) => isValidElement(child) && (child.type === "h1" || child.type === SeoGuideTitle)
  );

  if (h1Index >= 0) {
    for (let i = h1Index + 1; i < arr.length; i++) {
      const child = arr[i];
      if (
        (isValidElement(child) && child.type === SeoGuideAnswer) ||
        (isParagraphElement(child) && !isDateMetaParagraph(child))
      ) {
        insertAt = i + 1;
        break;
      }
    }
  }

  return (
    <>
      {arr.slice(0, insertAt)}
      {style === "hero" ? (
        <HubHero
          pagePath={pagePath}
          lead={GUIDE_HERO_LEAD}
          finePrint={GUIDE_HERO_FINE_PRINT}
          demoHref={null}
          worksOn={["Crunchyroll", "YouTube", "Netflix"]}
          placement="guide_hero"
          ctaVariant="guide_hero_install"
          locale={locale}
          className="-mt-4"
        />
      ) : (
        <PrimaryCheckoutCta
          pagePath={pagePath}
          pageTemplate={pageTemplate}
          placement="content_above_fold"
          variant={ctaCopy}
          locale={locale}
          className="!mt-0 mb-6"
        />
      )}
      {arr.slice(insertAt)}
    </>
  );
}
