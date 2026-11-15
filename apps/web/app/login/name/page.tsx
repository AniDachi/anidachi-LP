import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAccountIdentity } from "@/lib/anidachi-auth/account-identity";
import { emailLoginReturnTo } from "@/lib/anidachi-auth/email-login";
import { requireAuth } from "@/lib/anidachi-auth/session";
import { needsProfileName } from "@/lib/profile-name";
import { NameSetupScreen } from "./name-setup-screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
	title: "Choose your name",
	robots: { index: false, follow: false },
};

export default async function NameSetupPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string }>;
}) {
	const { next } = await searchParams;
	const safeNext = emailLoginReturnTo(next) || "/account";
	// An interrupted setup may send the user here again after signing in.
	const returnTo = new URL(safeNext, "https://auth.invalid").pathname === "/login/name"
		? "/account"
		: safeNext;
	const session = await requireAuth(returnTo);
	const { user, profile } = await getAccountIdentity(session.userId);
	if (!user) notFound();
	if (!needsProfileName(profile?.display_name ?? user.display_name)) redirect(returnTo);
	return <NameSetupScreen key={session.userId} ownerUserId={session.userId} returnTo={returnTo} />;
}
