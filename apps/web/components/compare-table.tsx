import {
  ResponsiveCompareTable,
  type CompareTableRow,
} from "@/components/responsive-compare-table";
import { HomeSectionHeader } from "@/components/home-section-header";

const columns = [
  { id: "anidachi", label: "AniDachi", highlight: true },
  { id: "teleparty", label: "Teleparty" },
  { id: "crunchyrollParty", label: "CR Party" },
  { id: "discord", label: "Discord" },
];

const rows: CompareTableRow[] = [
  {
    feature: "Crunchyroll sync",
    values: {
      anidachi: "yes",
      teleparty: "yes",
      crunchyrollParty: "yes",
      discord: "partial",
    },
  },
  {
    feature: "YouTube sync",
    values: {
      anidachi: "yes",
      teleparty: "yes",
      crunchyrollParty: "no",
      discord: "partial",
    },
  },
  {
    feature: "Asynchronous watching",
    values: {
      anidachi: "yes",
      teleparty: "no",
      crunchyrollParty: "no",
      discord: "no",
    },
  },
  {
    feature: "Auto title detection",
    values: {
      anidachi: "yes",
      teleparty: "no",
      crunchyrollParty: "no",
      discord: "no",
    },
  },
  {
    feature: "Real-time chat",
    values: {
      anidachi: "yes",
      teleparty: "yes",
      crunchyrollParty: "yes",
      discord: "yes",
    },
  },
  {
    feature: "Per-user progress tracking",
    values: {
      anidachi: "yes",
      teleparty: "no",
      crunchyrollParty: "no",
      discord: "no",
    },
  },
  {
    feature: "Free tier available",
    values: {
      anidachi: "yes",
      teleparty: "yes",
      crunchyrollParty: "yes",
      discord: "yes",
    },
  },
];

export function CompareTable() {
  return (
    <section id="compare" className="bg-brand-surface py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <HomeSectionHeader
          title="How AniDachi compares"
          description="Watchrooms for Crunchyroll and YouTube — sync, chat, and async catch-up, not generic screen share."
        />
        <div className="mx-auto max-w-4xl">
          <ResponsiveCompareTable columns={columns} rows={rows} />
        </div>
      </div>
    </section>
  );
}
