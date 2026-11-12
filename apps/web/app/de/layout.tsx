import type { ReactNode } from "react";

/**
 * German pilot section. The root layout owns <html lang="en">, so German content is marked
 * with lang="de" here; Google reads the language from the text and the hreflang tags.
 * If German proceeds, move to route-group root layouts with a real <html lang="de">.
 */
export default function GermanLayout({ children }: { children: ReactNode }) {
  return <div lang="de">{children}</div>;
}
