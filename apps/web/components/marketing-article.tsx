import type { ReactNode } from "react";
import { BreadcrumbJsonLd } from "@/components/json-ld";

export function MarketingArticle({
  title,
  updated,
  path,
  children,
}: {
  title: string;
  updated: string;
  /** Page path, for the BreadcrumbList structured data (Home → this page). */
  path: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="marketing-article min-h-screen bg-ani-canvas">
      <BreadcrumbJsonLd items={[{ name: "Home", url: "/" }, { name: title, url: path }]} />
      <article className="container mx-auto max-w-3xl px-4 py-14 lg:py-20">
        <h1>{title}</h1>
        <p className="marketing-article-updated">Last updated: {updated}</p>
        <div className="marketing-article-body">{children}</div>
      </article>
    </main>
  );
}
