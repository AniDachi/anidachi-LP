import type { Metadata } from "next";
import { TrackOnView } from "@/components/track-on-view";
import { UninstallClient } from "./uninstall-client";
import "./uninstall.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Uninstall feedback",
  robots: { index: false, follow: false },
};

export default async function UninstallPage({ searchParams }: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  // Only the production channel has a Store installation. Local/preview hosts
  // must explain how to reload the reviewed staging artifact instead.
  const stagingInstallation = process.env.VERCEL_ENV !== "production" ||
    process.env.ANIDACHI_STAGING_GATE_ENABLED === "true";
  return <>
    <TrackOnView event="uninstall_viewed" />
    <UninstallClient initialPlan={plan === "pro" ? "pro" : "plus"}
      stagingInstallation={stagingInstallation} />
  </>;
}
