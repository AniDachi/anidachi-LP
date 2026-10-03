import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillingPreview } from "./billing-preview";
import "../../account/account.css";
import "../../account/social.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
	title: "Local subscription preview",
	robots: { index: false, follow: false },
};
export default function BillingPreviewPage() {
	if (process.env.NODE_ENV !== "development") notFound();
	return <BillingPreview />;
}
