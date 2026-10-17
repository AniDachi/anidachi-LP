import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrialStartView } from "../../checkout/trial-start-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
	title: "Local trial start preview",
	robots: { index: false, follow: false },
};

export default async function TrialStartPreviewPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	if (process.env.NODE_ENV !== "development") notFound();
	const params = await searchParams;
	return (
		<>
			<TrialStartView
				selection={{
					plan: params.plan === "pro" ? "pro" : "plus",
					billing: params.billing === "yearly" ? "yearly" : "monthly",
				}}
			/>
			<aside className="bg-ani-canvas px-6 pb-4 text-center text-xs text-ani-muted">
				Local preview · trial activation is disabled
			</aside>
		</>
	);
}
