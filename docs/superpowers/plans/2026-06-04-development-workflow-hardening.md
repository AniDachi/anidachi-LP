# Development Workflow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Anidachi development predictable: feature work starts safely, staging is private and canonical, extension artifacts cannot be misbuilt, and production only receives code that passed staging.

**Architecture:** Keep the existing `feature branch -> staging -> main` model, but harden the weak boundaries around staging URL ownership, Vercel/GitHub envs, Chrome extension artifacts, and release gates. Add automated validation where current process depends on manual inspection. Keep staging private/noindex while still usable by the Chrome extension auth flow.

**Tech Stack:** GitHub branch protection/actions/environments, Vercel Preview branch domains and env vars, Next.js 15 App Router metadata/middleware, WXT MV3 extension builds, Chrome Web Store tester listings, Cloudflare Workers/Wrangler, pnpm/Turborepo.

---

## Evidence Snapshot

Current branch during planning: `staging`.

Current observed state:

- `https://staging.anidachi.app` is live and currently aliases the Ready Vercel preview deployment.
- Staging password gate works and returns `X-Robots-Tag: noindex, nofollow` on gate responses.
- `robots.txt` returns `Disallow: /`, and `sitemap.xml` is empty on staging.
- Extension auth flow works after the staging password: `/extension/connect -> /login`.
- GitHub environment variable `WXT_WEB_HTTP_BASE` for `staging` still points to the old Vercel preview host.
- `scripts/build-extension-staging.sh` still defaults to the old Vercel preview host and broad host permissions.
- `apps/web/app/layout.tsx` still hard-codes `robots: { index: true, follow: true }`.
- `apps/web/lib/staging-access.ts` lets any `Authorization: Bearer ...` bypass the staging gate on any path.
- Branch protection only requires `check-and-test`; extension artifact validation and staging smoke checks are not required.

Official references checked:

- Vercel branch domains: https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch
- Vercel env vars and branch-scoped Preview vars: https://vercel.com/docs/environment-variables
- Vercel Git deployments/staging branch domains: https://vercel.com/docs/deployments/git
- Vercel automation bypass for protected deployments: https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- GitHub protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- GitHub CODEOWNERS: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- Chrome extension permissions: https://developer.chrome.com/docs/extensions/mv3/declare_permissions
- Chrome match patterns: https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
- Chrome Identity API: https://developer.chrome.com/docs/extensions/reference/api/identity
- Chrome Web Store policies: https://developer.chrome.com/docs/webstore/program-policies/policies
- Chrome trusted tester distribution: https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- Next.js robots metadata route: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
- Next.js metadata/generateMetadata: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- WXT manifest config: https://wxt.dev/guide/essentials/config/manifest
- WXT env vars in manifest config: https://wxt.dev/guide/essentials/config/environment-variables.html

## Target Operating Model

Use one canonical staging origin:

```txt
https://staging.anidachi.app
```

Use three extension modes:

```txt
local       = broad permissions, local web/API, unpacked developer build
staging     = narrow permissions, staging web/API, private Chrome Web Store tester item
production  = narrow permissions, production web/API, public Chrome Web Store item
```

Use one Git flow:

```txt
codex/task-name -> PR -> staging -> staging web/API/extension verification -> PR -> main -> production build/upload
```

Never rely on generated folders or old Vercel preview aliases as source of truth.

## File Map

Core files to modify:

- `scripts/build-extension-staging.sh` - staging extension defaults.
- `scripts/build-extension-public.sh` - production artifact consistency.
- `scripts/validate-extension-artifact.mjs` - new artifact validator.
- `scripts/smoke-staging-web.mjs` - new staging auth/gate smoke test.
- `apps/extension/wxt.config.ts` - channel host permissions and manifest generation.
- `apps/extension/entrypoints/content.tsx` - content script match policy.
- `apps/extension/src/constants.ts` - runtime base validation/fallback behavior.
- `apps/web/app/layout.tsx` - staging noindex metadata.
- `apps/web/middleware.ts` - noindex headers on pass-through staging responses.
- `apps/web/lib/staging-access.ts` - narrow Bearer bypass policy.
- `apps/web/lib/staging-access.test.ts` - bypass/noindex helper tests.
- `.github/workflows/ci.yml` - baseline CI gate.
- `.github/workflows/build-extension.yml` - artifact build and validation.
- `.github/workflows/deploy-api.yml` - workflow dispatch safety and Wrangler dry-run.
- `.github/workflows/staging-smoke.yml` - new staging smoke workflow.
- `README.md` - short workflow entrypoint.
- `docs/current-development-state.md` - operational source of truth.
- `docs/project-operating-manual.md` - development and release process.
- `docs/extension-release-channels.md` - extension channel source of truth.
- `docs/architecture.md` - high-level endpoint references.
- `apps/web/docs/chrome-web-store-listing.md` - public listing/privacy alignment.

External settings to modify:

- Vercel project domain: assign `staging.anidachi.app` to Git branch `staging`.
- Vercel Preview branch env for `staging`.
- GitHub environment variables for `staging` and `production`.
- Google OAuth authorized redirect URIs.
- Discord OAuth redirect URIs.
- Chrome Web Store staging tester item instructions.
- GitHub branch protection required checks.

## Task 0: Prepare A Safe Implementation Branch

**Files:**

- No source files.

- [x] **Step 1: Confirm dirty working tree before implementation**

Run:

```bash
git status --short --branch
```

Expected: identify unrelated user/doc changes before touching files.

- [x] **Step 2: Create implementation branch from latest staging**

Run:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
git switch -c codex/development-workflow-hardening
```

Expected: branch `codex/development-workflow-hardening` exists and starts from `origin/staging`.

- [x] **Step 3: Do not stage unrelated existing dirty files**

Run:

```bash
git diff --name-only
git status --short
```

Expected: every file later staged belongs to this plan.

## Task 1: Make `staging.anidachi.app` The Only Staging Web Base

**Files:**

- Modify: `scripts/build-extension-staging.sh`
- Modify: `docs/current-development-state.md`
- Modify: `docs/project-operating-manual.md`
- Modify: `docs/extension-release-channels.md`
- Modify: `docs/architecture.md`
- Modify: `README.md` if endpoint notes need a short pointer
- External: Vercel Preview branch env
- External: GitHub `staging` environment vars
- External: Google/Discord OAuth dashboards

- [x] **Step 1: Set Vercel branch-scoped staging env**

Run:

```bash
vercel env add NEXT_PUBLIC_SITE_URL preview staging --value "https://staging.anidachi.app" --force --yes
vercel env add NEXT_PUBLIC_ROBOTS_NOINDEX preview staging --value "true" --force --yes
```

Expected: `vercel env ls preview staging` shows `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_ROBOTS_NOINDEX` under `Preview (staging)`.

- [x] **Step 2: Set GitHub extension build vars**

Run:

```bash
gh variable set WXT_WEB_HTTP_BASE --env staging --body "https://staging.anidachi.app"
gh variable set WXT_API_HTTP_BASE --env staging --body "https://anidachi-api-staging.vladislav-gul7.workers.dev"
gh variable set WXT_API_WS_BASE --env staging --body "wss://anidachi-api-staging.vladislav-gul7.workers.dev"
```

Expected:

```bash
gh variable list --env staging
```

prints the staging web/API/WS bases above.

- [x] **Step 3: Update staging build default**

Change `scripts/build-extension-staging.sh` default:

```bash
: "${WXT_WEB_HTTP_BASE:=https://staging.anidachi.app}"
```

Expected: no current release script defaults to `v0-anime-app-landing-page-git-3b9ab6`.

- [x] **Step 4: Update current docs**

Replace current staging web endpoint references in active docs:

```txt
https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app
```

with:

```txt
https://staging.anidachi.app
```

Expected active docs agree:

```bash
rg -n "git-3b9ab6|v0-anime-app-landing-page-git" README.md docs scripts apps
```

Only historical plan files may still mention old URLs, and those mentions must be clearly marked historical.

- [x] **Step 5: Confirm OAuth redirect URIs**

In Google Cloud OAuth client and Discord Developer Portal, ensure these exact callback URLs exist:

```txt
https://staging.anidachi.app/api/auth/callback/google
https://staging.anidachi.app/api/auth/callback/discord
https://www.anidachi.app/api/auth/callback/google
https://www.anidachi.app/api/auth/callback/discord
```

Expected: provider redirects from staging use the staging callback host.

Progress note: the staged app now emits provider redirects with `redirect_uri=https://staging.anidachi.app/api/auth/callback/...`; Google/Discord dashboard allowlists are external and should remain part of manual release checklist verification.

- [x] **Step 6: Redeploy staging after env change**

Use PR merge to `staging` as the normal path. If only env changed and code did not, rebuild the current staging deployment:

```bash
CURRENT_STAGING_DEPLOYMENT_URL="$(vercel alias ls 2>/dev/null | awk '/staging.anidachi.app/ { print $1; exit }')"
vercel redeploy "$CURRENT_STAGING_DEPLOYMENT_URL" --target preview
```

Expected: `https://staging.anidachi.app` points to the redeployed Ready deployment.

- [x] **Step 7: Verify staging origin**

Run:

```bash
curl -sS -I https://staging.anidachi.app/ | sed -n '1,30p'
curl -sS -I https://staging.anidachi.app/robots.txt | sed -n '1,30p'
curl -sS https://staging.anidachi.app/robots.txt
curl -sS https://staging.anidachi.app/sitemap.xml
```

Expected:

- `/` returns staging gate or gated response with `X-Robots-Tag: noindex, nofollow`.
- `robots.txt` contains `Disallow: /`.
- sitemap is empty.

## Task 2: Make Staging Noindex Enforced After Password Too

**Files:**

- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/middleware.ts`
- Modify: `apps/web/lib/site-url.ts` if helper naming needs to be clearer
- Test: `apps/web/lib/staging-access.test.ts`

- [x] **Step 1: Make root metadata robots conditional**

Change `apps/web/app/layout.tsx` so root metadata uses `isRobotsIndexingDisabled()`.

Implementation shape:

```ts
import {
  getResolvedSiteOrigin,
  isRobotsIndexingDisabled,
} from "@/lib/site-url";

const shouldNoindex = isRobotsIndexingDisabled();

export const metadata: Metadata = {
  // existing title/description/openGraph/twitter
  metadataBase: new URL(getResolvedSiteOrigin()),
  alternates: { canonical: "/" },
  robots: {
    index: !shouldNoindex,
    follow: !shouldNoindex,
  },
};
```

Expected on staging after rebuild: authenticated pages do not emit `index, follow`.

- [x] **Step 2: Add a middleware helper for noindex pass-through responses**

Add to `apps/web/middleware.ts`:

```ts
function withStagingNoindexHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
```

Use it for pass-through responses while the staging gate is enabled:

```ts
if (canBypassStagingGate(...)) {
  return withStagingNoindexHeaders(NextResponse.next());
}

if (await isValidStagingAccessCookie(cookieValue, config)) {
  return withStagingNoindexHeaders(NextResponse.next());
}
```

Expected: valid staging-cookie responses still carry `X-Robots-Tag: noindex, nofollow`.

- [x] **Step 3: Run web checks**

Run:

```bash
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
```

Expected: both pass.

Progress note: local `pnpm --filter @anidachi/web check` and `pnpm --filter @anidachi/web test` passed after the code change.

- [ ] **Step 4: Verify deployed staging**

After merge/deploy, use a valid staging cookie and fetch `/`.

Expected:

```txt
X-Robots-Tag: noindex, nofollow
<meta name="robots" content="noindex,nofollow">
```

## Task 3: Narrow The Staging Gate Bearer Bypass

**Files:**

- Modify: `apps/web/lib/staging-access.ts`
- Test: `apps/web/lib/staging-access.test.ts`

- [x] **Step 1: Add explicit Bearer bypass allowlist**

Replace the generic Bearer bypass with a helper:

```ts
function canBearerBypassStagingGate(pathname: string, method: string): boolean {
  if (pathname === "/api/me" && method === "GET") return true;
  if (pathname === "/api/rooms" && method === "POST") return true;
  if (/^\/api\/rooms\/[^/]+$/.test(pathname) && method === "GET") return true;
  if (/^\/api\/rooms\/[^/]+\/connect$/.test(pathname) && method === "POST") {
    return true;
  }
  return false;
}
```

Then change `canBypassStagingGate`:

```ts
if (params.pathname.startsWith("/api/extension/auth/")) return true;
return (
  params.authorization?.startsWith("Bearer ") === true &&
  canBearerBypassStagingGate(params.pathname, params.method)
);
```

Expected: extension-needed bearer routes still work; unrelated API routes stay behind staging access.

- [x] **Step 2: Add tests**

Add or update tests in `apps/web/lib/staging-access.test.ts`:

```ts
assert.equal(
  canBypassStagingGate({
    pathname: "/api/me",
    method: "GET",
    authorization: "Bearer token",
  }),
  true,
);

assert.equal(
  canBypassStagingGate({
    pathname: "/api/openclaw/health",
    method: "GET",
    authorization: "Bearer token",
  }),
  false,
);

assert.equal(
  canBypassStagingGate({
    pathname: "/api/rooms/room_123/connect",
    method: "POST",
    authorization: "Bearer token",
  }),
  true,
);
```

Expected: tests prove the staging boundary is not bypassed by arbitrary bearer headers.

- [x] **Step 3: Run web tests**

Run:

```bash
pnpm --filter @anidachi/web test
```

Expected: all web tests pass.

Progress note: local `pnpm --filter @anidachi/web test` and `pnpm --filter @anidachi/web check` passed after narrowing the bearer bypass.

## Task 4: Split Local Broad Builds From Store-Safe Staging Builds

**Files:**

- Modify: `package.json`
- Modify: `scripts/build-extension-staging.sh`
- Create: `scripts/build-extension-staging-broad.sh` or add a root script that sets the env explicitly
- Modify: `apps/extension/wxt.config.ts`
- Modify: `apps/extension/entrypoints/content.tsx` only if match naming needs to be clearer
- Test: extension build output `manifest.json`

- [x] **Step 1: Make store-safe staging the default**

Change `scripts/build-extension-staging.sh`:

```bash
: "${WXT_BROAD_HOST_PERMISSIONS:=false}"
```

Expected: `pnpm build:extension:staging` is safe for Chrome Web Store tester upload by default.

- [x] **Step 2: Keep broad staging available only as an explicit developer command**

Add root script in `package.json`:

```json
"build:extension:staging:broad": "WXT_BROAD_HOST_PERMISSIONS=true bash scripts/build-extension-staging.sh"
```

Expected: broad permissions require an explicit command whose name says what it does.

- [x] **Step 3: Remove production web host from staging permissions**

Change `apps/extension/wxt.config.ts` so `https://www.anidachi.app/*` is only included for production.

Implementation shape:

```ts
const channelWebHostPermissions =
  extensionChannel === "production"
    ? ["https://www.anidachi.app/*", webHostPermission]
    : [webHostPermission];

const hostPermissions =
  useBroadHostPermissions
    ? LOCAL_HOST_PERMISSIONS
    : unique([
        ...STORE_VIDEO_HOST_PERMISSIONS,
        ...channelWebHostPermissions,
        apiHttpHostPermission,
        apiWsHostPermission,
      ]);
```

Expected:

- staging manifest includes `https://staging.anidachi.app/*`;
- production manifest includes `https://www.anidachi.app/*`;
- staging manifest does not include the production web host unless deliberately needed and documented.

- [x] **Step 4: Build and inspect staging manifest**

Run:

```bash
pnpm build:extension:staging
node -e 'const m=require("./anidachi-extension-staging/manifest.json"); console.log(m.name, m.host_permissions, m.content_scripts?.[0]?.matches)'
```

Expected:

- `name` is `Anidachi Staging`;
- no `http://*/*`;
- no `https://*/*`;
- no `file:///*`;
- includes `https://staging.anidachi.app/*`;
- content scripts are limited to supported video surfaces.

Progress note: local `pnpm build:extension:staging` passed. The generated staging manifest contains `https://staging.anidachi.app/*`, omits `https://www.anidachi.app/*`, and contains no broad host/content patterns.

## Task 5: Add Automated Extension Artifact Validation

**Files:**

- Create: `scripts/validate-extension-artifact.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/build-extension.yml`
- Optional Test: `scripts/validate-extension-artifact.test.mjs` if script grows complex

- [x] **Step 1: Add validator script**

Create `scripts/validate-extension-artifact.mjs` with this behavior:

```js
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const channel = args.get("--channel");
const dir = args.get("--dir") ?? "apps/extension/.output/chrome-mv3";
if (!["staging", "production"].includes(channel)) {
  throw new Error("Usage: node scripts/validate-extension-artifact.mjs --channel staging|production --dir <manifest-dir>");
}

const manifestPath = path.join(dir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const hostPermissions = manifest.host_permissions ?? [];
const contentMatches = (manifest.content_scripts ?? []).flatMap((script) => script.matches ?? []);

const broadPatterns = new Set(["http://*/*", "https://*/*", "file:///*", "<all_urls>"]);
for (const value of [...hostPermissions, ...contentMatches]) {
  if (broadPatterns.has(value)) {
    throw new Error(`${channel} artifact contains broad permission/match pattern: ${value}`);
  }
}

const expected = {
  staging: {
    name: "Anidachi Staging",
    web: "https://staging.anidachi.app/*",
    api: "https://anidachi-api-staging.vladislav-gul7.workers.dev/*",
    buildIdPart: "-staging-",
  },
  production: {
    name: "Anidachi",
    web: "https://www.anidachi.app/*",
    api: "https://anidachi-api-production.vladislav-gul7.workers.dev/*",
    buildIdPart: "-production-",
  },
}[channel];

if (manifest.name !== expected.name) {
  throw new Error(`Expected manifest.name ${expected.name}, got ${manifest.name}`);
}

if (!manifest.version_name?.includes(expected.buildIdPart)) {
  throw new Error(`Expected version_name to include ${expected.buildIdPart}, got ${manifest.version_name}`);
}

for (const required of [expected.web, expected.api]) {
  if (!hostPermissions.includes(required)) {
    throw new Error(`Missing host permission: ${required}`);
  }
}

for (const size of ["16", "32", "48", "128"]) {
  if (!manifest.icons?.[size]) {
    throw new Error(`Missing icon size ${size}`);
  }
}

console.log(`Validated ${channel} extension artifact at ${manifestPath}`);
```

Expected: script fails loudly for broad store permissions, wrong channel names, missing hosts, missing icons, or missing build id.

- [x] **Step 2: Add package scripts**

Add root scripts:

```json
"validate:extension:staging": "node scripts/validate-extension-artifact.mjs --channel staging --dir anidachi-extension-staging",
"validate:extension:production": "node scripts/validate-extension-artifact.mjs --channel production --dir anidachi-extension-public"
```

Expected: validators can run locally after build scripts.

- [x] **Step 3: Add validator to CI artifact build**

In `.github/workflows/build-extension.yml`, after build and before upload:

```yaml
- name: Validate extension artifact
  run: node scripts/validate-extension-artifact.mjs --channel "${GITHUB_REF_NAME}" --dir apps/extension/.output/chrome-mv3
```

Expected: CI refuses a bad staging/production zip before uploading it.

- [x] **Step 4: Validate locally**

Run:

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
```

Expected: staging artifact validates with narrow permissions.

Progress note: local `pnpm validate:extension:staging` passed against the generated staging artifact.

## Task 6: Align CI, Manual Dispatch, And Branch Protection

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/build-extension.yml`
- Modify: `.github/workflows/deploy-api.yml`
- External: GitHub branch protection

- [x] **Step 1: Add explicit workflow permissions and concurrency**

Add to each workflow:

```yaml
permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Expected: workflow permissions are least-privilege and repeated pushes do not waste CI time.

- [x] **Step 2: Guard manual dispatch refs**

Add a first job step to `build-extension.yml` and `deploy-api.yml`:

```yaml
- name: Validate release ref
  run: |
    if [[ "$GITHUB_REF_NAME" != "staging" && "$GITHUB_REF_NAME" != "main" ]]; then
      echo "This workflow may only run from staging or main. Current ref: $GITHUB_REF_NAME"
      exit 1
    fi
```

Expected: manual release workflows cannot accidentally build/deploy from arbitrary feature branches.

- [x] **Step 3: Fail fast when extension env vars are empty**

Add before extension build:

```yaml
- name: Validate extension env
  run: |
    test -n "${WXT_WEB_HTTP_BASE}"
    test -n "${WXT_API_HTTP_BASE}"
    test -n "${WXT_API_WS_BASE}"
  env:
    WXT_WEB_HTTP_BASE: ${{ vars.WXT_WEB_HTTP_BASE }}
    WXT_API_HTTP_BASE: ${{ vars.WXT_API_HTTP_BASE }}
    WXT_API_WS_BASE: ${{ vars.WXT_API_WS_BASE }}
```

Expected: missing GitHub environment vars fail the workflow before producing a zip.

- [x] **Step 4: Add Wrangler dry-run to PR CI**

Add to CI or API workflow:

```yaml
- name: Check Worker bundle
  working-directory: apps/api
  run: pnpm exec wrangler deploy --env staging --dry-run --outdir /tmp/anidachi-worker-dry-run
```

Expected: Worker deploy config is checked before merge without uploading.

Progress note: local `pnpm --filter @anidachi/api exec wrangler deploy --env staging --dry-run --outdir /tmp/anidachi-worker-dry-run` passed.

- [x] **Step 5: Decide required checks**

Recommended protected branch required checks:

```txt
staging:
- check-and-test
- build-extension
- deploy-api, only if API changed or keep as non-required but visible
- staging-smoke, after deployment

main:
- check-and-test
- build-extension
- deploy-api, only if API changed or keep as non-required but visible
- one approval
- conversation resolution
- up-to-date branch
```

Expected: branch protection matches actual release risk.

Progress note: current branch protection keeps only the always-running `check-and-test` as required on `staging` and `main`. `build-extension` and `deploy-api` stay visible but non-required because they are path-triggered/manual release workflows and should not block unrelated PRs when they do not run.

- [x] **Step 6: Decide CODEOWNERS enforcement**

If owner review should be real on `main`, enable "Require review from Code Owners" for `main`.

Expected:

```bash
gh api repos/AniDachi/anidachi-LP/branches/main/protection --jq '.required_pull_request_reviews.require_code_owner_reviews'
```

prints `true`, or docs explicitly say CODEOWNERS is advisory only.

Progress note: `docs/current-development-state.md` now states that CODEOWNERS is advisory; branch protection still does not require Code Owner review.

## Task 7: Add Staging Smoke Tests

**Files:**

- Create: `scripts/smoke-staging-web.mjs`
- Create: `.github/workflows/staging-smoke.yml`
- External: GitHub `staging` environment secret for staging access code

- [x] **Step 1: Add smoke script**

Create `scripts/smoke-staging-web.mjs` that checks:

```txt
GET / shows password gate without cookie
POST /__anidachi/staging-access rejects wrong password
POST /__anidachi/staging-access accepts correct password
GET /extension/connect with cookie redirects to /login?next=...
GET /login with cookie contains Google and Discord links preserving /extension/connect
POST /api/rooms without access returns JSON 401
GET /robots.txt contains Disallow: /
GET /sitemap.xml is empty
```

Required environment:

```txt
STAGING_WEB_HTTP_BASE=https://staging.anidachi.app
STAGING_ACCESS_CODE must be provided from the GitHub `staging` environment secret or a local shell export.
```

Expected: script exits non-zero on the exact failure class that previously broke extension auth.

- [x] **Step 2: Add GitHub environment secret**

Run:

```bash
gh secret set STAGING_ACCESS_CODE --env staging
```

Expected: secret exists only in GitHub `staging` environment.

- [x] **Step 3: Add smoke workflow**

Create `.github/workflows/staging-smoke.yml`:

```yaml
name: Staging Smoke

on:
  workflow_dispatch:
  deployment_status:

permissions:
  contents: read
  deployments: read

jobs:
  smoke:
    if: github.event_name == 'workflow_dispatch' || github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Run staging smoke
        env:
          STAGING_WEB_HTTP_BASE: https://staging.anidachi.app
          STAGING_ACCESS_CODE: ${{ secrets.STAGING_ACCESS_CODE }}
        run: node scripts/smoke-staging-web.mjs
```

Expected: smoke can run manually and automatically after successful deployment status.

- [x] **Step 4: Run smoke manually**

Run:

```bash
export STAGING_ACCESS_CODE
STAGING_WEB_HTTP_BASE=https://staging.anidachi.app node scripts/smoke-staging-web.mjs
```

Expected: all checks pass.

Progress note: GitHub `staging` environment now has `STAGING_ACCESS_CODE`; local live smoke passed against `https://staging.anidachi.app`.

## Task 8: Make Chrome Web Store Release Repeatable

**Files:**

- Modify: `docs/extension-release-channels.md`
- Modify: `docs/project-operating-manual.md`
- Modify: `apps/web/docs/chrome-web-store-listing.md`
- Optional Create: `docs/chrome-web-store-release-checklist.md`

- [x] **Step 1: Document exact extension channels**

Document:

```txt
local:
  source: WXT dev / unpacked build
  permissions: broad allowed
  web: localhost

staging:
  source: staging branch artifact
  permissions: narrow only
  web: https://staging.anidachi.app
  listing: private/trusted testers

production:
  source: main branch artifact
  permissions: narrow only
  web: https://www.anidachi.app
  listing: public
```

Expected: no current doc says staging store artifacts can be broad by default.

- [x] **Step 2: Add pre-upload manifest checklist**

Checklist:

```txt
manifest.name matches channel
manifest.version increased from previous CWS upload
manifest.version_name contains the current git SHA, channel name, and CI run number/build timestamp
host_permissions do not contain broad patterns
content_scripts.matches do not contain broad patterns
web/API/WS hosts match channel
icons exist at 16/32/48/128
zip root contains manifest.json at top level
```

Expected: reviewer can validate a zip before upload without reading code.

- [x] **Step 3: Align privacy/listing disclosures**

Update Chrome Web Store listing notes with actual data usage:

```txt
Extension stores extension-scoped auth tokens in chrome.storage.local.
Extension sends source URL/video metadata to create rooms.
Extension sends chat/reactions/playback sync events through Anidachi room server.
Ghost Cam/mic/camera use WebRTC between room participants when user enables it.
Clipboard permission is used to copy invite links.
No service-role keys, OAuth secrets, JWT secrets, Stripe secrets, or TURN secrets are shipped in the extension.
```

Expected: CWS listing, privacy policy, and actual extension behavior do not contradict each other.

Progress note: `docs/extension-release-channels.md`, `docs/project-operating-manual.md`, and `apps/web/docs/chrome-web-store-listing.md` now document narrow store builds, explicit local-only broad staging, pre-upload validation, and extension data/permission usage.

## Task 9: Harden API/Worker Release Boundary

**Files:**

- Modify: `.github/workflows/deploy-api.yml`
- Modify: `docs/current-development-state.md`
- Optional Create: `scripts/smoke-worker.mjs`

- [x] **Step 1: Add dry-run before deploy**

In `deploy-api.yml`, before deploy:

```yaml
- name: Dry-run Worker deploy
  working-directory: apps/api
  run: pnpm exec wrangler deploy --env ${{ github.ref_name == 'main' && 'production' || 'staging' }} --dry-run --outdir /tmp/anidachi-worker-dry-run
```

Expected: bad Wrangler config fails before deploy.

- [x] **Step 2: Keep deploy environment tied only to `staging` and `main`**

Use the same release-ref guard from Task 6.

Expected: manual dispatch from a feature branch cannot deploy the Worker to staging by accident.

- [x] **Step 3: Add Worker smoke checks**

Minimum smoke:

```bash
curl -sS -i https://anidachi-api-staging.vladislav-gul7.workers.dev/
curl -sS -i https://anidachi-api-staging.vladislav-gul7.workers.dev/ice-servers
```

Expected:

- root health responds with expected status/body;
- `/ice-servers` does not expose long-lived TURN secrets;
- production and staging Worker names remain distinct.

Progress note: `deploy-api.yml` now dry-runs before deploy, `scripts/smoke-worker.mjs` exists, and local `pnpm smoke:worker:staging` passed.

## Task 10: Update Active Documentation As Source Of Truth

**Files:**

- Modify: `README.md`
- Modify: `docs/current-development-state.md`
- Modify: `docs/project-operating-manual.md`
- Modify: `docs/extension-release-channels.md`
- Modify: `docs/architecture.md`
- Modify: `docs/project-architecture-and-development.md`

- [x] **Step 1: Update runtime endpoint tables**

Use:

```txt
Staging Web: https://staging.anidachi.app
Staging API: https://anidachi-api-staging.vladislav-gul7.workers.dev
Staging WS:  wss://anidachi-api-staging.vladislav-gul7.workers.dev
```

Expected: active docs do not point developers to the old Vercel preview host.

- [x] **Step 2: Add "staging is private" invariant**

Document:

```txt
staging.anidachi.app is an internal tester surface.
It must be password-gated, noindex, excluded from sitemap, and never used in production SEO/marketing pages.
It may appear in internal env vars, OAuth callback allowlists, staging extension builds, and internal docs.
```

Expected: developers understand that using staging in config is correct, but exposing it publicly is not.

- [x] **Step 3: Document manual deploy exception policy**

Document:

```txt
Normal deploy path is PR merge.
Manual workflow dispatch is for retries/emergencies only.
Manual release workflows must run from staging or main, never a feature branch.
```

Expected: manual workflows do not become an alternate release process.

- [x] **Step 4: Mark historical plans as historical**

Do not rewrite old plans extensively. Add a short note in current docs:

```txt
Historical plans under docs/superpowers/plans may contain old URLs and decisions. Use docs/current-development-state.md for active endpoints.
```

Expected: old migration notes do not override current state.

Progress note: active docs now point to `https://staging.anidachi.app`, document staging as private/noindex/internal, restrict manual release dispatch to retries/emergencies from `staging` or `main`, and point readers to `docs/current-development-state.md` over historical plans.

## Task 11: Define The Everyday Development Loop

**Files:**

- Modify: `docs/project-operating-manual.md`
- Modify: `README.md`

- [x] **Step 1: Document feature startup**

Use:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
git switch -c codex/task-name
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

Expected: every feature starts from current staging and has a baseline.

- [x] **Step 2: Document per-surface checks**

Use:

```txt
web/auth/SEO change:
  pnpm --filter @anidachi/web check
  pnpm --filter @anidachi/web test
  pnpm --filter @anidachi/web build

extension change:
  pnpm --filter @anidachi/extension check
  pnpm --filter @anidachi/extension test
  pnpm build:extension:staging
  pnpm validate:extension:staging

protocol/API change:
  pnpm --filter @anidachi/protocol test
  pnpm --filter @anidachi/api check
  pnpm --filter @anidachi/api test
  cd apps/api && pnpm exec wrangler deploy --env staging --dry-run
```

Expected: developers run the right checks for the files they touched.

- [x] **Step 3: Document promotion**

Use:

```txt
1. Merge feature PR into staging.
2. Confirm Vercel staging Ready.
3. Run staging smoke.
4. Build/upload Anidachi Staging if testers need extension changes.
5. Test on at least one clean browser profile/new PC when auth changes.
6. Open PR staging -> main.
7. Merge only after checks/review.
8. Build/upload production extension only from main.
```

Expected: production never receives a change that skipped staging.

Progress note: `README.md` now has the short daily flow; `docs/project-operating-manual.md` has feature startup, per-surface checks, and staging-to-production promotion steps.

## Task 12: Final Verification Matrix

**Files:**

- No new source files unless earlier tasks created validators/smokes.

- [x] **Step 1: Local full checks**

Run:

```bash
pnpm check
pnpm test
pnpm lint
pnpm build:extension:staging
pnpm validate:extension:staging
pnpm build:extension:public
pnpm validate:extension:production
```

Expected: all pass.

Progress note: `pnpm check`, `pnpm test`, `pnpm lint`, `pnpm build:extension:staging`, `pnpm validate:extension:staging`, `pnpm build:extension:public`, and `pnpm validate:extension:production` passed. `pnpm lint` still reports existing warning-level style backlog, but exits successfully.

- [x] **Step 2: Vercel staging checks**

Run:

```bash
curl -sS -i https://staging.anidachi.app/ | sed -n '1,40p'
curl -sS https://staging.anidachi.app/robots.txt
curl -sS https://staging.anidachi.app/sitemap.xml
export STAGING_ACCESS_CODE
STAGING_WEB_HTTP_BASE=https://staging.anidachi.app node scripts/smoke-staging-web.mjs
```

Expected:

- staging gate present;
- noindex headers present;
- sitemap empty;
- extension auth flow preserved.

Progress note: current live staging gate, `robots.txt`, empty sitemap, and `scripts/smoke-staging-web.mjs` passed against `https://staging.anidachi.app`. The new post-password `X-Robots-Tag` behavior from this branch still needs verification after merge/deploy to `staging`.

- [x] **Step 3: Manifest checks**

Run:

```bash
node -e 'const m=require("./anidachi-extension-staging/manifest.json"); console.log(JSON.stringify({name:m.name, version:m.version, version_name:m.version_name, host_permissions:m.host_permissions, matches:m.content_scripts?.[0]?.matches}, null, 2))'
```

Expected:

- staging artifact points only at staging web/API and supported video hosts;
- production artifact points only at production web/API and supported video hosts.

Progress note: generated staging and production manifests match their channels and contain no broad host/content patterns.

- [x] **Step 4: Remote protection checks**

Run:

```bash
gh api repos/AniDachi/anidachi-LP/branches/staging/protection --jq '.required_status_checks.contexts'
gh api repos/AniDachi/anidachi-LP/branches/main/protection --jq '.required_status_checks.contexts'
gh variable list --env staging
gh variable list --env production
vercel env ls preview staging
```

Expected: GitHub/Vercel settings match the documented process.

Progress note: GitHub branch protection, GitHub staging/production environment vars, and Vercel Preview `(staging)` env entries match the documented process.

## Acceptance Criteria

The workflow hardening is complete when:

- `staging.anidachi.app` is the only active staging web base in scripts, GitHub vars, and current docs.
- Staging remains password-gated, noindexed, and absent from sitemap before and after entering the password.
- Extension auth through Chrome Identity works on a clean browser profile.
- `pnpm build:extension:staging` creates a Chrome Web Store tester-safe artifact by default.
- Broad host permissions are available only through an explicitly named developer build.
- Extension artifacts are automatically validated before CI uploads them.
- Required branch checks match the actual release gates, not just `pnpm check && pnpm test`.
- Manual workflow dispatch cannot deploy or package from arbitrary feature branches.
- OAuth callback allowlists contain the exact staging and production callback URLs.
- Active docs agree with deployed behavior.

## Recommended Execution Order

1. Task 1: canonical staging origin and envs.
2. Task 2: noindex after password.
3. Task 3: Bearer bypass tightening.
4. Task 4: store-safe staging extension build.
5. Task 5: artifact validator.
6. Task 7: staging smoke test.
7. Task 6: CI/branch protection after validators exist.
8. Task 8: Chrome Web Store release process.
9. Task 9: Worker release boundary.
10. Task 10 and Task 11: docs update.
11. Task 12: final verification.

This order fixes the current real-world blockers before improving process documentation.
