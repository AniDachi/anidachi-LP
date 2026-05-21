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
    feature: "Watch history tracking",
    values: {
      anidachi: "yes",
      teleparty: "no",
      crunchyrollParty: "no",
      discord: "no",
    },
  },
  {
    feature: "Episode progress per user",
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
      anidachi: "no",
      teleparty: "yes",
      crunchyrollParty: "yes",
      discord: "yes",
    },
  },
  {
    feature: "No account required for extension",
    values: {
      anidachi: "no",
      teleparty: "yes",
      crunchyrollParty: "yes",
      discord: "no",
    },
  },
];

export function CompareTable() {
  return (
    <section id="compare" className="py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How AniDachi Compares
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            See how AniDachi stacks up against other ways to watch anime with
            friends.
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <ResponsiveCompareTable columns={columns} rows={rows} />
        </div>
      </div>
    </section>
  );
}
