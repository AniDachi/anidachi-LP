import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
import { BillingClient } from "./billing-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
	title: "Subscription",
	robots: { index: false, follow: false },
};

export default async function BillingPage({
	searchParams,
}: {
	searchParams: Promise<{ billing?: string }>;
}) {
	const session = await getSession();
	if (!session) redirect("/login?next=%2Faccount%2Fbilling");
	const params = await searchParams;
	return (
		<BillingClient
			key={session.userId}
			ownerUserId={session.userId}
			returnedFromPortal={params.billing === "return"}
		/>
	);
}
