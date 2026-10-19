import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryPreview } from "./library-preview";
import "../../account/account.css";
import "../../account/social.css";
import "../../account/watch-library/history-browser.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Local empty library preview",
  robots: { index: false, follow: false },
};
export default function LibraryPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <LibraryPreview />;
}
