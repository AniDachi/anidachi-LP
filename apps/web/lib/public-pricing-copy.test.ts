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
  /Choose Plus(?:\s*\([^)]*\))?\s+or Pro(?:\s*\([^)]*\))?\s+to create (?:your own )?(?:rooms?|watchrooms?)/i,
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
    "Choose Plus ($7.99/mo) or Pro ($11.99/mo) to create rooms.",
    `Choose Plus ({PRICING_PLUS_SHORT} on monthly billing) or Pro (
      {PRICING_PRO_SHORT} on monthly billing) to create rooms.{" "}`,
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
    "Choose Plus or Pro for larger rooms and hosting without a daily time limit.",
  ]) assert.deepEqual(violations(text), [], text);
});

test("shared Free20 copy distinguishes metering, media permission and personal history", () => {
  assert.match(copy.PRICING_FREE20_SUMMARY, /20 minutes a day.*4 people, including you/);
  for (const requirement of [/you and at least one guest/, /paused/, /alone uses no time/, /one allowance across your rooms and devices/, /00:00 UTC/, /don’t carry over/, /Joining someone else’s room doesn’t use your minutes/]) assert.match(copy.PRICING_FREE20_METERING_NOTE, requirement);
  assert.match(copy.PRICING_FREE20_MEDIA_NOTE, /four people.*camera and microphone/);
  assert.match(copy.PRICING_FREE20_MEDIA_NOTE, /host manages access.*each person chooses/);
  assert.match(copy.PRICING_HISTORY_NOTE, /view, resume and delete.*Free/);
  assert.match(copy.PRICING_HISTORY_NOTE, /Saving or editing.*your own Plus or Pro/);
  assert.match(copy.PRICING_ROOM_SIZE_RANGE, /4 people on Free, 6 people with a Plus host or 15 with a Pro host/);
  assert.match(copy.PRICING_EXISTING_TRIAL_NOTE, /New trials are no longer offered/);
});

test("the five-person Discord example requires paid capacity beyond Free's four-person cap", () => {
  const source = readFileSync(path.join(webRoot, "app/discord-watch-party/page.tsx"), "utf8");
  const paragraph = [...source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
    .map((match) => normalize(match[1]!))
    .find((text) => /group of five/i.test(text));
  assert.ok(paragraph, "Keep the concrete five-person capacity example");
  assert.match(paragraph, /(?:needs?|requires?) Plus or Pro/i);
  assert.match(paragraph, /Free.{0,40}(?:four|4)[ -]person (?:cap|limit)/i);
  assert.doesNotMatch(paragraph, /host (?:on|with) Free/i);
});
