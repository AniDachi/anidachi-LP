import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import * as copy from "./pricing-copy";

const webRoot = path.resolve(import.meta.dirname, "..");
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

// Detect retired offer predicates, not individual sentences. Provider offers and
// existing-trial renewal/privacy terms are valid and do not match these rules.
const retiredOffers = [
  /Free(?: accounts?)? (?:cannot|can['’]t) (?:create|host)/i,
  /(?:only (?:the )?host|hosts?|hosting(?: your own room| the room| a room)?|creating(?: your own)? rooms?|person (?:who creates|creating) the room|Only that person) (?:needs?|requires?) (?:your own |the host's own )?(?:active )?(?:AniDachi )?(?:Plus|Pro|a paid plan|paid)/i,
  /creat(?:e|es|ing)[^.!?]{0,65}(?:room|watchroom)[^.!?]{0,30}with Plus or Pro/i,
  /(?:host|hosting|rooms?)[^.!?]{0,100}(?:3[ -]day|three[ -]day) trial/i,
  /(?:eligible (?:Free )?accounts? can (?:try|start)|try Plus or Pro)[^.!?]{0,100}(?:trial|3 days|three days)/i,
  /Free(?: hosting| accounts?| includes?|:)?[^.!?;]{0,45}30[ -](?:host[ -])?minutes?/i,
  /30[ -]minute Free/i,
  /Choose Plus[^.!?]{0,100}or Pro to host\./i,
];

function violations(source: string, relativePath = ""): string[] {
  let text = normalize(source);
  // Exact legacy diagnostic is retained only on its troubleshooting page, with
  // adjacent legacy qualification and current Free20/reset/update guidance.
  if (relativePath === "app/guides/crunchyroll-watch-party-not-working/page.tsx") {
    assert.match(text, /In a legacy room/);
    assert.match(text, /00:00 UTC/);
    assert.match(text, /update before joining the new room/);
    text = text.replace('message: "This room needs a host with Plus or Pro"', "");
  }
  return retiredOffers.flatMap((pattern) => text.match(pattern)?.[0] ?? []);
}

function publicPages(dir: string, relative = "app"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      // Authenticated flows and historical dev fixtures have separate policy /
      // active-trial tests. Public account Help is included explicitly below.
      if (relative === "app" && ["account", "api", "auth", "checkout", "dev", "onboarding", "room", "rooms", "welcome", "extension"].includes(entry.name)) {
        return entry.name === "extension" ? ["app/extension/page.tsx"] : [];
      }
      return publicPages(path.join(dir, entry.name), name);
    }
    return entry.name === "page.tsx" ? [name] : [];
  });
}

const sharedSources = [
  "app/account/help/page.tsx",
  "lib/pricing-copy.ts", "lib/pricing-tiers.ts", "lib/home-faq.ts",
  "lib/pseo-new-guides.tsx", "lib/watch-page-rich-content.ts",
  "lib/extension-install-faq.ts", "lib/extension-using-guide.ts",
  "components/primary-checkout-cta.tsx", "components/how-it-works.tsx",
  "components/main-app-features.tsx", "components/json-ld.tsx",
];

test("public visible copy, metadata and JSON-LD reject retired AniDachi offers", () => {
  const files = [...new Set([...publicPages(path.join(webRoot, "app")), ...sharedSources])];
  assert.ok(files.length > 105, "The sweep includes the public inventory and shared sources");
  const failures = files.flatMap((file) => violations(readFileSync(path.join(webRoot, file), "utf8"), file).map((match) => `${file}: ${match}`));
  assert.deepEqual(failures, []);
});

test("the copy guard catches offer regressions across prose, metadata and JSON-LD", () => {
  for (const text of [
    "Free accounts cannot create rooms.",
    "Creating a room with Plus or Pro, including a trial.",
    "Only that person needs Plus or Pro to host.",
    "Only the host needs Plus or Pro, including during a trial.",
    'description: "Creating your own room requires your own Plus or Pro access."',
    '{ "description": "Hosting needs Plus or Pro, with a 3-day trial." }',
    "Eligible Free accounts can try Plus or Pro free for 3 days.",
    "Free includes 30-minute hosting.",
  ]) assert.ok(violations(text).length > 0, text);
});

test("provider trials, paid size examples and existing-trial rights remain valid", () => {
  for (const text of [
    "Teleparty Premium has a 7-day trial; guests join free.",
    "Crunchyroll offers a free trial to eligible subscribers.",
    "A group of five exceeds Free's four-person cap and needs Plus or Pro.",
    "Existing trials keep their original end date and renewal terms.",
    "Privacy: trial abuse protections retain limited eligibility records.",
    "Discord Watch Together allows 30 minutes alone.",
  ]) assert.deepEqual(violations(text), [], text);
});

test("shared Free20 copy distinguishes metering, media permission and personal history", () => {
  assert.match(copy.PRICING_FREE20_SUMMARY, /20 host minutes per UTC day.*4 people, including the host/);
  for (const requirement of [/host and at least one guest/, /paused/, /alone uses no time/, /account allowance/, /00:00 UTC/, /no carryover/, /Joining a friend's room does not spend your own/]) assert.match(copy.PRICING_FREE20_METERING_NOTE, requirement);
  assert.match(copy.PRICING_FREE20_MEDIA_NOTE, /four media seats.*four simultaneous cameras/);
  assert.match(copy.PRICING_FREE20_MEDIA_NOTE, /explicit local device action/);
  assert.match(copy.PRICING_HISTORY_NOTE, /Free can read, Resume and delete/);
  assert.match(copy.PRICING_HISTORY_NOTE, /Recording and editing.*each viewer's own Plus or Pro/);
  assert.match(copy.PRICING_ROOM_SIZE_RANGE, /4 people on Free, 6 people with a Plus host or 15 with a Pro host/);
  assert.match(copy.PRICING_EXISTING_TRIAL_NOTE, /New trials are no longer offered/);
});
