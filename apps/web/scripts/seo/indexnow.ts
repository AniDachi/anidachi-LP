/**
 * Submit changed www.anidachi.app URLs to IndexNow (Bing, Yandex, Seznam and others; not Google).
 *
 * Dry run by default: prints the payload and sends nothing. Add --submit to POST.
 * Before submitting, the script checks that the live key file returns the key; if it does not,
 * the engines would answer 403, so nothing is sent.
 *
 * Usage:
 *   pnpm --filter @anidachi/web seo:indexnow /netflix-watch-party /discord-watch-party
 *   pnpm --filter @anidachi/web seo:indexnow --file urls.txt          # one path or URL per line, # comments ok
 *   pnpm --filter @anidachi/web seo:indexnow --sitemap                # every URL sitemap.xml lists
 *   pnpm --filter @anidachi/web seo:indexnow --submit /virtual-movie-night
 *
 * Submit only URLs that are live on production and changed. Repeated pings for unchanged
 * URLs can get the key throttled.
 */
import fs from "node:fs";
import { animeList } from "../../lib/anime-data";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  buildIndexNowPayloads,
  describeIndexNowStatus,
  normalizeIndexNowUrls,
} from "../../lib/indexnow";
import { discoverStaticSitemapUrlPaths } from "../../lib/sitemap-discovery";

type Options = { submit: boolean; inputs: string[] };

function parseArgs(argv: string[]): Options {
  const inputs: string[] = [];
  let submit = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--submit") {
      submit = true;
    } else if (arg === "--file") {
      const file = argv[++i];
      if (!file) throw new Error("--file needs a path");
      inputs.push(...fs.readFileSync(file, "utf8").split(/\r?\n/));
    } else if (arg === "--sitemap") {
      inputs.push(...discoverStaticSitemapUrlPaths());
      inputs.push(...animeList.map((anime) => `/watch/${anime.slug}-with-friends`));
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      inputs.push(arg);
    }
  }
  return { submit, inputs };
}

async function keyFileIsLive(): Promise<boolean> {
  try {
    const response = await fetch(INDEXNOW_KEY_LOCATION, { redirect: "manual" });
    if (response.status !== 200) {
      console.error(`Key file ${INDEXNOW_KEY_LOCATION} returned ${response.status}.`);
      return false;
    }
    const body = (await response.text()).trim();
    if (body !== INDEXNOW_KEY) {
      console.error(`Key file ${INDEXNOW_KEY_LOCATION} does not contain the key.`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Could not fetch ${INDEXNOW_KEY_LOCATION}:`, error);
    return false;
  }
}

async function main(): Promise<void> {
  const { submit, inputs } = parseArgs(process.argv.slice(2));
  const { urls, rejected } = normalizeIndexNowUrls(inputs);

  if (rejected.length > 0) {
    console.error(`Skipped ${rejected.length} input(s) not on https://www.anidachi.app:`);
    for (const value of rejected) console.error(`  ${value}`);
  }
  if (urls.length === 0) {
    console.error("No URLs to submit. Pass paths, --file <path> or --sitemap.");
    process.exitCode = 1;
    return;
  }

  const payloads = buildIndexNowPayloads(urls);
  console.log(`${urls.length} URL(s) in ${payloads.length} request(s) to ${INDEXNOW_ENDPOINT}`);

  if (!submit) {
    console.log("Dry run. Add --submit to send.");
    console.log(JSON.stringify(payloads[0], null, 2));
    return;
  }

  if (!(await keyFileIsLive())) {
    console.error("Not submitting: deploy the key file to production first.");
    process.exitCode = 1;
    return;
  }

  for (const payload of payloads) {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    console.log(`${response.status} ${describeIndexNowStatus(response.status)} (${payload.urlList.length} URLs)`);
    if (response.status !== 200 && response.status !== 202) {
      process.exitCode = 1;
      const text = await response.text().catch(() => "");
      if (text) console.error(text.slice(0, 500));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
