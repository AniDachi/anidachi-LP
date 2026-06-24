import {
  ResponsiveCompareTable,
  type CompareTableRow,
} from "@/components/responsive-compare-table";

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
    feature: "Asynchronous watching",
    values: {
      anidachi: "yes",
      teleparty: "no",
      crunchyrollParty: "no",
      discord: "no",
    },
  },
  {
    feature: "Auto anime detection",
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
    <section id="compare" className="bg-brand-surface py-16 lg:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/15 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-brand-orange">
            Compare
          </div>
          <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
            How AniDachi Compares
          </h2>
          <div className="mx-auto mb-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-bright" />
          <p className="mx-auto max-w-xl text-base text-foreground/70">
            Built for anime watch parties, not generic screen share.
          </p>
        </div>
        <div className="mx-auto max-w-4xl">
          <ResponsiveCompareTable columns={columns} rows={rows} />
        </div>
      </div>
    </section>
  );
}
