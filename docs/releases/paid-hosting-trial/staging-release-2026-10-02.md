# Staging release delivery, October 2, 2026

## Delivered source and scope

The owner authorized the next staging delivery. [PR #397](https://github.com/AniDachi/anidachi-LP/pull/397)
merged at **12:28:38 UTC** as `e5cf589a2863f303471266b5062404842f80d77c`.
Its reviewed head was `54b473b41edd40aa326d07a4bad6ac23dc3d77cd`, based on staging
`3998250d2ebb2d7ce4488865235b90ac6e4eab00`.

The change keeps the extension welcome visible until Got it, keeps prices visible
while trial wording waits for a confirmed offer, and requires an explicit exact-SHA
production Worker dispatch and an explicit production package version. Billing
preservation and previous Stripe verification are documented. No checkout mutation,
API/room implementation, database schema, existing subscription or runtime secret
was changed in this delivery. The Worker workflow ran because its delivery guard
changed.

This receipt is a documentation follow-up to that runtime delivery. Later receipt
commits do not change the source identity of the frozen ZIP below.

## Deployed evidence

| Surface | Evidence |
| --- | --- |
| Staging Web | `dpl_Ad7d3GpSznpThFCQj7Z1owe62eqW`, READY, exact `e5cf589a` source; aliases include `staging.anidachi.app` and the staging branch URL |
| Staging Worker | Version `11d35b24-6e39-4daa-b6ff-133c8419691b`, successful [Deploy API run](https://github.com/AniDachi/anidachi-LP/actions/runs/37006905582) |
| Post-merge CI | [Push CI](https://github.com/AniDachi/anidachi-LP/actions/runs/37006905525) and [promotion-PR CI](https://github.com/AniDachi/anidachi-LP/actions/runs/37006915410) passed |
| Rooms / P2P | [Rooms](https://github.com/AniDachi/anidachi-LP/actions/runs/37006915164) and [P2P Media](https://github.com/AniDachi/anidachi-LP/actions/runs/37006915308) passed |
| Web smoke | [Protected staging smoke](https://github.com/AniDachi/anidachi-LP/actions/runs/37007159141) passed, including guest Plus yearly and Pro monthly continuation |
| Worker smoke | `pnpm smoke:worker:staging` passed after deployment |
| Extension | [Build Extension run](https://github.com/AniDachi/anidachi-LP/actions/runs/37006905630) passed; downloaded artifact validated locally |

Vercel was verified by the new deployment ID and its alias assignment. The
hostname lookup briefly returned the previous deployment, so it was not treated
as sufficient evidence. A browser read of staging confirmed visible prices,
yearly selection and Manage subscription for the already subscribed signed-in
account; no console errors were captured. No checkout was submitted.

Fresh local checks before the PR: web typecheck and 966 passing tests with six
existing skips; extension typecheck and 2,163 passing tests; five deployment-gate
tests; workflow YAML, shell syntax, `pnpm dev:check`, local links and graph integrity.
An independent exact-range source review found no actionable findings. CodeRabbit
reported that review was skipped for this base branch; it is not counted as a
source review. Room/API runtime checks were not repeated locally for unchanged
runtime code; the configured GitHub CI and room/P2P workflows passed after merge.

The two skipped Staging Smoke event runs correspond to non-success deployment
status events; the later success-triggered smoke runs completed successfully.

## Frozen tester artifact

- Source SHA: `e5cf589a2863f303471266b5062404842f80d77c`.
- Build ID: `e5cf589a2863f303471266b5062404842f80d77c-staging-196`.
- Manifest: AniDachi Staging, version `0.1.0`, stable extension ID
  `ndkfphbchhfephdodcpehdcoclojagje`.
- ZIP: `artifacts/anidachi-extension-staging-e5cf589a.zip` in the release worktree;
  710,778 bytes, 14 entries, manifest at ZIP root.
- SHA-256: `71c6cb16255a3eb4585c5c4889a6a2ddfe1c7607402c0272c46dd679f5039326`.
- Unpacked copy: `artifacts/release-staging-20261002/unpacked-e5cf589a`.
- The local channel validator checked stable identity, exact host allowlists,
  public resources, production React runtime and diagnostic staging build ID.
- Raw checks and artifact metadata remain ignored under
  `artifacts/release-staging-20261002/`; no generated ZIP/folder is committed.

This is a **staging tester package**, not the production Chrome Web Store package.
After loading/reloading it, reload existing YouTube/Crunchyroll tabs to replace
content scripts from the old extension context.

## Manual acceptance still open

1. Without pressing Got it, close and reopen the popup and switch Watch/People/
   Inbox/Settings: the welcome remains. After Got it and reopening, it stays hidden.
   Existing recording preferences are preserved.
2. Finish any remaining provider/normal/fullscreen and real open-room payment-loss
   acceptance from the transition checklist. Automated room/P2P checks and the
   Sandbox hosted-invoice 3DS result do not prove these user flows.
3. Accept the staged candidate before freezing the separately gated production
   package. Verify compatibility with current production, the production public
   push key and the highest uploaded Store version at that step.

## Preserved boundaries and recovery

A fresh fetch after staging delivery still showed main at
`a5a0134e1d661324061e10ef611dfb373cbe47bd`. Standing promotion PR #376 is open with
`autoMergeRequest=null`. This block made no LIVE Stripe changes, main promotion,
production env/deploy action, Store upload/publication or production activation T.
All purchased subscriptions remain outside this delivery's mutation scope.

If these staging changes need correction, use a focused staging PR and rebuild
its tester artifact. Do not reset branches, rewrite subscriptions or automatically
roll back to the old production Worker; terminal billing-intent compatibility still
applies. Keep the source/hash above for reproducibility and follow the separately
approved [production preparation procedure](production-preparation-2026-10-02.md).
