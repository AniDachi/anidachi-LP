# Handoff For AI Working On AniDachi Site Pages

This file is a copy-paste brief for another AI or developer who will work on
AniDachi website pages.

## Project In One Paragraph

AniDachi is a monorepo for the public website, Chrome extension, realtime room
API, shared protocol, SEO/content pages, and internal tools. The website lives
in `apps/web` and is a Next.js App Router app. The extension lives in
`apps/extension`. The API lives in `apps/api`. Do not treat this as a simple
landing-page-only repository.

## Source Of Truth

Before changing code, read these files:

- `docs/project-operating-manual.md`
- `docs/current-development-state.md`
- `docs/project-architecture-and-development.md`
- `README.md`
- For SEO/content pages: `apps/web/docs/seo-content-guidelines.md`

Historical plans under `docs/superpowers/plans/` can be useful, but they may be
outdated. Prefer `docs/current-development-state.md` for current branches,
endpoints, and workflow.

## Branch Model

- `main` is production.
- `staging` is the shared test branch.
- Feature work starts from fresh `staging`.
- `staging` accepts normal direct pushes from trusted collaborators.
- Open PRs into `main` only; do not push directly into `main`.
- For safe site/docs changes, `staging` promotes to `main` automatically.
- Never force-push `staging` or `main`.

Start like this:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
git switch -c feature/site-pages
pnpm install --frozen-lockfile
```

Use a clear branch name. If running as Codex, use `codex/<task-name>`.

For direct staging work, push the local `staging` branch normally:

```bash
git push origin staging
```

If you worked on a feature branch instead, push that branch and merge it into
`staging` when ready:

```bash
git push -u origin feature/site-pages
```

If the remote points to the old repository, update it first:

```bash
git remote set-url origin git@github.com:AniDachi/anidachi-LP.git
git remote -v
```

## How Site Changes Reach Main

When a PR is merged into `staging`, GitHub runs
`Promote Site Staging to Main`.

That workflow compares the full `main..staging` diff.

If all changed files are safe site/docs paths, it:

- creates or updates a PR from `staging` to `main`;
- enables auto-merge;
- waits for required checks;
- merges into `main` automatically.

So for normal website page work, the flow is:

```txt
feature branch -> PR to staging -> staging deploy -> auto PR staging to main -> auto-merge to main
```

The human should not need to approve every safe site-only promotion.

## Paths That Are Safe For Site-Only Auto-Promotion

Usually safe:

- `README.md`
- `docs/**`
- `apps/web/app/**`
- `apps/web/components/**`
- `apps/web/lib/**`
- `apps/web/docs/**`
- `apps/web/public/**`
- `apps/web/assets/**`

Even inside `apps/web`, some areas are sensitive and block auto-promotion.

## Paths That Block Auto-Promotion

Do not touch these unless the task explicitly asks for them and the user knows
this will require manual review/promotion:

- `.github/**`
- `apps/api/**`
- `apps/extension/**`
- `packages/**`
- `scripts/**`
- `infra/**`
- root config like `package.json`, `pnpm-lock.yaml`, `turbo.json`,
  `tsconfig.base.json`, `biome.json`
- `apps/web/middleware.ts`
- `apps/web/app/api/**`
- `apps/web/app/login/**`
- `apps/web/app/extension/**`
- `apps/web/app/room/**`
- `apps/web/app/success/**`
- `apps/web/app/blou/**`
- `apps/web/app/kreatli-email-crm/**`
- auth/session/stripe/internal libraries under `apps/web/lib/**`

If your diff touches any of these, do not promise automatic promotion to
production. Say clearly that it needs manual handling.

## Staging Environment

Staging web:

```txt
https://staging.anidachi.app
```

Staging API:

```txt
https://anidachi-api-staging.vladislav-gul7.workers.dev
```

Staging is internal. It must stay:

- password-gated;
- `noindex`;
- excluded from the sitemap;
- absent from public SEO/marketing copy.

It may appear in internal docs, env vars, OAuth callback allowlists, staging
extension builds, and test instructions.

Do not add `staging.anidachi.app` to public-facing content.

## Production Environment

Production web:

```txt
https://www.anidachi.app
```

Production API:

```txt
https://anidachi-api-production.vladislav-gul7.workers.dev
```

Production changes come through `main`, not direct edits.

## Checks To Run

For normal website/content work:

```bash
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
```

For broader changes:

```bash
pnpm check
pnpm test
```

If extension code is touched:

```bash
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm build:extension:staging
pnpm validate:extension:staging
```

If API/protocol is touched:

```bash
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/api test
pnpm smoke:worker:staging
```

## Rules For Another AI

Follow these rules strictly:

1. Read the current docs before editing.
2. Start from fresh `staging`.
3. Keep the PR small and focused.
4. For website pages, prefer existing components and patterns in `apps/web`.
5. Do not modify extension/API/workflows/auth/payment code unless explicitly
   asked.
6. Do not remove or weaken the staging password gate or noindex behavior.
7. Do not expose secrets or write real secret values into git.
8. Do not commit generated extension folders or zip artifacts.
9. Run relevant checks and report exactly what passed or failed.
10. Push to `staging` or open a PR to `staging`, depending on the task owner.

## What To Tell The User After Work

Report:

- branch name;
- PR URL;
- changed files summary;
- checks run;
- whether the change is safe site/docs-only and should auto-promote from
  `staging` to `main`;
- anything that blocks auto-promotion.

## Current Expected Workflow Summary

For ordinary site page work:

```txt
work on feature branch from staging
open PR to staging
merge after checks
verify staging.anidachi.app
auto-promotion creates/updates staging -> main PR
auto-merge sends safe changes to main
production deploy runs from main
```

For extension/API/auth/workflow work:

```txt
work on feature branch from staging
open PR to staging
merge after checks
verify staging manually
manual promotion to main only when ready
```
