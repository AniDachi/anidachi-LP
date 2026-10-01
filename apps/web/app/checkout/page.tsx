import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
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
	const selection = checkoutSelectionFromPath(`/checkout?${query}`);
	if (!selection) redirect("/pricing");
	if (!(await getSession())) redirect(checkoutLoginPath(selection));
	return (
		<CheckoutContinuation
			key={`${selection.plan}:${selection.billing}`}
			selection={selection}
		/>
	);
}
