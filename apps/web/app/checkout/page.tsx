import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
import { readApprovedExtensionClientId } from "@/lib/anidachi-auth/extension-codes";
import {
	checkoutLoginPath,
	checkoutSelectionFromPath,
} from "@/lib/checkout-selection";
import { CheckoutContinuation } from "./checkout-continuation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
	title: "Continue your subscription — AniDachi",
	robots: { index: false, follow: false },
};

export default async function CheckoutPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = await searchParams;
	const query = new URLSearchParams();
	for (const key of ["plan", "billing"]) {
		const value = params[key];
		if (typeof value !== "string") redirect("/pricing");
		query.set(key, value);
	}
	if (params.confirm !== undefined) {
		if (typeof params.confirm !== "string") redirect("/pricing");
		query.set("confirm", params.confirm);
	}
	if (params.onboarding !== undefined) {
		if (typeof params.onboarding !== "string") redirect("/pricing");
		query.set("onboarding", params.onboarding);
	}
	const selection = checkoutSelectionFromPath(`/checkout?${query}`);
	if (!selection) redirect("/pricing");
	if (!(await getSession())) redirect(checkoutLoginPath(selection));
	return (
		<CheckoutContinuation
			key={`${selection.plan}:${selection.billing}:${selection.confirmTrial ? "confirm" : "continue"}:${selection.onboarding ?? ""}`}
			selection={selection}
			extensionId={selection.onboarding ? readApprovedExtensionClientId() : null}
		/>
	);
}
