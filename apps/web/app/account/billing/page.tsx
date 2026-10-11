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
	searchParams: Promise<{
		billing?: string;
		trial_setup?: string;
		trial_setup_cancel?: string;
	}>;
}) {
	const params = await searchParams;
	const setupId = params.trial_setup ?? params.trial_setup_cancel;
	const validSetupId =
		typeof setupId === "string" &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			setupId,
		)
			? setupId
			: undefined;
	const session = await getSession();
	if (!session) {
		const next = validSetupId
			? `/account/billing?${params.trial_setup ? "trial_setup" : "trial_setup_cancel"}=${validSetupId}`
			: "/account/billing";
		redirect(`/login?next=${encodeURIComponent(next)}`);
	}
	// Explicit SPA navigation starts its API read at click time. Direct document
	// requests get an authenticated SSR snapshot instead of a hydration waterfall.
	const clientNavigation = (await headers()).get("rsc") === "1";
	const initial =
		validSetupId || params.billing === "return" || clientNavigation
			? undefined
			: await loadBillingSnapshot(session.userId, {
					websiteUser: async () =>
						resolveWebsiteSession(
							(await cookies()).get(REFRESH_TOKEN_COOKIE)?.value,
						),
					overview: (userId) => createBillingService().overview(userId),
				}).catch(() => undefined);

	return (
		<BillingClient
			key={session.userId}
			ownerUserId={session.userId}
			initial={initial}
			returnedFromPortal={params.billing === "return"}
			trialSetupReturn={
				validSetupId
					? { operationId: validSetupId, canceled: !params.trial_setup }
					: undefined
			}
		/>
	);
}
