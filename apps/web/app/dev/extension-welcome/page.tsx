import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExtensionInstallHub } from "@/components/extension-install-hub";
import { getExtensionArtifact, toPublicExtensionArtifact } from "@/lib/extension-artifact";
import type { ExtensionWelcome } from "@/lib/extension-welcome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Local welcome preview",
  robots: { index: false, follow: false },
};

export default async function WelcomePreviewPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Fixture-only preview. Deployed builds return 404 and never query billing.
  if (process.env.NODE_ENV !== "development") notFound();
  const { state } = await searchParams;
  const welcome: ExtensionWelcome = state === "paid" ? { kind: "paid", plan: "pro" }
    : state === "inactive" || state === "error" || state === "sign_in" ? { kind: state }
    : { kind: "trial", plan: "plus", endsAt: "2099-01-04T00:00:00Z", expiresInMs: 259200000, cardlessWithoutRenewal: true };
  return <main className="mx-auto max-w-[1200px] px-5 pb-16 sm:px-8">
    <aside className="py-3 text-center text-xs text-ani-muted">Local preview · sample subscription · no account changes</aside>
    <ExtensionInstallHub artifact={toPublicExtensionArtifact(getExtensionArtifact())}
      welcome={welcome} extensionId={"a".repeat(32)} />
  </main>;
}
