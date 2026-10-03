import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
import { createBillingService } from "@/lib/anidachi-auth/billing";
import { cookies, headers } from "next/headers";
import { REFRESH_TOKEN_COOKIE } from "@/lib/anidachi-auth/cookies";
import { resolveWebsiteSession } from "@/lib/anidachi-auth/website-session";
import { loadBillingSnapshot } from "@/lib/anidachi-auth/billing-snapshot";
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
  // Explicit SPA navigation starts its API read at click time. Direct document
  // requests get an authenticated SSR snapshot instead of a hydration waterfall.
  const clientNavigation = (await headers()).get("rsc") === "1";
  const initial = params.billing === "return" || clientNavigation ? undefined : await loadBillingSnapshot(session.userId, {
    websiteUser: async () => resolveWebsiteSession((await cookies()).get(REFRESH_TOKEN_COOKIE)?.value),
    overview: userId => createBillingService().overview(userId),
  }).catch(() => undefined);

	return (
		<BillingClient
			key={session.userId}
			ownerUserId={session.userId}
      initial={initial}
			returnedFromPortal={params.billing === "return"}
		/>
	);
}
