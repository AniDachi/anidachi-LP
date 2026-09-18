"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ResponsiveCompareTable,
  type CompareTableRow,
} from "@/components/responsive-compare-table";
import { HomeSectionHeader } from "@/components/home-section-header";
import { trackConversion } from "@/lib/conversion-events";
import {
  INSTALL_CTA_LABEL,
  INSTALL_HUB_PATH,
} from "@/lib/install-cta";

const columns = [
  { id: "anidachi", label: "AniDachi", highlight: true },
  { id: "teleparty", label: "Teleparty" },
  { id: "crunchyrollParty", label: "CR Party" },
  { id: "discord", label: "Discord" },
];

const rows: CompareTableRow[] = [
  {
    feature: "Platforms",
    values: {
      anidachi: "Crunchyroll + YouTube",
      teleparty: "Many sites",
      crunchyrollParty: "Crunchyroll only",
      discord: "Any share",
    },
  },
  {
    feature: "Own player quality",
    values: {
      anidachi: "Full stream quality",
      teleparty: "Full quality",
      crunchyrollParty: "Full quality",
      discord: "Compressed share",
    },
  },
  {
    feature: "Live sync",
    values: {
      anidachi: "Synced on each player",
      teleparty: "Synced overlay",
      crunchyrollParty: "Synced overlay",
      discord: "Screen share only",
    },
  },
  {
    feature: "On-player overlay",
    values: {
      anidachi: "Drag chat, cams, layout",
      teleparty: "Fixed overlay",
      crunchyrollParty: "Fixed overlay",
      discord: "Separate windows",
    },
  },
  {
    feature: "Quick reactions",
    values: {
      anidachi: "Keys 1–0 on the player",
      teleparty: "no",
      crunchyrollParty: "no",
      discord: "Off the video",
    },
  },
  {
    feature: "Friends, groups & invites",
    values: {
      anidachi: "Friends, groups, invites",
      teleparty: "Share a link",
      crunchyrollParty: "Share a link",
      discord: "Server invite",
    },
  },
  {
    feature: "Watch history & Resume",
    values: {
      anidachi: "Record on Plus/Pro; saved history & Resume on all plans",
      teleparty: "no",
      crunchyrollParty: "no",
      discord: "no",
    },
  },
];

export function CompareTable() {
  return (
    <section id="compare" className="bg-ani-canvas py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <HomeSectionHeader
          title="How AniDachi compares"
          description="Live sync on your real Crunchyroll or YouTube player — drag the overlay, react on the video, invite friends or groups. No compressed Discord share."
        />
        <div className="mx-auto max-w-4xl">
          <ResponsiveCompareTable columns={columns} rows={rows} />
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="cream"
              size="control"
              className="w-full px-8 text-sm sm:w-auto"
              asChild
            >
              <Link
                href={INSTALL_HUB_PATH}
                onClick={() => {
                  trackConversion("cta_click", {
                    page_path: "/",
                    page_template: "home",
                    placement: "home_compare",
                    cta_variant: "compare_install",
                  });
                }}
              >
                {INSTALL_CTA_LABEL}
              </Link>
            </Button>
            <Link
              href="/pricing"
              className="text-sm text-ani-muted underline-offset-4 hover:text-ani-text hover:underline"
              onClick={() => {
                trackConversion("cta_click", {
                  page_path: "/",
                  page_template: "home",
                  placement: "home_compare",
                  cta_variant: "compare_pricing",
                });
              }}
            >
              See Free, Plus & Pro limits
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
