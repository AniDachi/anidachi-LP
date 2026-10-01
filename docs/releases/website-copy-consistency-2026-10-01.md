# Website copy consistency — October 1, 2026

## Scope and authority

The owner approved correcting the website audit findings. This is a local
website change based on staging `34c4af98`, on `codex/site-copy-consistency`.
Delivery to staging and production is separate. No runtime billing, entitlement,
room, extension, database or environment changes are part of this patch.

Copy follows the [transition rules](paid-hosting-trial/transition-master-plan-ru.md#21-модель-доступа)
and current access checks: Free joins a Plus/Pro/trial host; hosting and new
personal-history recording/editing require the viewer's own Plus/Pro access.
Saved history, Resume and deletion remain available on Free. Plus rooms hold
6 people including the host; Pro rooms hold 15. Each person needs their own
access to the video. Recording requires permission in the extension and the
separate YouTube setting when applicable.

An unused trial is available once per account for three days with a card, for
both new and existing Free accounts. Monthly/yearly renewal, cancellation and
the original trial end must be described consistently. Async catch-up, shared
group progress, persistent room chat/context and replayed reactions are planned,
not current paid-plan benefits.

## Correction checklist

- [x] Replace shared Free-hosting/30-minute/Free-room-capacity marketing text.
  Its consumers include 60 static routes and 176 generated anime routes; this
  count describes the audited common-template exposure, not browser visits.
- [x] Add accurate trial, renewal and billing-period information to shared FAQs.
- [x] Correct Help, Terms, Privacy, installation HowTo and Free/paid Watch Library steps.
- [x] Correct common install CTAs, application JSON-LD, glossary and onboarding.
- [x] Update the SEO writing guide so future pages use current product claims.
- [x] Review and correct direct claims in guides, comparisons and landing pages,
  including their FAQ, HowTo and search/social metadata.
- [x] Re-scan the complete public content surface after integration.
- [x] Run web checks, relevant tests and build; inspect representative pages.
- [x] Record Graphify outcome and review evidence.

## Delivery and rollback

These texts describe the activated paid-hosting model. Do not publish them to an
environment still advertised as legacy Free hosting without coordinating its
model transition. Existing gated legacy quota code remains unchanged.

Preserve public paths, canonicals, links, plan prices, layouts and SEO indexing
settings. No new marketing routes or competitor-product changes are intended.
Rollback is a revert of this website patch; no migration, secret or flag change
is involved. Staging smoke and owner acceptance follow any authorized staging
delivery. No staging/production delivery has happened for this patch.

## Verification

Local correction and verification are complete. The full existing web suite
passed: 948 tests total, 942 passed, 6 existing skips, 0 failures
(`pnpm --filter @anidachi/web test`). The web typecheck also passed.
The earlier account/help/installation subset passed its existing 47 tests
(`extension-using-examples` and `watch-library-client`). The final production
build passed (`pnpm --filter @anidachi/web exec next build`), generating 385/385
static entries. Existing lint warnings remain; no new unused-symbol warnings
were introduced by this patch. The existing Jikan cache was retained rather
than refreshed as an unrelated dataset change.

The final scan inspected rendered text and JSON-LD across all 353 generated HTML
files. It found no matches for the audited retired Free-hosting/30-minute,
current-async, optional-upgrade, manual Detect Anime and room-naming claims.
Source review also covered direct copy, shared templates, FAQ/HowTo and metadata.
The 125 modified page files retain their canonical properties and original
publication dates. There are no route deletions. This is a scoped product-copy
audit, not independent verification of every anime catalog or competitor fact.

Independent read-only review of the integrated diff found no remaining P1/P2
issues. Its findings about trial eligibility, permission for automatic history
recording versus manual editing, and obsolete setup instructions were fixed and
rechecked. `git diff --check` passes.

`pnpm dev:check` recommends web, docs and rooms based on changed paths. The rooms
profile is not applicable: this patch changes website copy and the instructional
text selected by existing history access, without changing Worker, protocol,
room state, P2P, auth, payment or entitlement behavior. No room harness or live
checkout is needed for this local copy patch. No new copy-mirroring tests added.

Local browser checks: Terms, installation instructions, glossary/watchroom, an
Attack on Titan generated page and its expanded Free/trial FAQ, the Crunchyroll
setup guide, Teleparty comparison and homepage pricing. The glossary was also
inspected at 390px width with no horizontal overflow; its canonical and FAQ
JSON-LD match the corrected copy. The final guide, comparison and pricing checks
also found no horizontal overflow. This is representative rendering evidence,
not manual verification of every URL or an authenticated account acceptance test.
The development server is restored at `http://127.0.0.1:3003`.

Graphify has a documented [merge integrity exception](../superpowers/plans/2026-10-01-account-loading-performance.md#graphify-исключение-проверки-целостности).
The safe update preflight reproduced it with Graphify 0.9.64 even on
`build_merge([])`: 14,198 → 14,197 nodes and 32,582 → 32,577 edges, with one
unrelated migration node lost, 14 unrelated labels changed and two material
edge direction/provenance changes. Another 883 differences only added `_origin`.
The candidate was rejected before semantic extraction or manifest stamping.
`graph.json`, `manifest.json` and `GRAPH_REPORT.md` remain byte-identical to the
baseline; this copy patch is not represented in the graph. No Graphify repair is
included in this task. Local receipt:
`/private/tmp/anidachi-site-copy-graph-20261001-hv9q4cvm/noop-receipt.json`.
