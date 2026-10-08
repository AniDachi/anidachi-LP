import type { ReactNode } from "react";

export function MarketingArticle({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="marketing-article min-h-screen bg-ani-canvas">
      <article className="container mx-auto max-w-3xl px-4 py-14 lg:py-20">
        <h1>{title}</h1>
        <p className="marketing-article-updated">Last updated: {updated}</p>
        <div className="marketing-article-body">{children}</div>
      </article>
    </main>
  );
}
