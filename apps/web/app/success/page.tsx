import type { Metadata } from "next";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getSession } from "@/lib/anidachi-auth/session";
import { SuccessPageFrame, SuccessFooter } from "./success-content";
import { CheckoutSessionSync } from "./checkout-session-sync";

export const metadata: Metadata = {
	title: "AniDachi Subscription Status",
	description:
		"Check your AniDachi subscription status and continue to your account.",
	robots: { index: false, follow: false },
};

export default async function SuccessPage({
	searchParams,
}: {
	searchParams?: Promise<{ session_id?: string }>;
}) {
	const sp = await searchParams;
	const sessionId =
		typeof sp?.session_id === "string" ? sp.session_id : undefined;
	const authSession = await getSession();
	const user = authSession ? await getUserById(authSession.userId) : null;
	const currentPlan = user?.plan ?? authSession?.plan ?? "free";

	return (
		<SuccessPageFrame>
			<CheckoutSessionSync
				key={`${sessionId ?? "no-checkout"}:${authSession?.userId ?? "signed-out"}`}
				sessionId={sessionId}
				initialPlanCode={currentPlan}
				ownerUserId={authSession?.userId}
			>
				<SuccessFooter />
			</CheckoutSessionSync>
		</SuccessPageFrame>
	);
}
