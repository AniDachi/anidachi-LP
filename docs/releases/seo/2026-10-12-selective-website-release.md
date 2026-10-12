# Selective website release — October 12, 2026

## Scope and source boundary

The collaborator website batch is `a65a71847d91c4fca36432ef34f1570bbba19615`
(parent `be92083f594ce8d535dfc562857540ab4b64712c`). It adds ten free tools and
SEO/content fixes. The production starting point is
`ec8c1064a04d75041b6ac0f3c71bd031c3c5193e`.

Prepare the corrected batch on staging, then apply only its deltas to a branch
from main. Do not merge all of staging. Exclude cardless trial, subscription UI,
Netflix runtime/history, local onboarding/overlay changes, Worker, extension,
protocol, migrations and deployment workflows.

Two original paths overlap unreleased changes:

- `apps/web/components/footer.tsx`: retain main's affiliation disclaimer; apply
  only the collaborator's coming-soon wording.
- `apps/web/app/watch-netflix-together-long-distance/page.tsx`: apply the title
  change only. Retain main's availability copy and original section anchors.

Later SEO-origin changes in other marketing pages are mechanical helper changes,
not permission to copy their complete staging versions into main. Compare the
final diff against main and verify all excluded planes remain unchanged.

## Correctness fixes

- Escape the Fate guide's JSX apostrophe that blocked the web lint/build gate.
- Films flagged `notOnCrunchyroll` retain their URLs and movie information but do
  not claim AniDachi playback in metadata, FAQ, visible setup, or HowTo schema.
  Explain legal viewing/manual coordination separately from an AniDachi room.
- Date the manual Crunchyroll schedule by its explicit week and checked date.
  Elapsed planned release times are not confirmation that an episode is out.
- Disable random-anime length controls during the reel animation so an earlier
  pending result cannot land in a newly selected filter.

## Public hostname without runtime migration

Keep `https://www.anidachi.app` as the public primary host. `getSeoSiteOrigin`
normalizes the known public apex/www hosts for metadataBase, JSON-LD, robots,
sitemap and absolute article URLs. An old apex env value no longer makes those
outputs contradict the existing redirect. Noindex deployments and non-public
origins retain their own hostname.

`getResolvedSiteOrigin` retains the configured deployment origin for runtime
consumers, including Gmail OAuth callback fallbacks. No OAuth allowlist, cookie,
Stripe return URL, extension endpoint or environment variable is changed by this
patch. Do not change `NEXT_PUBLIC_SITE_URL` as a shortcut without checking these
runtime consumers and explicit Gmail callback configuration.

The Vercel apex domain was inspected read-only: its destination is already
`www.anidachi.app`, but `redirectStatusCode` is null and the live response is 307.
The repository already requests a permanent redirect; the domain-level rule runs
first. After separate production authorization, change only that domain rule's
status to 308, retaining its destination, path and query. This is a permanent
signal for the existing direction, not a move to a different host. Do not flip
www to apex, change DNS, or submit a Search Console Change of Address request.
The four guide consolidations use Next.js `permanent: true` (308, not 301).

## Verification and release procedure

1. Run web typecheck, tests, lint, production-mode build and `pnpm dev:check`.
2. Check real rendered metadata/JSON-LD, both sitemaps, bare-watch and guide
   redirects, unsupported film pages, and the ten tools. Keep staging gated,
   noindex and excluded from its sitemap.
3. Review the exact main candidate and record tests, staging/preview evidence,
   exclusion diff, docs and Graphify status in its PR. Do not merge it until the
   owner authorizes production promotion.
4. After authorization: deploy the accepted main candidate, apply the same-target
   Vercel 308 setting, and verify apex paths/queries redirect once to www, www is
   200, canonical/OG/schema/sitemaps agree on www, and staging remains noindex.
   No extension Store release or Stripe change is needed for this website batch.

This document is a preparation contract, not proof of production deployment.
The PR/controller receipt records exact delivered SHAs and check results.

## Rollback

Revert the selective website promotion or redeploy the preceding accepted main
revision. No database or billing rollback is involved. If the domain status change
causes an unexpected issue, restore its previously recorded status while keeping
the same www destination. Permanent redirects may be cached by browsers/crawlers.
