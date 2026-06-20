import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Friends",
  robots: { index: false, follow: false },
};

export default async function FriendsPage() {
  redirect("/account/friends");
}
