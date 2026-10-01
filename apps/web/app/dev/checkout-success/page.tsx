import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuccessPreview } from "./success-preview";
import { SuccessFooter } from "../../success/success-content";

export const metadata: Metadata = {
	title: "Local checkout preview",
	robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CheckoutSuccessPreviewPage() {
	// No session, database or Stripe access. Deployed builds always return 404.
	if (process.env.NODE_ENV !== "development") notFound();

	return (
		<SuccessPreview>
			<SuccessFooter />
		</SuccessPreview>
	);
}
