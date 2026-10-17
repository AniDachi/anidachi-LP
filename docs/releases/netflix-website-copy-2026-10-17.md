# Netflix website copy for the coordinated 0.1.3 launch

Owner authorized removing stale Netflix coming-soon copy on October 17, 2026.
Branch `codex/netflix-launch-copy` starts at staging `f86819f4`.

## Scope

- Present Netflix movie/episode watch pages in desktop Chrome as supported,
  alongside Crunchyroll and full YouTube watch pages.
- Update homepage/installation/pricing text, shared CTA and pricing copy, FAQ and
  HowTo JSON-LD, social/search descriptions, Netflix guides, comparison rows,
  account help, first-history instructions, room installation help and privacy.
- Remove Netflix from the future-platform logo strip and center the remaining
  three brands on desktop and mobile. Keep async catch-up and other genuinely
  planned features marked as future.
- Preserve the same URL paths, canonical/www logic, homepage title/H1, plan and
  eligibility semantics, extension permissions and published source-video rules.
- Keep each viewer's own provider access and desktop/full-watch-page limits clear.
  Do not claim Netflix ad-plan compatibility from this copy change.

## Release boundary

This is website source for staging and the coordinated launch after Store approval.
It does not publish production, activate billing, or change the frozen 0.1.3 ZIP.
The exact ZIP hash remains recorded in its existing build receipt. Store listing
fields and privacy declarations remain owner-reviewed; changing the website privacy
provider list does not edit the Store dashboard.

## Verification and delivery

The PR records the final copy audit, existing web checks/tests, local visual
inspection and staging CI/deployment. A normalized source audit covers multiline
availability claims and comparison rows; visible FAQ and JSON-LD use the same
source data. Screenshots and local scan receipts stay in ignored artifacts.

Graphify must use the safe semantic update adapter; if its known external-node
resolution failure recurs, preserve the existing graph and record the exception.

## Rollback

Revert only this website-copy PR on staging. No database migration, runtime
protocol, environment change or extension rebuild is required. Do not deploy this
copy to production separately from the compatible Netflix release.
