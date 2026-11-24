/**
 * Fetch Keyword Planner ideas via Google Ads API.
 *
 * Prereqs (.env.local):
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID=8078204641
 *   ANIDACHI_GOOGLE_CLIENT_ID / ANIDACHI_GOOGLE_CLIENT_SECRET (or GOOGLE_ADS_*)
 *   Refresh token from /api/google-ads/oauth/connect OR GOOGLE_ADS_REFRESH_TOKEN
 *
 * Usage:
 *   pnpm --filter @anidachi/web google-ads:keywords "watch anime with friends"
 *   pnpm --filter @anidachi/web google-ads:keywords "anidachi" "crunchyroll watch party"
 *
 * Exact volumes for the keywords you pass (not ideas; stable across requests):
 *   pnpm --filter @anidachi/web google-ads:keywords --exact "netflix watch party" "netflix party"
 *
 * Options (both modes):
 *   --worldwide      no location filter (default: United States)
 *   --geo 2276,2040  geo target constant IDs (e.g. Germany, Austria)
 *   --lang 1001      language constant ID (default 1000 English; 1001 German)
 *   --json           print JSON instead of a table
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeywordIdeas, getKeywordVolumes } from "../../lib/google-ads/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "../../.env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

type CliOptions = {
  keywords: string[];
  exact: boolean;
  json: boolean;
  languageId?: number;
  locationIds?: number[];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { keywords: [], exact: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i].trim();
    if (!arg || arg === "--") continue;
    if (arg === "--exact") {
      options.exact = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--worldwide") {
      options.locationIds = [];
    } else if (arg === "--geo") {
      options.locationIds = (argv[++i] ?? "")
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (options.locationIds.length === 0) {
        throw new Error("--geo needs comma-separated geo target constant IDs");
      }
    } else if (arg === "--lang") {
      const id = Number(argv[++i]);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error("--lang needs a numeric language constant ID");
      }
      options.languageId = id;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      options.keywords.push(arg);
    }
  }
  return options;
}

function formatBid(micros?: number) {
  return micros != null ? `$${(micros / 1_000_000).toFixed(2)}` : "n/a";
}

async function printExactVolumes(options: CliOptions) {
  const rows = await getKeywordVolumes({
    keywords: options.keywords,
    languageId: options.languageId,
    locationIds: options.locationIds,
  });
  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  const returned = new Set(
    rows.flatMap((row) => [row.text, ...row.closeVariants].map((k) => k.toLowerCase()))
  );
  for (const row of rows) {
    const searches = row.avgMonthlySearches?.toLocaleString() ?? "n/a";
    const variants = row.closeVariants.length
      ? ` | close variants: ${row.closeVariants.join(", ")}`
      : "";
    console.log(
      `- ${row.text} | searches/mo: ${searches} | competition: ${row.competition ?? "n/a"} | bid: ${formatBid(row.lowTopOfPageBidMicros)}-${formatBid(row.highTopOfPageBidMicros)}${variants}`
    );
  }
  const missing = options.keywords.filter((k) => !returned.has(k.toLowerCase()));
  if (missing.length > 0) {
    console.log(`\nNo data: ${missing.join(", ")}`);
  }
}

async function main() {
  loadEnvLocal();

  const options = parseArgs(process.argv.slice(2));
  const { keywords } = options;
  if (keywords.length === 0) {
    console.error(
      'Pass at least one seed keyword, e.g. pnpm --filter @anidachi/web google-ads:keywords "watch anime with friends"'
    );
    process.exit(1);
  }

  if (options.exact) {
    await printExactVolumes(options);
    return;
  }

  console.log(`Seeds: ${keywords.join(", ")}`);
  const results = await generateKeywordIdeas({
    keywords,
    languageId: options.languageId,
    locationIds: options.locationIds,
  });

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log("No keyword ideas returned.");
    return;
  }

  console.log(`\nTop ${Math.min(results.length, 25)} ideas:\n`);
  for (const row of results.slice(0, 25)) {
    const searches =
      row.avgMonthlySearches != null
        ? row.avgMonthlySearches.toLocaleString()
        : "n/a";
    console.log(
      `- ${row.text} | searches/mo: ${searches} | competition: ${row.competition ?? "n/a"} | bid: ${formatBid(row.lowTopOfPageBidMicros)}-${formatBid(row.highTopOfPageBidMicros)}`
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
