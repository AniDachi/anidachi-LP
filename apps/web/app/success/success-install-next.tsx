"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useExtensionPresence } from "@/lib/extension-presence";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";

export function SuccessInstallNext() {
  const detected = useExtensionPresence();

  if (detected === true) {
    return (
      <p className="rounded-[12px] border border-ani-line bg-ani-selected-quiet px-4 py-3 text-sm text-ani-muted">
        Extension detected. Refresh the AniDachi menu so it picks up your new
        plan limits.
      </p>
    );
  }

  return (
    <div className="rounded-[12px] border border-ani-line bg-ani-panel px-4 py-4">
      <p className="text-sm font-semibold text-ani-text">Install the Chrome extension</p>
      <p className="mt-1 text-sm text-ani-muted">
        Your plan is active. Watchrooms still need AniDachi on desktop Chrome —
        download the official zip and Load unpacked (about 2 minutes).
      </p>
      <Button asChild variant="cream" size="control" className="mt-4">
        <Link href={INSTALL_HUB_PATH}>{INSTALL_CTA_LABEL}</Link>
      </Button>
    </div>
  );
}
