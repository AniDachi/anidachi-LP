import { Children, isValidElement, type ReactNode } from "react";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
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

/** Inserts the above-fold checkout CTA after the first H1 and lede paragraph. */
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
    (child) => isValidElement(child) && child.type === "h1"
  );

  if (h1Index >= 0) {
    for (let i = h1Index + 1; i < arr.length; i++) {
      const child = arr[i];
      if (isParagraphElement(child) && !isDateMetaParagraph(child)) {
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
