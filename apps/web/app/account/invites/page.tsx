import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
import { InvitesClient } from "./invites-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invites",
  robots: { index: false, follow: false },
};

export default async function AccountInvitesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Finvites");

  return <InvitesClient />;
}
