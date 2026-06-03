# Main Repository Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `George-Kreatli/anidachi-LP` the single source-of-truth repository for Anidachi, with a clean monorepo layout, staging/production environments, safe CI/CD, and a development workflow that supports two people working without breaking the live product.

**Architecture:** Convert the current website repository into a pnpm/Turborepo monorepo. The existing website moves into `apps/web`, the current extension/Worker/demo/protocol code moves into sibling workspace packages, and generated extension folders stay out of git. Production deploys only from protected `main`; staging deploys from `staging`; feature branches use PR preview deployments.

**Tech Stack:** GitHub, pnpm 11.2.2, Turborepo, Next.js 15, WXT, Cloudflare Workers/Wrangler environments, Supabase migrations, Vercel monorepo Root Directory, GitHub Actions, Chrome unpacked extension builds.

---

## Current Status

- [x] Target GitHub repo is `George-Kreatli/anidachi-LP`.
- [x] Target repo default branch is `main`.
- [x] Target repo current inspected commit is `bd5f6ab5781e9a8dd74af43c207c4c5876ec8c70`.
- [x] Target repo is currently a Next.js App Router app at repository root.
- [x] Target repo already contains Anidachi website auth, room APIs, extension auth APIs, and Supabase migrations.
- [x] Target repo currently uses `npm` and `package-lock.json`.
- [x] Target repo has no root `pnpm-workspace.yaml`, `turbo.json`, or GitHub Actions CI.
- [x] Current local Anidachi monorepo exists at `/Users/vladyslavhulyi/anidachi`.
- [x] Current local working product checkpoint exists on `main` with tag `v0.1.0-working-mvp`.
- [x] Full auth/product work exists in `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration` on branch `codex/auth-integration`.
- [x] Existing product architecture plan exists at `/Users/vladyslavhulyi/anidachi/docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md`.
- [ ] `George-Kreatli/anidachi-LP` is not yet a monorepo.
- [ ] `apps/extension`, `apps/api`, `apps/demo`, and `packages/protocol` are not yet inside `George-Kreatli/anidachi-LP`.
- [ ] Vercel is not yet configured with `apps/web` as Root Directory.
- [ ] Cloudflare Worker staging/production environments are not yet configured in the target repo.
- [ ] GitHub branch protection and required checks are not yet confirmed.
- [ ] Staging domain/environment is not yet confirmed.

## Non-Negotiable Rules

- [ ] Do not migrate generated folders as source code.
- [ ] Do not move secrets into git.
- [ ] Do not change production domain behavior during the monorepo migration.
- [ ] Do not mix room/P2P architecture refactors into the repository migration PR.
- [ ] Do not delete current website functionality while moving it into `apps/web`.
- [ ] Do not use the old Vercel CVE branch as migration base; it diverges from current `main`.
- [ ] Do not deploy production from an unreviewed migration branch.

## Target Repository Layout

```txt
George-Kreatli/anidachi-LP/
  apps/
    web/          # Next.js site, auth, rooms, Stripe, SEO, Supabase migrations
    extension/    # WXT Chrome extension
    api/          # Cloudflare Worker + Durable Objects
    demo/         # Local HTML5 video demo page

  packages/
    protocol/     # Zod room protocol, sync math, shared types
    db/           # later: database schema/helpers
    auth/         # later: shared auth/token helpers
    config/       # later: shared env validation

  docs/
    architecture.md
    site-extension-integration-notes.md
    shared-watch-progress-tracker.md
    superpowers/plans/

  scripts/
    build-extension-public.sh
    release-check.sh

  infra/
    cloudflare/
    supabase/
    livekit-legacy/

  .github/
    workflows/
      ci.yml
      deploy-api.yml
      build-extension.yml
```

## Environment Model

```txt
local       developer machine
preview     per pull request / feature branch
staging     branch: staging, domain: staging.anidachi.app
production  branch: main, domain: www.anidachi.app / anidachi.app
```

Rules:

- `main` is production.
- `staging` is a persistent integration branch for testing with another PC/friend before production.
- Feature branches target `staging` first.
- Production release happens by PR from `staging` into `main`.
- Website staging uses Vercel Preview/custom environment.
- Worker staging uses Wrangler `--env staging`.
- Worker production uses Wrangler `--env production`.
- Extension has separate staging and production builds with different `WXT_*` bases.

## Source And Build Output Policy

Move as source code:

```txt
apps/api
apps/demo
apps/extension
apps/web
packages/protocol
docs
infra
scripts
```

Never commit as source:

```txt
node_modules
.next
.turbo
.wrangler
.wxt
.output
dist
out
build
.chrome-cdp-profile
.worktrees
anidachi-extension-public
anidachi-extension-experiment
*.zip
*.crx
*.pem
*.tsbuildinfo
mac*.json
Mac*.json
*.txt debug dumps
.env*
```

Exception:

```txt
.env.example
```

---

## Task 0: Prepare Safe Migration Workspace

**Files:**

- Read: `/tmp/anidachi-LP-current`
- Read: `/Users/vladyslavhulyi/anidachi`
- Read: `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration`
- Modify: no product files

- [x] **Step 0.1: Inspect target repository**

Observed:

```txt
repo: George-Kreatli/anidachi-LP
default branch: main
current inspected commit: bd5f6ab5781e9a8dd74af43c207c4c5876ec8c70
current package manager: npm
current app location: repository root
```

- [x] **Step 0.2: Inspect current local Anidachi monorepo**

Observed:

```txt
local repo: /Users/vladyslavhulyi/anidachi
branch: main
origin: git@github.com:vladyslavgul-stack/anidachi.git
tag: v0.1.0-working-mvp
```

- [x] **Step 0.3: Inspect auth integration worktree**

Observed:

```txt
worktree: /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration
branch: codex/auth-integration
contains: apps/web, apps/extension, apps/api, apps/demo, packages/protocol
```

- [x] **Step 0.4: Create local clone for migration**

Run:

```bash
cd /Users/vladyslavhulyi
git clone git@github.com:George-Kreatli/anidachi-LP.git anidachi-LP-monorepo
cd /Users/vladyslavhulyi/anidachi-LP-monorepo
git switch main
git pull --ff-only
```

Expected:

```txt
Repository is cloned cleanly.
Current branch is main.
Working tree is clean.
```

- [x] **Step 0.5: Create migration branch**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo
git switch -c codex/monorepo-migration
```

Expected:

```txt
New branch codex/monorepo-migration is created.
No production files changed yet.
```

- [x] **Step 0.6: Tag current target repo baseline**

Run:

```bash
git tag before-monorepo-migration-2026-06-03
```

Expected:

```txt
The current website-only repo state has a restore point.
```

---

## Task 1: Move Existing Website Into `apps/web`

**Files:**

- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/app` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/app`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/components` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/components`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/lib` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/lib`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/public` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/public`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/supabase` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/supabase`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/scripts` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/scripts`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/crm-data` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/crm-data`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/docs` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/docs`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/next.config.ts` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/next.config.ts`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/tsconfig.json` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/tsconfig.json`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/postcss.config.mjs` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/postcss.config.mjs`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/eslint.config.mjs` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/eslint.config.mjs`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/components.json` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/components.json`
- Move: `/Users/vladyslavhulyi/anidachi-LP-monorepo/.env.example` -> `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/.env.example`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/package.json`

- [x] **Step 1.1: Create app directory**

Run:

```bash
mkdir -p /Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web
```

Expected:

```txt
apps/web exists.
```

- [x] **Step 1.2: Move website source files**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo
git mv app components lib public supabase scripts crm-data docs next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs components.json .env.example apps/web/
```

Expected:

```txt
Existing website source is preserved under apps/web.
No source file is deleted.
```

- [x] **Step 1.3: Convert website package name**

Modify `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/package.json` to use:

```json
{
  "name": "@anidachi/web",
  "version": "0.1.0",
  "private": true
}
```

Expected:

```txt
The website has a unique workspace package name.
```

- [x] **Step 1.4: Keep current website scripts initially**

Keep these scripts in `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack -p 3003",
    "dev:clean": "rm -rf .next && next dev --turbopack -p 3003",
    "cache:jikan": "tsx scripts/cache-jikan-posters.ts",
    "build": "pnpm cache:jikan && next build",
    "start": "next start",
    "lint": "next lint",
    "crm": "tsx scripts/crm/cli.ts",
    "stripe:webhook:subscription": "tsx scripts/stripe/register-subscription-webhook.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests"
  }
}
```

Expected:

```txt
Website can still be run as a package through pnpm.
```

- [x] **Step 1.5: Verify imports still resolve**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web
rg -n 'from "@/|import\\("@/' app components lib scripts
```

Expected:

```txt
Imports using @/* are visible for verification.
```

- [x] **Step 1.6: Commit website move**

Run:

```bash
git add apps/web
git status --short
git commit -m "chore: move website into apps/web"
```

Expected:

```txt
Commit contains only the website move and package metadata adjustments.
```

---

## Task 2: Convert Repository To pnpm Workspace + Turborepo

**Files:**

- Create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/package.json`
- Create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/pnpm-workspace.yaml`
- Create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/turbo.json`
- Create/Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/tsconfig.base.json`
- Delete: `/Users/vladyslavhulyi/anidachi-LP-monorepo/package-lock.json`
- Create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/pnpm-lock.yaml`

- [x] **Step 2.1: Create root package file**

Create `/Users/vladyslavhulyi/anidachi-LP-monorepo/package.json`:

```json
{
  "name": "anidachi",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@11.2.2",
  "scripts": {
    "build": "turbo build",
    "build:extension:public": "bash scripts/build-extension-public.sh",
    "check": "turbo check",
    "dev:api": "pnpm --filter @anidachi/api dev",
    "dev:demo": "pnpm --filter @anidachi/demo dev",
    "dev:extension": "pnpm --filter @anidachi/extension dev",
    "dev:web": "pnpm --filter @anidachi/web dev",
    "format": "biome format .",
    "lint": "biome lint .",
    "test": "turbo test"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.15",
    "turbo": "^2.9.14",
    "typescript": "^6.0.3",
    "vitest": "^4.0.15"
  }
}
```

Expected:

```txt
Root package controls workspace commands only.
Website dependencies remain in apps/web/package.json.
```

- [x] **Step 2.2: Add pnpm workspace**

Create `/Users/vladyslavhulyi/anidachi-LP-monorepo/pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"

allowBuilds:
  esbuild: true
  sharp: true
  spawn-sync: true
  unrs-resolver: true
  workerd: true

minimumReleaseAgeExclude:
  - '@cloudflare/workers-types@4.20260523.1'
```

Expected:

```txt
pnpm discovers apps and packages.
Vercel can understand workspace package graph.
```

- [x] **Step 2.3: Add Turborepo config**

Create `/Users/vladyslavhulyi/anidachi-LP-monorepo/turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "@anidachi/demo#build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "@anidachi/extension#build": {
      "dependsOn": ["^build"],
      "outputs": [".output/**"]
    },
    "@anidachi/web#build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

Expected:

```txt
Turbo can run check/test/build across all apps.
```

- [x] **Step 2.4: Remove npm lockfile and install pnpm lockfile**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo
rm package-lock.json
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install
```

Expected:

```txt
pnpm-lock.yaml is created.
node_modules installs successfully.
```

- [x] **Step 2.5: Verify website package**

Run:

```bash
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
```

Expected:

```txt
TypeScript check and tests pass or expose only pre-existing website issues.
```

- [x] **Step 2.6: Commit workspace conversion**

Run:

```bash
git add package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml apps/web/package.json
git rm package-lock.json
git commit -m "chore: convert repo to pnpm monorepo"
```

Expected:

```txt
Commit contains package manager/workspace changes.
```

---

## Task 3: Import Extension, Worker, Demo, And Protocol

**Files:**

- Copy from: `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/apps/api`
- Copy from: `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/apps/extension`
- Copy from: `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/apps/demo`
- Copy from: `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/packages/protocol`
- Copy to: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api`
- Copy to: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/extension`
- Copy to: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/demo`
- Copy to: `/Users/vladyslavhulyi/anidachi-LP-monorepo/packages/protocol`

- [x] **Step 3.1: Copy source apps only**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo
mkdir -p apps packages
rsync -a --delete \
  --exclude node_modules \
  --exclude .turbo \
  --exclude .wrangler \
  --exclude .wxt \
  --exclude .output \
  --exclude dist \
  /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/apps/api/ apps/api/
rsync -a --delete \
  --exclude node_modules \
  --exclude .turbo \
  --exclude .wrangler \
  --exclude .wxt \
  --exclude .output \
  --exclude dist \
  /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/apps/extension/ apps/extension/
rsync -a --delete \
  --exclude node_modules \
  --exclude .turbo \
  --exclude .wrangler \
  --exclude .wxt \
  --exclude .output \
  --exclude dist \
  /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/apps/demo/ apps/demo/
rsync -a --delete \
  --exclude node_modules \
  --exclude .turbo \
  --exclude dist \
  /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/packages/protocol/ packages/protocol/
```

Expected:

```txt
Only source, tests, package files, and configs are copied.
Generated folders are not copied.
```

- [x] **Step 3.2: Verify copied package names**

Run:

```bash
node -e "for (const p of ['apps/api/package.json','apps/extension/package.json','apps/demo/package.json','packages/protocol/package.json','apps/web/package.json']) console.log(p, require('./'+p).name)"
```

Expected:

```txt
apps/api/package.json @anidachi/api
apps/extension/package.json @anidachi/extension
apps/demo/package.json @anidachi/demo
packages/protocol/package.json @anidachi/protocol
apps/web/package.json @anidachi/web
```

- [x] **Step 3.3: Install after import**

Run:

```bash
pnpm install
```

Expected:

```txt
Workspace dependencies resolve.
No package-lock.json is recreated.
```

- [x] **Step 3.4: Run app checks**

Run:

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/web check
```

Expected:

```txt
Protocol, API, extension, and web tests/checks pass.
Any failure is fixed before proceeding.
```

- [x] **Step 3.5: Commit product app import**

Run:

```bash
git add apps/api apps/extension apps/demo packages/protocol pnpm-lock.yaml
git commit -m "chore: import extension api demo and protocol"
```

Expected:

```txt
Commit contains imported product apps and updated pnpm lockfile.
```

---

## Task 4: Import Shared Docs, Infra, And Build Scripts

**Files:**

- Copy from: `/Users/vladyslavhulyi/anidachi/docs`
- Copy from: `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/docs`
- Copy from: `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/infra`
- Copy from: `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/scripts`
- Copy to: `/Users/vladyslavhulyi/anidachi-LP-monorepo/docs`
- Copy to: `/Users/vladyslavhulyi/anidachi-LP-monorepo/infra`
- Copy to: `/Users/vladyslavhulyi/anidachi-LP-monorepo/scripts`

- [x] **Step 4.1: Preserve website docs separately**

Before copying root docs, confirm website docs are in:

```txt
apps/web/docs/
```

Expected:

```txt
SEO/content docs stay close to apps/web.
Product/architecture docs live at root docs.
```

- [x] **Step 4.2: Copy architecture docs**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo
mkdir -p docs
rsync -a /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/docs/ docs/
rsync -a /Users/vladyslavhulyi/anidachi/docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md docs/superpowers/plans/
```

Expected:

```txt
Root docs include architecture, integration, progress, experimental features, and superpowers plans.
```

- [x] **Step 4.3: Copy infra and scripts**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo
rsync -a /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/infra/ infra/
rsync -a /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration/scripts/ scripts/
```

Expected:

```txt
infra/livekit and build-extension-public script are available in the target repo.
```

- [x] **Step 4.4: Add this migration plan**

Copy this plan into target repo:

```bash
mkdir -p /Users/vladyslavhulyi/anidachi-LP-monorepo/docs/superpowers/plans
cp /Users/vladyslavhulyi/anidachi/docs/superpowers/plans/2026-06-03-main-repository-monorepo-migration.md \
  /Users/vladyslavhulyi/anidachi-LP-monorepo/docs/superpowers/plans/
```

Expected:

```txt
The migration plan itself travels with the new source-of-truth repo.
```

- [x] **Step 4.5: Commit docs and infra**

Run:

```bash
git add docs infra scripts
git commit -m "docs: add product architecture and migration plans"
```

Expected:

```txt
Docs and supporting scripts are committed separately from source import.
```

---

## Task 5: Normalize `.gitignore` And Build Outputs

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/.gitignore`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/scripts/build-extension-public.sh`

- [x] **Step 5.1: Expand root `.gitignore`**

Ensure `/Users/vladyslavhulyi/anidachi-LP-monorepo/.gitignore` includes:

```gitignore
# dependencies
node_modules/

# build outputs
.next/
out/
build/
dist/
.turbo/
.wrangler/
.wxt/
.output/

# extension generated artifacts
anidachi-extension-public/
anidachi-extension-experiment/
anidachi-extension-public.zip
anidachi-extension-experiment.zip
*.crx
*.pem

# local browser/debug state
.chrome-cdp-profile/
.worktrees/
*.tsbuildinfo
*.log
mac*.json
Mac*.json
*.txt

# env files
.env*
!.env.example

# misc
.DS_Store
.vercel/

# local CRM runtime data
apps/web/crm-data/contacts.json
apps/web/crm-data/touches.jsonl
apps/web/crm-data/gmail-tokens.json
```

Expected:

```txt
Generated output and local debug data do not appear in git status.
```

- [x] **Step 5.2: Make public extension folder a generated output**

Rule:

```txt
Only apps/extension is source. anidachi-extension-public is a generated folder from build:extension:public.
```

Expected:

```txt
The team never edits generated extension folders manually.
```

- [x] **Step 5.3: Verify clean ignore behavior**

Run:

```bash
git status --short --ignored | sed -n '1,200p'
```

Expected:

```txt
Ignored build outputs appear under ignored files only.
No accidental secrets or generated extension folders are staged.
```

- [x] **Step 5.4: Commit ignore rules**

Run:

```bash
git add .gitignore scripts/build-extension-public.sh
git commit -m "chore: ignore generated extension and local debug outputs"
```

Expected:

```txt
Ignore rules are committed before generated builds are created.
```

---

## Task 6: Configure Vercel For Monorepo Website Deploys

**Files:**

- Modify: Vercel project settings
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/.env.example`
- Optional create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/vercel.json`

- [ ] **Step 6.1: Set Vercel Root Directory**

In Vercel project settings:

```txt
Root Directory: apps/web
```

Expected:

```txt
Vercel builds the moved website from apps/web.
```

- [ ] **Step 6.2: Enable access to shared packages**

If `apps/web` imports from `packages/*`, enable in Vercel:

```txt
Include source files outside of the Root Directory: enabled
```

Expected:

```txt
Vercel can build apps/web with workspace dependencies.
```

- [ ] **Step 6.3: Update Vercel install/build commands**

Recommended settings:

```txt
Install Command: corepack enable && corepack prepare pnpm@11.2.2 --activate && pnpm install --frozen-lockfile
Build Command: pnpm --filter @anidachi/web build
Output Directory: apps/web/.next
```

Expected:

```txt
Vercel uses pnpm, not npm.
```

- [ ] **Step 6.4: Configure production env vars**

Production env must include at least:

```txt
NEXT_PUBLIC_SITE_URL=https://www.anidachi.app
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANIDACHI_JWT_SECRET
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
ANIDACHI_GOOGLE_CLIENT_ID
ANIDACHI_GOOGLE_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ANIDACHI_ENFORCE_ROOM_LIMITS=true
```

Expected:

```txt
Production auth, room creation, Stripe, and Supabase access continue working.
```

- [ ] **Step 6.5: Configure staging env vars**

Staging env must include:

```txt
NEXT_PUBLIC_SITE_URL=https://staging.anidachi.app
NEXT_PUBLIC_ROBOTS_NOINDEX=true
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANIDACHI_JWT_SECRET
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
ANIDACHI_GOOGLE_CLIENT_ID
ANIDACHI_GOOGLE_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ANIDACHI_ENFORCE_ROOM_LIMITS=false
```

Expected:

```txt
Staging can test real auth/rooms without indexing and without blocking due to plan limits.
```

- [x] **Step 6.6: Fix import-time Stripe build risk**

If `pnpm --filter @anidachi/web build` fails without Stripe env, move Stripe client creation inside route handlers in:

```txt
apps/web/app/api/create-checkout-session/route.ts
```

Expected:

```txt
Build does not instantiate Stripe at module import unless the endpoint is called.
```

- [x] **Step 6.7: Verify website build locally**

Run:

```bash
pnpm --filter @anidachi/web build
```

Expected:

```txt
Next build succeeds from monorepo.
```

---

## Task 7: Configure Cloudflare Worker Environments

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api/wrangler.toml`
- Modify: GitHub Actions secrets/environments

- [x] **Step 7.1: Add Wrangler staging and production envs**

Modify `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api/wrangler.toml`:

```toml
name = "anidachi-api"
main = "src/index.ts"
compatibility_date = "2026-05-23"
compatibility_flags = ["nodejs_compat"]

[vars]
LIVEKIT_URL = "wss://anidachi-1vnsspf7.livekit.cloud"

[[durable_objects.bindings]]
name = "ROOMS"
class_name = "RoomDurableObject"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RoomDurableObject"]

[env.staging]
name = "anidachi-api-staging"
workers_dev = true

[env.staging.vars]
LIVEKIT_URL = "wss://anidachi-1vnsspf7.livekit.cloud"

[[env.staging.durable_objects.bindings]]
name = "ROOMS"
class_name = "RoomDurableObject"

[env.production]
name = "anidachi-api-production"
workers_dev = true

[env.production.vars]
LIVEKIT_URL = "wss://anidachi-1vnsspf7.livekit.cloud"

[[env.production.durable_objects.bindings]]
name = "ROOMS"
class_name = "RoomDurableObject"
```

Expected:

```txt
Worker can deploy independently to staging and production.
```

- [ ] **Step 7.2: Set Cloudflare staging secrets**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api
pnpm exec wrangler secret put ANIDACHI_JWT_SECRET --env staging
pnpm exec wrangler secret put CLOUDFLARE_TURN_KEY_ID --env staging
pnpm exec wrangler secret put CLOUDFLARE_TURN_KEY_API_TOKEN --env staging
```

Expected:

```txt
Staging Worker can verify room tokens and issue ICE servers.
```

- [ ] **Step 7.3: Set Cloudflare production secrets**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api
pnpm exec wrangler secret put ANIDACHI_JWT_SECRET --env production
pnpm exec wrangler secret put CLOUDFLARE_TURN_KEY_ID --env production
pnpm exec wrangler secret put CLOUDFLARE_TURN_KEY_API_TOKEN --env production
```

Expected:

```txt
Production Worker can verify room tokens and issue ICE servers.
```

- [ ] **Step 7.4: Deploy staging Worker**

Run:

```bash
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/api test
cd /Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api
pnpm exec wrangler deploy --env staging
```

Expected:

```txt
anidachi-api-staging deploy succeeds.
```

- [ ] **Step 7.5: Smoke test staging Worker**

Run:

```bash
curl -s https://anidachi-api-staging.<account-subdomain>.workers.dev/
curl -s https://anidachi-api-staging.<account-subdomain>.workers.dev/ice-servers
```

Expected:

```txt
Root endpoint returns service ok.
ICE endpoint returns STUN/TURN servers.
```

---

## Task 8: Configure Supabase And OAuth For Staging/Production

**Files:**

- Read: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/supabase/migrations`
- Modify: provider dashboards
- Modify: Vercel env settings
- Modify: Cloudflare Worker secrets

- [x] **Step 8.1: Confirm migrations are present**

Run:

```bash
find /Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort
```

Expected:

```txt
20260525_anidachi_auth.sql
20260602_extension_auth.sql
20260602_room_invite_source.sql
```

- [ ] **Step 8.2: Confirm Supabase variables in Vercel**

Required in both staging and production:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Expected:

```txt
Website API routes can read/write auth, rooms, room_members, devices, and extension_auth_codes.
```

- [ ] **Step 8.3: Confirm JWT secret alignment**

Rule:

```txt
Vercel apps/web ANIDACHI_JWT_SECRET must match Cloudflare apps/api ANIDACHI_JWT_SECRET for the same environment.
```

Expected:

```txt
Room tokens generated by website are accepted by Worker.
```

- [ ] **Step 8.4: Add OAuth redirect URLs**

Production:

```txt
https://www.anidachi.app/api/auth/callback/google
https://www.anidachi.app/api/auth/callback/discord
```

Staging:

```txt
https://staging.anidachi.app/api/auth/callback/google
https://staging.anidachi.app/api/auth/callback/discord
```

Expected:

```txt
Login works on staging and production.
```

- [ ] **Step 8.5: Confirm extension auth redirect**

Expected website route:

```txt
https://www.anidachi.app/extension/connect
https://staging.anidachi.app/extension/connect
```

Expected extension behavior:

```txt
chrome.identity.launchWebAuthFlow opens website auth and receives one-time code.
```

- [ ] **Step 8.6: Staging login smoke test**

Manual:

```txt
Open staging.anidachi.app.
Sign in with Google.
Open /api/me in same browser.
Confirm user JSON is returned.
Sign out.
Confirm /api/me returns 401.
```

Expected:

```txt
Staging auth works before extension testing.
```

---

## Task 9: Add GitHub Actions CI

**Files:**

- Create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/.github/workflows/ci.yml`

- [x] **Step 9.1: Add CI workflow**

Create `/Users/vladyslavhulyi/anidachi-LP-monorepo/.github/workflows/ci.yml`:

```yaml
name: CI

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

on:
  push:
    branches:
      - main
      - staging
  pull_request:
    branches:
      - main
      - staging

jobs:
  check-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Enable pnpm
        run: |
          corepack enable
          corepack prepare pnpm@11.2.2 --activate

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm check

      - name: Test
        run: pnpm test
```

Expected:

```txt
Every PR to staging/main runs typecheck and tests.
```

- [x] **Step 9.2: Run CI commands locally before push**

Run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

Expected:

```txt
Local CI commands pass before opening PR.
```

- [x] **Step 9.3: Commit CI**

Run:

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add monorepo check and test workflow"
```

Expected:

```txt
GitHub Actions workflow is committed.
```

---

## Task 10: Add Deployment Workflows

**Files:**

- Create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/.github/workflows/deploy-api.yml`
- Create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/.github/workflows/build-extension.yml`

- [x] **Step 10.1: Add Cloudflare API deploy workflow**

Create `/Users/vladyslavhulyi/anidachi-LP-monorepo/.github/workflows/deploy-api.yml`:

```yaml
name: Deploy API

on:
  push:
    branches:
      - staging
      - main
    paths:
      - "apps/api/**"
      - "packages/protocol/**"
      - "pnpm-lock.yaml"
      - ".github/workflows/deploy-api.yml"

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name == 'main' && 'production' || 'staging' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Enable pnpm
        run: |
          corepack enable
          corepack prepare pnpm@11.2.2 --activate

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check API
        run: pnpm --filter @anidachi/api check

      - name: Test API
        run: pnpm --filter @anidachi/api test

      - name: Deploy Worker
        working-directory: apps/api
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: pnpm exec wrangler deploy --env ${{ github.ref_name == 'main' && 'production' || 'staging' }}
```

Expected:

```txt
Pushing staging deploys staging Worker.
Pushing main deploys production Worker after environment rules.
```

- [x] **Step 10.2: Add extension artifact workflow**

Create `/Users/vladyslavhulyi/anidachi-LP-monorepo/.github/workflows/build-extension.yml`:

```yaml
name: Build Extension

on:
  push:
    branches:
      - staging
      - main
    paths:
      - "apps/extension/**"
      - "packages/protocol/**"
      - "scripts/build-extension-public.sh"
      - "pnpm-lock.yaml"
      - ".github/workflows/build-extension.yml"

jobs:
  build-extension:
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name == 'main' && 'production' || 'staging' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Enable pnpm
        run: |
          corepack enable
          corepack prepare pnpm@11.2.2 --activate

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check extension
        run: pnpm --filter @anidachi/extension check

      - name: Test extension
        run: pnpm --filter @anidachi/extension test

      - name: Build extension
        env:
          WXT_WEB_HTTP_BASE: ${{ vars.WXT_WEB_HTTP_BASE }}
          WXT_API_HTTP_BASE: ${{ vars.WXT_API_HTTP_BASE }}
          WXT_API_WS_BASE: ${{ vars.WXT_API_WS_BASE }}
        run: pnpm --filter @anidachi/extension build

      - name: Upload extension artifact
        uses: actions/upload-artifact@v4
        with:
          name: anidachi-extension-${{ github.ref_name }}
          path: apps/extension/.output/chrome-mv3
```

Expected:

```txt
Every staging/main extension change produces a downloadable artifact.
```

- [ ] **Step 10.3: Configure GitHub environments**

Create GitHub environments:

```txt
staging
production
```

Set environment variables:

```txt
staging:
  WXT_WEB_HTTP_BASE=https://staging.anidachi.app
  WXT_API_HTTP_BASE=https://anidachi-api-staging.<account-subdomain>.workers.dev
  WXT_API_WS_BASE=wss://anidachi-api-staging.<account-subdomain>.workers.dev

production:
  WXT_WEB_HTTP_BASE=https://www.anidachi.app
  WXT_API_HTTP_BASE=https://anidachi-api-production.<account-subdomain>.workers.dev
  WXT_API_WS_BASE=wss://anidachi-api-production.<account-subdomain>.workers.dev
```

Expected:

```txt
Extension builds point to the correct environment.
```

- [x] **Step 10.4: Commit deploy workflows**

Run:

```bash
git add .github/workflows/deploy-api.yml .github/workflows/build-extension.yml
git commit -m "ci: add api and extension deployment workflows"
```

Expected:

```txt
Deployment automation is tracked in git.
```

---

## Task 11: Configure Branch Protection And Team Workflow

**Files:**

- Modify: GitHub repository settings
- Create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/.github/CODEOWNERS`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/README.md`

- [x] **Step 11.1: Add CODEOWNERS**

Create `/Users/vladyslavhulyi/anidachi-LP-monorepo/.github/CODEOWNERS`:

```txt
# Default owners
* @George-Kreatli @vladyslavgul-stack

# Product runtime
/apps/extension/ @vladyslavgul-stack
/apps/api/ @vladyslavgul-stack
/packages/protocol/ @vladyslavgul-stack

# Website/marketing
/apps/web/ @George-Kreatli @vladyslavgul-stack

# Deploy and infrastructure
/.github/ @George-Kreatli @vladyslavgul-stack
/infra/ @vladyslavgul-stack
```

Expected:

```txt
PR review ownership is explicit.
```

- [ ] **Step 11.2: Protect `main`**

GitHub branch protection for `main`:

```txt
Require a pull request before merging: enabled
Required approvals: 1
Dismiss stale approvals: enabled
Require status checks: CI / check-and-test
Require branches to be up to date: enabled
Restrict force pushes: enabled
Restrict deletions: enabled
```

Expected:

```txt
No direct untested production pushes.
```

- [ ] **Step 11.3: Protect `staging`**

GitHub branch protection for `staging`:

```txt
Require a pull request before merging: enabled
Required approvals: 0 or 1
Require status checks: CI / check-and-test
Restrict force pushes: enabled
Restrict deletions: enabled
```

Expected:

```txt
Staging remains stable enough for friend/PC testing.
```

- [x] **Step 11.4: Document team workflow**

Add to `/Users/vladyslavhulyi/anidachi-LP-monorepo/README.md`:

```md
## Development Workflow

- `main` is production.
- `staging` is the shared test environment.
- Create feature branches from `staging`.
- Open PRs into `staging` first.
- After testing staging, open a release PR from `staging` into `main`.
- Do not commit generated extension folders.
- Build extension artifacts through CI or `pnpm build:extension:public`.
```

Expected:

```txt
Both collaborators follow the same branch/deploy model.
```

- [x] **Step 11.5: Commit workflow docs**

Run:

```bash
git add .github/CODEOWNERS README.md
git commit -m "docs: document team development workflow"
```

Expected:

```txt
Repository workflow is documented.
```

---

## Task 12: Create Staging Branch And Deploy Staging

**Files:**

- Modify: remote GitHub branches
- Modify: Vercel project settings
- Modify: Cloudflare Worker deployment
- Build: extension staging artifact

- [x] **Step 12.1: Push migration branch**

Run:

```bash
git push -u origin codex/monorepo-migration
```

Expected:

```txt
Migration branch exists on GitHub.
```

- [x] **Step 12.2: Open PR into `main` as draft**

Expected:

```txt
PR title: chore: migrate Anidachi to monorepo
Base: main
Head: codex/monorepo-migration
Status: draft until CI and local verification pass
```

- [ ] **Step 12.3: Create staging branch after migration PR is reviewed**

Run after migration PR approval or from the migration branch if agreed:

```bash
git switch -c staging
git push -u origin staging
```

Expected:

```txt
staging branch exists and can deploy staging.
```

- [ ] **Step 12.4: Configure Vercel staging domain**

In Vercel:

```txt
Domain: staging.anidachi.app
Branch: staging
Environment variables: staging values
Robots noindex: enabled through env
```

Expected:

```txt
staging.anidachi.app serves the monorepo web app without indexing.
```

- [ ] **Step 12.5: Deploy staging Worker**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api
pnpm exec wrangler deploy --env staging
```

Expected:

```txt
Staging Worker URL responds.
```

- [ ] **Step 12.6: Build staging extension**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo
WXT_WEB_HTTP_BASE=https://staging.anidachi.app \
WXT_API_HTTP_BASE=https://anidachi-api-staging.<account-subdomain>.workers.dev \
WXT_API_WS_BASE=wss://anidachi-api-staging.<account-subdomain>.workers.dev \
pnpm --filter @anidachi/extension build
```

Expected:

```txt
apps/extension/.output/chrome-mv3 contains staging extension build.
```

---

## Task 13: Staging Acceptance Test

**Files:**

- Test only; no source changes unless bugs are found

- [ ] **Step 13.1: Website smoke test**

Manual:

```txt
Open https://staging.anidachi.app.
Confirm homepage loads.
Confirm noindex behavior.
Sign in with Google.
Open /api/me.
Sign out.
Confirm /api/me returns 401.
```

Expected:

```txt
Website auth works on staging.
```

- [ ] **Step 13.2: Room creation smoke test**

Manual:

```txt
Load staging extension unpacked.
Open Crunchyroll or YouTube.
Sign in through extension.
Create room.
Copy invite.
Open invite in second profile/PC.
Join room.
Confirm redirect back to source video with #anidachiRoom.
```

Expected:

```txt
Room is created through website API.
Viewer joins through website invite page.
Extension receives room token and connects to Worker.
```

- [ ] **Step 13.3: P2P media smoke test**

Manual:

```txt
Mac host enables camera.
Windows viewer enables camera.
Both see remote camera.
Both hold V for push-to-talk audio.
Both reload the video page.
Both reconnect to the same room.
```

Expected:

```txt
P2P video/audio works in both directions after reload.
```

- [ ] **Step 13.4: Playback sync smoke test**

Manual:

```txt
Host presses play.
Viewer follows.
Host pauses.
Viewer follows.
Host seeks.
Viewer catches up.
Host switches episode/source if available.
Viewer follows or receives recoverable source status.
```

Expected:

```txt
Realtime room and playback sync still work after monorepo migration.
```

- [ ] **Step 13.5: Debug export check**

Manual:

```txt
Open extension debug area.
Confirm build id/environment is visible.
Confirm API/WEB base URLs point to staging.
Confirm ICE path logs are available after P2P connects.
```

Expected:

```txt
Wrong-environment builds are easy to detect.
```

---

## Task 14: Production Release

**Files:**

- Remote GitHub branch: `main`
- Vercel production project
- Cloudflare production Worker
- Extension production artifact

- [ ] **Step 14.1: Open release PR**

Expected:

```txt
Base: main
Head: staging
Title: release: monorepo migration
Required checks pass.
Review approval is present.
```

- [ ] **Step 14.2: Confirm production env vars**

Before merging:

```txt
Vercel production env is complete.
Cloudflare production Worker secrets are complete.
Google/Discord production redirect URLs are correct.
Stripe webhook still points to production domain.
Supabase project is reachable.
```

Expected:

```txt
Production deploy will not fail due to missing env.
```

- [ ] **Step 14.3: Merge release PR**

Expected:

```txt
main receives the monorepo migration.
Vercel production deployment starts.
GitHub deploy workflow can deploy production Worker.
```

- [ ] **Step 14.4: Deploy production Worker**

Run if not automatic:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api
pnpm exec wrangler deploy --env production
```

Expected:

```txt
Production Worker responds.
```

- [ ] **Step 14.5: Build production extension**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi-LP-monorepo
WXT_WEB_HTTP_BASE=https://www.anidachi.app \
WXT_API_HTTP_BASE=https://anidachi-api-production.<account-subdomain>.workers.dev \
WXT_API_WS_BASE=wss://anidachi-api-production.<account-subdomain>.workers.dev \
pnpm --filter @anidachi/extension build
```

Expected:

```txt
Production extension artifact is built from main.
```

- [ ] **Step 14.6: Production smoke test**

Manual:

```txt
Open https://www.anidachi.app.
Sign in.
Load production extension build.
Create room.
Join from second profile/PC.
Verify room, P2P video/audio, reactions, chat, and sync.
```

Expected:

```txt
Production product works after migration.
```

- [ ] **Step 14.7: Tag production release**

Run:

```bash
git tag monorepo-migration-2026-06-03
git push origin monorepo-migration-2026-06-03
```

Expected:

```txt
Production migration release has a restore/reference tag.
```

---

## Task 15: Post-Migration Cleanup

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/docs/architecture.md`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/docs/site-extension-integration-notes.md`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/web/README.md`
- Optional archive: old `/Users/vladyslavhulyi/anidachi`

- [ ] **Step 15.1: Mark old local repo as legacy**

Rule:

```txt
After production migration, do not continue product development in /Users/vladyslavhulyi/anidachi.
```

Expected:

```txt
All new branches start from George-Kreatli/anidachi-LP.
```

- [ ] **Step 15.2: Update docs to point at new source of truth**

Update docs with:

```txt
Primary repo: George-Kreatli/anidachi-LP
Website app: apps/web
Extension app: apps/extension
Worker app: apps/api
Protocol package: packages/protocol
```

Expected:

```txt
New contributors do not accidentally use the old repo.
```

- [ ] **Step 15.3: Fix `apps/web/README.md` commands**

Replace npm commands with:

```bash
pnpm install
pnpm --filter @anidachi/web dev
pnpm --filter @anidachi/web build
```

Expected:

```txt
Website README matches monorepo reality.
```

- [ ] **Step 15.4: Create first normal feature branch from staging**

Run:

```bash
git switch staging
git pull --ff-only
git switch -c codex/room-lifecycle
```

Expected:

```txt
Future work starts from the new workflow.
```

---

## Known Migration Risks And Mitigations

- [ ] **Risk: Website build fails because Stripe is instantiated at import time.**
  - Mitigation: move Stripe client creation inside the route handler before Vercel migration.

- [ ] **Risk: `@/*` alias breaks after moving website into `apps/web`.**
  - Mitigation: keep `apps/web/tsconfig.json` alias pointing to `./*` and run `pnpm --filter @anidachi/web check`.

- [ ] **Risk: Vercel cannot access shared `packages/*` from `apps/web`.**
  - Mitigation: enable "Include source files outside of the Root Directory" or avoid web imports from packages until Vercel is configured.

- [ ] **Risk: OAuth works in production but fails in staging.**
  - Mitigation: add staging redirect URLs before staging tests.

- [ ] **Risk: Website room token is rejected by Worker.**
  - Mitigation: ensure `ANIDACHI_JWT_SECRET` matches between Vercel and Cloudflare for the same environment.

- [ ] **Risk: Generated extension output gets committed.**
  - Mitigation: root `.gitignore` excludes generated extension folders and artifacts.

- [ ] **Risk: Old repo keeps receiving changes.**
  - Mitigation: mark `/Users/vladyslavhulyi/anidachi` as legacy after migration and move all active work to `George-Kreatli/anidachi-LP`.

- [ ] **Risk: Internal CRM/social tools pollute Anidachi product scope.**
  - Mitigation: keep them inside `apps/web` for migration safety first; decide later whether to remove or isolate them in a separate app/package.

## Definition Of Done

- [ ] `George-Kreatli/anidachi-LP` contains `apps/web`, `apps/extension`, `apps/api`, `apps/demo`, and `packages/protocol`.
- [ ] Repo uses `pnpm@11.2.2` and Turborepo.
- [ ] `npm/package-lock.json` is removed from root.
- [ ] Website builds from `apps/web`.
- [ ] Vercel production deploys from `main`.
- [ ] Vercel staging deploys from `staging`.
- [ ] Cloudflare Worker deploys to `staging` and `production` environments.
- [ ] Supabase variables work in both staging and production.
- [ ] Google/Discord auth works in both staging and production.
- [ ] Extension staging build points at staging web/API.
- [ ] Extension production build points at production web/API.
- [ ] CI runs on PRs to `staging` and `main`.
- [ ] `main` is protected from direct unreviewed pushes.
- [ ] Staging acceptance test passes on two devices.
- [ ] Production smoke test passes after merge.
- [ ] Old local repo is no longer used for active product development.

## Execution Order

1. Task 0: prepare safe migration workspace.
2. Task 1: move website into `apps/web`.
3. Task 2: convert to pnpm/Turborepo.
4. Task 3: import extension/API/demo/protocol.
5. Task 4: import shared docs/infra/scripts.
6. Task 5: normalize `.gitignore`.
7. Task 6: configure Vercel monorepo website deploys.
8. Task 7: configure Cloudflare Worker environments.
9. Task 8: configure Supabase/OAuth staging and production.
10. Task 9: add GitHub Actions CI.
11. Task 10: add deployment workflows.
12. Task 11: configure branch protection and team workflow.
13. Task 12: create staging branch and deploy staging.
14. Task 13: run staging acceptance test.
15. Task 14: release production.
16. Task 15: post-migration cleanup.

## Commit Strategy

Use small commits:

```txt
chore: move website into apps/web
chore: convert repo to pnpm monorepo
chore: import extension api demo and protocol
docs: add product architecture and migration plans
chore: ignore generated extension and local debug outputs
ci: add monorepo check and test workflow
ci: add api and extension deployment workflows
docs: document team development workflow
```

Rule:

```txt
Do not include room lifecycle, P2P bug fixes, watch progress, or UI changes in the monorepo migration commits.
```
