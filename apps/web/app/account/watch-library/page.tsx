import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
import { resolveAccountEntitlements } from "@/lib/anidachi-auth/account-entitlements";
import {
	getWatchHistoryPreferencesV3,
	listWatchHistoryV3,
} from "@/lib/anidachi-auth/watch-history-v3";
import { loadWatchLibraryData } from "./watch-library-data";
import { WatchLibraryClient } from "./watch-library-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
	title: "Watch Library",
	robots: { index: false, follow: false },
};

export default async function AccountWatchLibraryPage() {
	const session = await getSession();
	if (!session) redirect("/login?next=%2Faccount%2Fwatch-library");
	try {
		const { access, preferences, history } = await loadWatchLibraryData(
			session.userId,
			{
				access: async (userId) =>
					(await resolveAccountEntitlements(userId, new Date())).history,
				preferences: (userId) => getWatchHistoryPreferencesV3({ userId }),
				history: (userId) => listWatchHistoryV3({ userId, limit: 24 }),
			},
		);
		return (
			<WatchLibraryClient
				initialHistory={history}
				initialPreferences={preferences}
				initialAccess={access.state}
			/>
		);
	} catch (error) {
		const update =
			error instanceof Error &&
			error.message.includes("HISTORY_CLIENT_UPDATE_REQUIRED");
		return (
			<main>
				<h1>Personal history</h1>
				<p>
					{update
						? "Update AniDachi to use personal history."
						: "History access is temporarily unavailable. Please retry."}
				</p>
				<a href="/account/watch-library">Retry history access</a>
			</main>
		);
	}
}
