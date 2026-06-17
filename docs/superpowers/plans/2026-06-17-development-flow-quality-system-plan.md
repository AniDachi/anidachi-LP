# Development Flow Quality System Plan

> **For agentic workers:** This plan is the source of truth for improving how
> Anidachi is developed before more product work continues. Implement it
> task-by-task, update checkboxes as work lands, and record every external
> dashboard change in the Progress Log. Do not treat this plan as permission to
> bypass the existing `feature branch -> staging -> main` workflow.

**Goal:** Turn Anidachi development into a repeatable quality system for human
and AI contributors: every worker can understand the project quickly, every PR
has the right context and review rules, staging remains safe, releases are
verifiable, and product work resumes only after the development flow is
predictable.

**Created:** 2026-06-17.

**Current observed baseline:**

- Repository: `AniDachi/anidachi-LP`.
- Local branch during planning: `staging`.
- `staging` and `main` are protected branches.
- Normal flow is `feature/codex branch -> PR -> staging -> tested promotion -> main`.
- `staging.anidachi.app` is the canonical internal staging web surface and must
  remain password-gated/noindex.
- Production API deploy was unblocked after enabling Analytics Engine and
  replacing the Cloudflare GitHub Actions token.
- CodeRabbit is connected but the repo does not yet have `.coderabbit.yaml`.
- Graphify CLI is installed locally, but no `graphify-out/graph.json` exists.
- The repo does not yet have root `AGENTS.md`, `CLAUDE.md`, or `CODEX.md`.
- Main product work is currently queued on the room/P2P hardening plan, with
  Block 6 next.

**References checked during planning:**

- OpenAI Codex best practices: `https://developers.openai.com/codex/learn/best-practices`
- OpenAI Codex skills best practices: `https://developers.openai.com/codex/skills`
- AGENTS.md standard: `https://agents.md`
- Graphify: `https://github.com/safishamsi/graphify`, `https://graphify.net`
- GitHub protected branches: `https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches`
- CodeRabbit commands/configuration/path instructions:
  `https://docs.coderabbit.ai/guides/commands`,
  `https://docs.coderabbit.ai/configuration/path-instructions`,
  `https://docs.coderabbit.ai/getting-started/yaml-configuration`
- Vercel environments and environment variables:
  `https://vercel.com/docs/deployments/environments`,
  `https://vercel.com/docs/environment-variables`
- Cloudflare Durable Object WebSocket Hibernation:
  `https://developers.cloudflare.com/durable-objects/best-practices/websockets/`
- Playwright best practices: `https://playwright.dev/docs/best-practices`

---

## Target Operating Model

### Contributor Workflow

```txt
sync staging
  -> create feature/codex branch
  -> read AGENTS.md + current state + relevant plan
  -> make scoped changes
  -> run local verification
  -> open PR into staging
  -> CI + CodeRabbit + focused human/agent review
  -> merge to staging
  -> staging deploy + staging/manual acceptance when needed
  -> promotion PR to main
  -> production deploy + rollback-ready verification
```

### Quality Gates By Change Type

| Change Type | Required Before Merge To `staging` | Required Before Promotion To `main` |
| --- | --- | --- |
| Docs only | spelling/link sanity, docs map still accurate | allowed auto-promotion if safe-path workflow accepts it |
| Site UI/content | `pnpm check`, relevant web tests, Vercel preview visual check | staging URL smoke and noindex/gate check if staging-affecting |
| Auth/payments/API | `pnpm check`, unit tests, API tests, CodeRabbit review, secret/env check | staging auth/API smoke, rollback path known |
| Extension | extension typecheck/tests, staging build validation, permissions audit | real Chrome profile test with staging artifact |
| Room/P2P/Worker | API tests, signaling harness, WebRTC harness, staging smoke | two-profile/two-machine manual acceptance and scorecard notes |
| GitHub Actions/deploy | action lint/log review, dry-run where possible, no broad secret exposure | one successful workflow run on target branch |

### Non-Negotiable Rules

- Never push directly to `main`.
- Never force-push protected shared branches.
- Never commit secrets, generated extension zips, local debug exports, or
  Graphify heavy outputs unless explicitly approved.
- Keep staging gated, noindex, and absent from public SEO surfaces.
- Keep extension store builds narrowly permissioned; broad builds are local-only.
- Any AI-generated code is treated as untrusted until tests, review, and
  project-specific checks pass.
- For room/P2P work, do not mark complete without harness evidence and staging
  acceptance notes.

---

## Block 0 - Stabilize The Working Baseline

**Why first:** implementation should start from a clean, current branch with no
unclear local state.

**Files:** none unless a status note is needed.

- [x] 0.1 Confirm local `staging` matches `origin/staging`.
  - Command: `git status --short --branch`
  - Command: `git pull --ff-only origin staging`
  - Acceptance: no local uncommitted changes; no branch drift.
- [x] 0.2 Confirm no open PR is waiting unexpectedly.
  - Command: `gh pr list --repo AniDachi/anidachi-LP --state open`
  - Acceptance: any open PR has an owner, base branch, and next action.
- [x] 0.3 Confirm latest `main` deploy health after the Cloudflare token fix.
  - Command: `gh run list --repo AniDachi/anidachi-LP --branch main --limit 10`
  - Acceptance: CI, extension build, Deploy API, and smoke status are understood.
- [x] 0.4 Record the baseline in this Progress Log before changing process files.

---

## Block 1 - Add One Canonical Agent Entry Point

**Why:** Codex, Claude, Cursor, CodeRabbit, and future agents need one concise
starting point. Project docs already exist, but there is no predictable root
instruction file.

**Files:**

- Add: `AGENTS.md`
- Update if needed: `README.md`
- Update if needed: `docs/current-development-state.md`

**Steps:**

- [x] 1.1 Create root `AGENTS.md`.
  - It must be short enough to read every session.
  - It must point to the active docs rather than duplicating everything.
  - It must contain the exact Git flow.
- [x] 1.2 Include required context order for agents:
  1. `docs/project-operating-manual.md`
  2. `docs/current-development-state.md`
  3. `docs/project-architecture-and-development.md`
  4. relevant feature plan under `docs/superpowers/plans/`
- [x] 1.3 Include command map:
  - install/check/test commands;
  - web/API/extension build commands;
  - room/P2P harness commands;
  - staging smoke commands.
- [x] 1.4 Include safety rules:
  - no secrets;
  - no direct `main`;
  - no generated artifacts in git;
  - staging private/noindex;
  - extension narrow permissions.
- [x] 1.5 Include "done means" rules by change class.
- [x] 1.6 Add a README pointer to `AGENTS.md` for AI contributors.

**Acceptance:** a new AI can read one file and know where to look, what branch to
use, what commands to run, and what must never be changed casually.

---

## Block 2 - Configure CodeRabbit As A Contextual Reviewer

**Why:** CodeRabbit is useful only if it reviews against Anidachi-specific
constraints. Generic review will miss project invariants and produce noise.

**Files:**

- Add: `.coderabbit.yaml`
- Optional update: `AGENTS.md`

**Steps:**

- [x] 2.1 Add `.coderabbit.yaml` in repo root.
  - Use English output.
  - Keep auto-review enabled.
  - Keep draft review disabled unless we decide otherwise.
  - Keep `request_changes_workflow` off initially; advisory mode first.
- [x] 2.2 Add path instructions for `apps/api/**`.
  - Focus: auth, authorization, room token verification, CORS, TURN cost,
    Durable Object state, hibernation compatibility, alarm behavior, quota
    metering, no raw PII in telemetry.
- [x] 2.3 Add path instructions for `apps/extension/**`.
  - Focus: Chrome MV3 behavior, content-script safety, narrow permissions,
    auth pickup, room reconnect behavior, WebRTC renegotiation risk, no broad
    store permissions.
- [x] 2.4 Add path instructions for `apps/web/**`.
  - Focus: staging gate, noindex, OAuth redirect flows, Supabase access/RLS,
    room create/join/end semantics, subscription/payment safety.
- [x] 2.5 Add path instructions for `packages/protocol/**`.
  - Focus: backward compatibility across web/API/extension, generation/seq
    semantics, event shape migrations.
- [x] 2.6 Add path instructions for `.github/**`.
  - Focus: least-privilege tokens, branch safety, no manual production deploys
    from feature branches, unique job names, no secret echoing.
- [x] 2.7 Add ignore filters for generated/heavy files.
  - Candidate ignores: extension outputs, zips, coverage, `.next`, build dirs,
    debug exports, Graphify outputs if kept local.
- [ ] 2.8 Open a small PR and ask CodeRabbit for `@coderabbitai configuration`.
  - Acceptance: CodeRabbit sees the config and reviews a test PR with the
    expected path-specific emphasis.

**Acceptance:** CodeRabbit comments become project-aware enough to use as a
standard PR checklist, while remaining advisory until false-positive quality is
understood.

---

## Block 3 - Build A Local Project Knowledge Graph

**Why:** Anidachi has multiple planes: web, Worker, extension, protocol, CI,
docs, Supabase. Graphify can reduce onboarding time and help agents trace
cross-cutting flows before modifying them.

**Files:**

- Generated local: `graphify-out/`
- Optional committed summary: `docs/project-knowledge-map.md`
- Optional ignore update: `.gitignore`

**Steps:**

- [x] 3.1 Decide output policy before running.
  - Default: keep `graphify-out/` local and ignored.
  - Commit only a curated lightweight summary if useful.
- [x] 3.2 Add/confirm `.gitignore` coverage for heavy Graphify artifacts.
  - If `graphify-out/` is ignored, document how to regenerate it.
- [ ] 3.3 Run a scoped first graph, not the entire repo blindly.
  - Recommended scope: `docs`, `apps/web`, `apps/api`, `apps/extension`,
    `packages/protocol`, `.github`.
  - Avoid generated caches and large JSON fixtures unless needed.
- [ ] 3.4 Review `GRAPH_REPORT.md`.
  - Extract: god nodes, surprising connections, suggested questions.
  - Check for obvious bad edges or misleading generated conclusions.
- [x] 3.5 Create `docs/project-knowledge-map.md` only if the report adds value.
  - Include: main communities, key flows, how to query/update graph.
  - Do not paste huge generated output into docs.
- [ ] 3.6 Use Graphify before Block 6 P2P work.
  - Query examples:
    - "How does room token auth connect web API, Worker, and extension?"
    - "Trace P2P signaling from extension to Durable Object and back."
    - "What files are involved in room lifecycle and quota?"

**Acceptance:** agents can answer architecture/path questions from a graph
without repeatedly rereading the whole repository, and Graphify does not pollute
git with unstable generated files.

---

## Block 4 - Formalize PR Templates And Review Checklists

**Why:** AI work fails when intent is vague. Every PR should state risk,
verification, and rollout path.

**Files:**

- Add or update: `.github/pull_request_template.md`
- Optional add: `.github/ISSUE_TEMPLATE/`
- Update: `AGENTS.md`

**Steps:**

- [x] 4.1 Add a PR template with:
  - goal;
  - changed areas;
  - risk class;
  - verification commands;
  - screenshots/recordings if UI;
  - extension artifact details if extension;
  - staging acceptance status if needed;
  - rollback notes.
- [x] 4.2 Add a room/P2P-specific PR section.
  - Harness run;
  - staging/manual test;
  - scorecard impact;
  - event/protocol compatibility.
- [x] 4.3 Add a security/env section.
  - New secrets/env vars;
  - OAuth redirect changes;
  - Cloudflare/Vercel/GitHub dashboard changes;
  - data/PII impact.
- [x] 4.4 Add "AI contribution" section.
  - Which agent/tool did the work;
  - which docs/plans were read;
  - what was manually verified.

**Acceptance:** PR reviewers and CodeRabbit have enough intent to judge changes
against project goals, not just diff shape.

---

## Block 5 - Make Local Verification Easy And Standard

**Why:** contributors should not guess which checks to run. AI agents need a
single command map to avoid under-testing risky changes.

**Files:**

- Add: `scripts/dev-check.mjs` or equivalent shell script
- Optional update: `package.json`
- Update: `AGENTS.md`
- Update: `docs/development-environments.md`

**Steps:**

- [x] 5.1 Define check profiles:
  - `docs`: markdown/link sanity if available;
  - `web`: web typecheck/tests;
  - `api`: api check/tests and Worker dry-run;
  - `extension`: extension check/tests/build validation;
  - `rooms`: signaling harness + WebRTC harness;
  - `all`: current CI-equivalent.
- [x] 5.2 Add package scripts where missing.
  - Avoid giant slow default for small docs-only changes.
  - Make high-risk profiles explicit and documented.
- [x] 5.3 Add a script that prints next recommended commands by changed files.
  - Example: changed `apps/extension/src/p2p-media.ts` -> extension tests +
    WebRTC harness + staging extension build validation.
- [x] 5.4 Ensure Node version/pnpm version are documented.
- [x] 5.5 Keep output concise enough for AI agents to parse.

**Acceptance:** before opening a PR, a contributor can run one command to know
which checks are required and then run them locally.

---

## Block 6 - Strengthen CI Without Blocking Fast Iteration

**Why:** branch protection currently centers on `check-and-test`; high-risk
paths need targeted checks to run reliably and eventually become required.

**Files:**

- `.github/workflows/*.yml`
- `docs/current-development-state.md`

**Steps:**

- [x] 6.1 Audit workflow triggers and job names.
  - Ensure required check names are unique and stable.
  - Ensure sensitive path workflows run on the correct PRs.
- [x] 6.2 Confirm `Build Extension` validates artifacts for staging/public.
- [x] 6.3 Confirm `Deploy API` can only deploy from `staging` or `main`.
- [x] 6.4 Make room/P2P harness checks visible on relevant PRs.
  - Keep non-required until stable.
  - Promote to required once flakiness is understood.
- [ ] 6.5 Add workflow summary output for artifact hashes and endpoints.
- [x] 6.6 Add dependency/cache policy notes.
  - Keep lockfile frozen.
  - Avoid unreviewed dependency churn.
- [x] 6.7 Document which checks are required for `staging` and `main`.

**Acceptance:** CI catches the same categories humans care about, without
turning every minor docs change into a long release pipeline.

---

## Block 7 - Lock Environment And Secret Hygiene

**Why:** recent Cloudflare Analytics Engine/token work showed external settings
can block deploys. These settings need a matrix and audit cadence.

**Files:**

- Add or update: `docs/environment-and-secrets-matrix.md`
- Update: `docs/current-development-state.md`
- Update: `AGENTS.md`

**Steps:**

- [x] 7.1 Document Vercel env matrix.
  - Production vs Preview/staging.
  - Include staging gate vars, noindex, site URL, OAuth/Supabase public vars.
- [x] 7.2 Document GitHub variables/secrets.
  - Repo-level vs environment-level.
  - Cloudflare deploy token scopes.
  - Chrome extension build variables.
- [x] 7.3 Document Cloudflare account resources.
  - Worker names;
  - Analytics Engine datasets;
  - Durable Object bindings;
  - TURN credentials;
  - required token permissions.
- [x] 7.4 Document OAuth redirect allowlists.
  - Google;
  - Discord;
  - staging extension redirect;
  - production extension redirect.
- [x] 7.5 Add a "when changing env" checklist.
  - Change dashboard;
  - trigger new deployment;
  - verify workflow;
  - update docs;
  - record in Progress Log.
- [ ] 7.6 Confirm secrets are not printed by scripts or CI logs.
  - Status: documented as a review rule; full workflow log audit is still
    pending in Block 6.

**Acceptance:** a future deploy failure can be diagnosed from docs and workflow
logs without guessing which dashboard setting is missing.

---

## Block 8 - Define Staging Acceptance As A Release Gate

**Why:** staging is useful only if it has a repeatable manual and automated
acceptance protocol.

**Files:**

- Update: `docs/development-environments.md`
- Add optional: `docs/staging-acceptance-checklist.md`
- Update: `docs/current-development-state.md`

**Steps:**

- [x] 8.1 Create a concise staging acceptance checklist.
  - login via Google/Discord;
  - extension sign-in;
  - room create;
  - invite join;
  - video visible both ways;
  - push-to-talk;
  - reload recovery;
  - room end;
  - debug export capture.
- [x] 8.2 Split checklist by change type.
  - site-only;
  - extension;
  - API/Worker;
  - P2P/room.
- [x] 8.3 Define required test profiles.
  - same machine two Chrome profiles;
  - two machines if P2P/media changed;
  - different network if connectivity changed.
- [x] 8.4 Define what evidence to attach to PRs.
  - artifact hash;
  - extension version_name;
  - screenshots/video if UI;
  - scorecard/debug exports for P2P.
- [ ] 8.5 Keep staging noindex/gate checks in smoke tests.
  - Status: documented in the checklist; automated smoke coverage remains a
    follow-up unless already present in CI.

**Acceptance:** before promoting high-risk work to `main`, there is a clear
yes/no staging checklist, not an informal "looks okay".

---

## Block 9 - Add Rollback And Incident Runbooks

**Why:** quality includes the ability to undo safely. This matters for extension,
Worker, web deploy, OAuth, and env changes.

**Files:**

- Add: `docs/release-and-rollback-runbook.md`
- Update: `AGENTS.md`

**Steps:**

- [x] 9.1 Document web rollback.
  - Vercel deployment rollback/promote previous deployment.
- [x] 9.2 Document Worker rollback.
  - Wrangler rollback/redeploy previous commit.
  - Required secrets/token assumptions.
- [x] 9.3 Document extension rollback.
  - Previous Chrome Web Store artifact.
  - Where artifacts are stored.
  - How to validate version/channel.
- [x] 9.4 Document OAuth/env rollback.
  - Revert dashboard setting;
  - trigger fresh deploy;
  - verify auth flow.
- [x] 9.5 Add incident notes template.
  - symptom;
  - affected environment;
  - suspected deploy;
  - mitigation;
  - final fix.

**Acceptance:** if a deployment breaks rooms/auth/extension, the next action is
documented and does not depend on memory.

---

## Block 10 - Integrate The Flow Into Product Planning

**Why:** this plan must change daily behavior, not become another static doc.

**Files:**

- Update: `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`
- Update: `docs/current-development-state.md`
- Optional update: `README.md`

**Steps:**

- [x] 10.1 Add a development-flow gate before starting P2P Block 6.
  - Required: `AGENTS.md`, `.coderabbit.yaml`, PR template, env matrix.
  - Recommended: Graphify map.
- [x] 10.2 Link this plan from current development state.
- [x] 10.3 Add a small "how to start next task" section to README.
- [ ] 10.4 When Block 1-4 land, use them on the next real PR.
- [ ] 10.5 After two real PRs, review the process for friction.
  - If CodeRabbit noisy, tune path instructions.
  - If checks slow, split profiles.
  - If agents still miss context, improve `AGENTS.md`.

**Acceptance:** the next product task starts with the new flow and produces a PR
that contains clear intent, verification, CodeRabbit feedback, and staging plan.

---

## Implementation Order

```txt
Day 1:
  Block 0 -> Block 1 -> Block 2 -> Block 4

Day 2:
  Block 3 -> Block 5 -> Block 7

Day 3:
  Block 6 -> Block 8 -> Block 9 -> Block 10

Then:
  Resume P2P Block 6 using the new flow.
```

If time is limited, the minimum viable process upgrade is:

```txt
AGENTS.md + .coderabbit.yaml + PR template + env/secrets matrix
```

Graphify and advanced CI tuning can follow immediately after, but should not
block urgent product hotfixes.

---

## Definition Of Done

- Root `AGENTS.md` exists and gives every AI/human contributor the same startup
  instructions.
- CodeRabbit has repo-specific path instructions and is verified on at least one
  PR.
- Graphify graph is either built locally and documented, or a deliberate decision
  is recorded to defer it.
- PR template requires risk, verification, staging, and rollback notes.
- Local check profiles are documented and easy to run.
- CI workflow expectations are documented and aligned with branch protection.
- Environment/secrets matrix is documented for Vercel, GitHub, Cloudflare,
  OAuth, Supabase, and extension builds.
- Staging acceptance checklist exists and is used before high-risk promotion.
- Rollback runbook exists.
- `docs/current-development-state.md` points to this plan and reflects the new
  operating model.

---

## Progress Log

- [x] 2026-06-17: Plan created after reviewing current repo state, existing
  workflow hardening plan, CodeRabbit/Graphify availability, and current
  external best-practice docs. Local `staging` was fast-forwarded to
  `origin/staging` before writing this plan.
- [x] 2026-06-17: Implementation branch
  `codex/development-flow-quality-system` created from current `staging`.
  Added `AGENTS.md`, `.coderabbit.yaml`, PR template, `pnpm dev:check`,
  env/secrets matrix, staging acceptance checklist, release/rollback runbook,
  Graphify policy, README/current-state links, and the P2P Block 6
  development-flow gate.
- [ ] 2026-06-17: Remaining follow-ups after this PR lands: ask CodeRabbit for
  `@coderabbitai configuration` on the PR, run a scoped Graphify graph before
  P2P Block 6, add workflow summary output if useful, and revisit process
  friction after two real PRs.
