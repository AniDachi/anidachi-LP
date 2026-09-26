"use client";

import Link from "next/link";
import {
  ResponsiveCompareTable,
  type CompareTableRow,
} from "@/components/responsive-compare-table";
import { HomeSectionHeader } from "@/components/home-section-header";
import { trackConversion } from "@/lib/conversion-events";

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
      anidachi: "Your own stream",
      teleparty: "Your own stream",
      crunchyrollParty: "Your own stream",
      discord: "Compressed share",
    },
  },
  {
    feature: "Live sync",
    values: {
      anidachi: "Synced on each player",
      teleparty: "Playback sync",
      crunchyrollParty: "Playback sync",
      discord: "Screen share only",
    },
  },
  {
    feature: "On-player overlay",
    values: {
      anidachi: "Drag chat, cams, layout",
      teleparty: "Chat panel",
      crunchyrollParty: "Chat panel",
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
          <div className="mt-8 flex justify-center">
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
