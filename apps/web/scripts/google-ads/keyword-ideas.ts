/**
 * Fetch Keyword Planner ideas via Google Ads API.
 *
 * Prereqs (.env.local):
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID=5723352650
 *   ANIDACHI_GOOGLE_CLIENT_ID / ANIDACHI_GOOGLE_CLIENT_SECRET (or GOOGLE_ADS_*)
 *   Refresh token from /api/google-ads/oauth/connect OR GOOGLE_ADS_REFRESH_TOKEN
 *
 * Usage:
 *   pnpm --filter @anidachi/web google-ads:keywords "watch anime with friends"
 *   pnpm --filter @anidachi/web google-ads:keywords "anidachi" "crunchyroll watch party"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeywordIdeas } from "../../lib/google-ads/client";

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

async function main() {
  loadEnvLocal();

  const keywords = process.argv
    .slice(2)
    .map((k) => k.trim())
    .filter((k) => Boolean(k) && k !== "--");
  if (keywords.length === 0) {
    console.error(
      'Pass at least one seed keyword, e.g. pnpm --filter @anidachi/web google-ads:keywords "watch anime with friends"'
    );
    process.exit(1);
  }

  console.log(`Seeds: ${keywords.join(", ")}`);
  const results = await generateKeywordIdeas({ keywords });

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
    const lowBid =
      row.lowTopOfPageBidMicros != null
        ? `$${(row.lowTopOfPageBidMicros / 1_000_000).toFixed(2)}`
        : "n/a";
    const highBid =
      row.highTopOfPageBidMicros != null
        ? `$${(row.highTopOfPageBidMicros / 1_000_000).toFixed(2)}`
        : "n/a";
    console.log(
      `- ${row.text} | searches/mo: ${searches} | competition: ${row.competition ?? "n/a"} | bid: ${lowBid}-${highBid}`
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
