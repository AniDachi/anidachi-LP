# Development Quality Gates

This document maps change types to the checks and evidence expected before a PR
is treated as ready. It complements root `AGENTS.md`, `pnpm dev:check`,
CodeRabbit, and `docs/staging-acceptance-checklist.md`; it does not replace
human judgment.

## Baseline For Every Change

- Check branch and worktree state before editing.
- Keep intended changes separate from pre-existing dirty files.
- Run `pnpm dev:check` before opening a PR, then run the recommended profile.
- Update docs in the same PR when behavior, ownership, endpoints, env, release
  flow, protocol, or user-facing workflow changes.
- Use Graphify before broad cross-plane work. Run `pnpm graph:update` after
  meaningful code, docs, or architecture changes.
- In the PR template, record verification, staging/release impact, docs status,
  Graphify status, and rollback notes.

## Gate Matrix

| Change type | Required before PR to `staging` | Required before promotion to `main` |
| --- | --- | --- |
| Docs/process only | Link/path sanity, no contradiction with `docs/current-development-state.md`, `pnpm dev:check` if repo files changed | Usually safe for auto-promotion if workflow allows it |
| Web/site UI or account dashboard | `pnpm --filter @anidachi/web check`; web tests when logic changes; screenshot/recording for visual behavior | Staging web smoke when user-facing behavior changed |
| Auth/session/OAuth | Web check/tests; extension auth consumer check when relevant; env/redirect docs reviewed | Staging login/connect flow verified |
| Billing/subscriptions | Web check/tests; Stripe/env impact documented; pricing docs checked | Staging checkout/webhook smoke or deliberate exception recorded |
| API/Worker/Durable Objects | API check/tests; runtime tests when Worker bindings/DO behavior changes; secret/env review | `pnpm smoke:worker:staging` and rollback path known |
| Extension runtime/UI | Extension check/tests; staging build and artifact validation when behavior or manifest changes; permissions audit | Load staging artifact in Chrome and verify relevant flow |
| Room/P2P/media/audio | Protocol/API/extension checks as affected; `pnpm harness:rooms`; real WebRTC harness or reasoned exception | Staging two-profile/two-device acceptance for high-risk media work |
| Shared protocol | Protocol check/tests plus affected consumer checks; compatibility notes | Staging acceptance for changed room/auth/media contracts |
| CI/deploy/env | Workflow/config review; least-privilege secret check; dry-run where available | One successful target workflow or documented manual verification |

## Evidence To Capture

- Commands run and pass/fail summaries.
- Changed planes and risk class.
- Staging URL, Worker smoke, extension `version_name`, or artifact path when
  relevant.
- Screenshots or short recording for visual changes.
- Debug exports or scorecard summaries for room/P2P changes when available.
- Docs updated or explicit reason docs were not needed.
- Graphify updated or explicit reason it was not needed.

## Exceptions

Small docs-only or comment-only changes do not need heavy runtime checks. Any
exception for high-risk auth, billing, API, extension, protocol, room/P2P,
deploy, or env work must be recorded in the PR with the reason and remaining
risk.
