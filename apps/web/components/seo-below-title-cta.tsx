import { Children, isValidElement, type ReactNode } from "react";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { SeoGuideAnswer, SeoGuideTitle } from "@/components/seo-guide-blocks";
import type { PageTemplateId } from "@/lib/conversion-events";

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

/** Keep the introduction or short-answer block together before the install CTA. */
export function SeoBelowTitleCta({
  children,
  pagePath,
  pageTemplate,
}: {
  children: ReactNode;
  pagePath: string;
  pageTemplate: PageTemplateId;
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
      <PrimaryCheckoutCta
        pagePath={pagePath}
        pageTemplate={pageTemplate}
        placement="content_above_fold"
        className="!mt-0 mb-6"
      />
      {arr.slice(insertAt)}
    </>
  );
}
