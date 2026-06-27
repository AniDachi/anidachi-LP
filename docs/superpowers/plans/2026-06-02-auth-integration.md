# Anidachi Auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing Anidachi website account system to the Chrome extension and Worker so rooms, participants, and future watch progress use real authenticated users instead of guest identities.

**Architecture:** The website/Supabase account system becomes the canonical identity and durable room database. The extension authenticates through `chrome.identity.launchWebAuthFlow`, stores extension-scoped tokens in `chrome.storage.local`, and sends verified tokens to the Worker. The Worker keeps realtime room state in Durable Objects, but derives participant identity from verified auth or room tokens instead of trusting client-provided participant objects.

**Tech Stack:** Next.js 15 App Router, Supabase Postgres with service-role server access and RLS enabled, `jose` JWTs, WXT Chrome extension, Chrome Identity API, Cloudflare Workers, Hono, Durable Objects, Zod/Vitest.

**Implementation decision update:** Guest/local room mode is intentionally removed for the commercial auth path. The extension must require website sign-in before room creation or room join, website APIs must issue room tokens, and the Worker must reject WebSocket connections without a valid room token. Any older task text below that mentions keeping guest fallback is superseded by this decision.

---

## Current Research Snapshot

Website repo inspected:

- `https://github.com/George-Kreatli/anidachi-LP`
- HEAD: `942a8de509ae419d0d2a60ef4231df669b3b8fed`

Website stack:

- Next.js 15 App Router
- React 19
- Tailwind CSS 4
- Supabase Postgres
- Custom Discord/Google OAuth
- `jose` HS256 JWT access and room tokens
- HttpOnly cookies for website sessions

Existing website auth files:

- `lib/anidachi-auth/db.ts`
- `lib/anidachi-auth/jwt.ts`
- `lib/anidachi-auth/session.ts`
- `lib/anidachi-auth/tokens.ts`
- `lib/anidachi-auth/handle-oauth-callback.ts`
- `app/api/auth/discord/route.ts`
- `app/api/auth/google/route.ts`
- `app/api/auth/callback/discord/route.ts`
- `app/api/auth/callback/google/route.ts`
- `app/api/auth/refresh/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/rooms/route.ts`
- `app/api/rooms/[roomId]/join/route.ts`
- `app/api/rooms/[roomId]/connect/route.ts`
- `app/room/[roomId]/page.tsx`
- `supabase/migrations/20260525_anidachi_auth.sql`

Existing website database:

- `users`
- `refresh_tokens`
- `rooms`
- `room_members`

Existing extension state:

- Guest participant creation lives in `apps/extension/src/identity.ts`.
- Room creation lives in `apps/extension/src/room-client.ts`.
- Overlay connects to unauthenticated Worker rooms in `apps/extension/src/overlay-app.tsx`.
- WXT manifest currently lacks `identity` permission and `externally_connectable`.

Existing Worker state at the time this historical plan was written:

- `apps/api/src/index.ts` exposed unauthenticated `POST /rooms`, `GET /ws/:roomId`, `/livekit/token`, and `/ice-servers`.
- Superseded current state: commercial room creation, room-token WebSocket
  joins, authenticated `/ice-servers`, and P2P-only media are now the active
  paths; legacy `/livekit/token` has been removed.
- `RoomDurableObject` trusts `JOIN.participant`.
- `RoomState` chooses host based on first joined client.

Official docs checked:

- Chrome Identity API: `chrome.identity.getRedirectURL()` generates `https://<extension-id>.chromiumapp.org/*`; `launchWebAuthFlow()` closes when the auth provider redirects there.
- Chrome `externally_connectable`: web pages cannot connect to an extension unless declared.
- Next.js App Router route handlers support `GET`/`POST` and cookie reads/writes in route handlers.
- Supabase RLS should remain enabled for exposed schemas; server APIs should use service-role for sensitive writes.

## Non-Negotiable Safety Rules

- Do not mix auth work into the current dirty P2P branch.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `ANIDACHI_JWT_SECRET`, TURN
  provider credentials, or other server-side secrets to the extension.
- Do not read website HttpOnly cookies from content scripts.
- Do not make the Worker trust `participant.id`, `displayName`, `avatarUrl`, or role from the extension in authenticated mode.
- Do not keep guest/local prototype mode in the authenticated commercial path.
- Do not write live playback ticks to Postgres.
- Do not change Crunchyroll adapter behavior in the auth tasks unless the task explicitly says so.

## Branch, Backup, and Commit Strategy

Use this exact sequence before implementation.

- [ ] **Step 1: Record current repo state**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi
git status --short
git branch --show-current
git log --oneline -5
```

Expected: current branch is `codex/p2p-media-experiment`; there may be uncommitted P2P/TURN files.

- [ ] **Step 2: Commit or stash current P2P state before auth**

If current P2P work should be preserved as the working baseline:

```bash
cd /Users/vladyslavhulyi/anidachi
pnpm check
pnpm test
git add apps/api/src/index.ts apps/api/src/ice-servers.ts apps/api/test/ice-servers.test.ts apps/extension/src/env.d.ts apps/extension/src/ghost-cam.ts apps/extension/src/p2p-media.ts apps/extension/src/p2p-ice.ts apps/extension/test/p2p-ice.test.ts docs/architecture.md docs/experimental-features.md packages/protocol/src/types.ts packages/protocol/test/protocol.test.ts
git commit -m "feat: stabilize p2p relay fallback"
```

If the P2P changes are not ready to commit:

```bash
cd /Users/vladyslavhulyi/anidachi
git stash push -u -m "wip p2p media before auth integration"
```

- [ ] **Step 3: Create an auth branch**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi
git switch -c codex/auth-integration
```

- [ ] **Step 4: Preserve website state**

Run in the website repo after cloning or moving it:

```bash
cd /path/to/anidachi-LP
git status --short
git branch --show-current
git log --oneline -5
git tag auth-integration-base-2026-06-02
```

If the website will be merged into the monorepo, do it in a dedicated commit before changing auth code.

## Target Flow

### Extension Login Flow

1. User clicks `Sign in` inside extension UI.
2. Extension calls `chrome.identity.launchWebAuthFlow`.
3. Website opens `/extension/connect?redirect_uri=<chromiumapp-url>&state=<random>`.
4. Website verifies the normal website session. If missing, it redirects user through existing Discord/Google OAuth.
5. Website creates a one-time extension auth code.
6. Website redirects to `https://<extension-id>.chromiumapp.org/auth?code=<code>&state=<state>`.
7. Extension receives the redirect URL.
8. Extension calls `POST /api/extension/auth/exchange`.
9. Website verifies the code and returns extension access/refresh tokens plus user profile.
10. Extension stores tokens in `chrome.storage.local`.
11. Extension uses authenticated participant identity for rooms.

### Authenticated Room Flow

1. Extension asks website API to create a room: `POST /api/rooms`.
2. Website creates the durable Supabase room row and returns `roomId`, `shareableLink`, and `roomToken`.
3. Extension connects to Worker WebSocket using the room token.
4. Worker verifies the token and derives `Participant` from claims or a signed participant profile.
5. Worker Durable Object tracks live room state only.
6. Invite link points to the website room landing page, not directly to raw page hash.
7. Website room page can hand off `roomId` to the extension.

## Files and Responsibilities

### Website Files to Add

- `apps/web/app/extension/connect/page.tsx`
  - Server page that requires website session and redirects to the extension callback with a one-time code.

- `apps/web/app/api/extension/auth/exchange/route.ts`
  - Exchanges one-time extension auth code for extension token pair and profile payload.

- `apps/web/app/api/extension/auth/refresh/route.ts`
  - Rotates or refreshes extension tokens without using website cookies.

- `apps/web/app/api/me/route.ts`
  - Returns the current website user from either cookie session or extension bearer token.

- `apps/web/lib/anidachi-auth/extension-codes.ts`
  - Creates, hashes, verifies, consumes one-time auth codes.

- `apps/web/lib/anidachi-auth/extension-session.ts`
  - Issues and verifies extension-scoped access/refresh tokens.

- `apps/web/supabase/migrations/YYYYMMDD_extension_auth.sql`
  - Adds `extension_auth_codes`, `devices`, and optional token metadata.

### Website Files to Modify

- `apps/web/lib/anidachi-auth/jwt.ts`
  - Add token `aud`/`typ` separation: `web_access`, `extension_access`, `room`.

- `apps/web/lib/anidachi-auth/db.ts`
  - Add helpers for auth codes, devices, profile lookup, room token creation.

- `apps/web/app/api/rooms/route.ts`
  - Accept extension bearer auth as well as website cookie auth.
  - Return a room token to the extension.

- `apps/web/app/api/rooms/[roomId]/connect/route.ts`
  - Accept extension bearer auth.
  - Return room token with verified membership.

- `apps/web/app/room/[roomId]/extension-check.tsx`
  - Use `externally_connectable` only for install/room handoff, not primary auth.

### Extension Files to Add

- `apps/extension/src/auth-tokens.ts`
  - Storage and refresh helper for extension auth tokens.

- `apps/extension/src/auth-client.ts`
  - `launchWebAuthFlow`, code exchange, `/api/me`, logout.

- `apps/extension/src/user-identity.ts`
  - Unified identity loader: authenticated user if available, guest fallback otherwise.

- `apps/extension/test/auth-client.test.ts`
  - Unit tests for redirect parsing, state verification, token storage.

### Extension Files to Modify

- `apps/extension/wxt.config.ts`
  - Add `identity` permission.
  - Add `externally_connectable.matches` for production website domain and localhost dev.

- `apps/extension/src/constants.ts`
  - Add `WEB_HTTP_BASE`.

- `apps/extension/src/identity.ts`
  - Keep guest identity, but make it fallback-only.

- `apps/extension/src/room-client.ts`
  - Add `Authorization` support for HTTP calls.
  - Add room token in WebSocket URL or first authenticated join message.

- `apps/extension/src/overlay-app.tsx`
  - Show signed-in profile in mini-panel.
  - Replace auto guest creation with unified identity loader.
  - Keep local guest mode when auth is unavailable.

### Worker/API Files to Add

- `apps/api/src/auth.ts`
  - Verify access/room JWTs using shared HS256 secret for MVP.

- `apps/api/test/auth.test.ts`
  - Verifies valid, expired, wrong-audience, wrong-room tokens.

### Worker/API Files to Modify

- `apps/api/src/index.ts`
  - Historical note: this plan originally included `/livekit/token`; that route
    has since been removed. Current media auth goes through room-token-protected
    `/ice-servers`.
  - Keep an explicit dev fallback env flag for local prototype.

- `apps/api/src/room-state.ts`
  - Accept server-derived participant.
  - Host comes from room token role, not join order, in authenticated mode.

- `packages/protocol/src/types.ts`
  - Add authenticated join event shape or token metadata if needed.

## Database Migration Design

Use server-side APIs and keep RLS enabled with no public browser policies for sensitive auth tables.

Recommended migration:

```sql
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null default 'Chrome extension',
  extension_installation_id text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.extension_auth_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  code_hash text not null unique,
  state_hash text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_extension_auth_codes_user_id
  on public.extension_auth_codes (user_id);

create index if not exists idx_extension_auth_codes_expires_at
  on public.extension_auth_codes (expires_at);

alter table public.devices enable row level security;
alter table public.extension_auth_codes enable row level security;
```

Optional later migration for profile separation:

```sql
create table if not exists public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

For now, the existing `users.display_name` and `users.avatar_url` are enough.

## Token Model

For MVP, HS256 is acceptable if the same `ANIDACHI_JWT_SECRET` is shared by website and Worker.

Access token claims:

```ts
type ExtensionAccessTokenPayload = {
  sub: string;
  email: string;
  plan: "watcher" | "nakama" | "junkie";
  typ: "extension_access";
  aud: "anidachi-extension";
};
```

Room token claims:

```ts
type RoomTokenPayload = {
  sub: string;
  roomId: string;
  role: "host" | "member";
  typ: "room";
  aud: "anidachi-worker";
};
```

Production improvement after MVP:

- Switch website token signing to EdDSA or RS256.
- Website keeps private key.
- Worker verifies with public key or JWKS.
- This removes the need to share the signing secret across services.

## Task 1: Normalize Website Into the Monorepo or Freeze Separate Repo Contract

**Files:**

- Create if merging: `apps/web/**`
- Modify: `pnpm-workspace.yaml`
- Modify: `turbo.json`
- Modify: `package.json`

- [ ] **Step 1: Choose repo mode**

Preferred mode:

```txt
Move or mirror George-Kreatli/anidachi-LP into /Users/vladyslavhulyi/anidachi/apps/web.
Convert npm scripts to pnpm.
Use workspace package dependencies where shared code is needed.
```

Fallback mode:

```txt
Keep website as a separate repo temporarily.
Use explicit API contracts only.
Do not import monorepo packages into the website until the repos are merged.
```

- [ ] **Step 2: If merging, copy website into apps/web**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi
mkdir -p apps/web
rsync -a --exclude .git --exclude node_modules --exclude .next /tmp/anidachi-LP-auth-plan/ apps/web/
```

- [ ] **Step 3: Add workspace entry**

Modify `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: Convert web scripts**

Modify `apps/web/package.json` so scripts use pnpm-compatible commands:

```json
{
  "scripts": {
    "dev": "next dev --turbopack -p 3003",
    "dev:clean": "rm -rf .next && next dev --turbopack -p 3003",
    "cache:jikan": "tsx scripts/cache-jikan-posters.ts",
    "build": "pnpm cache:jikan && next build",
    "start": "next start",
    "lint": "next lint",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 5: Verify web app still builds**

Run:

```bash
cd /Users/vladyslavhulyi/anidachi
pnpm --filter anidachi check
pnpm --filter anidachi build
```

Expected: TypeScript and Next build pass before auth changes.

- [ ] **Step 6: Commit**

```bash
git add apps/web pnpm-workspace.yaml package.json turbo.json pnpm-lock.yaml
git commit -m "chore: add anidachi web app to monorepo"
```

## Task 2: Add Extension Auth Code Storage on the Website

**Files:**

- Create: `apps/web/supabase/migrations/YYYYMMDD_extension_auth.sql`
- Create: `apps/web/lib/anidachi-auth/extension-codes.ts`
- Modify: `apps/web/lib/anidachi-auth/db.ts`
- Test: `apps/web/lib/anidachi-auth/extension-codes.test.ts`

- [ ] **Step 1: Add migration**

Create `apps/web/supabase/migrations/YYYYMMDD_extension_auth.sql` with the SQL from "Database Migration Design".

- [ ] **Step 2: Add code hashing helper test**

Create `apps/web/lib/anidachi-auth/extension-codes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashExtensionAuthCode, isSafeExtensionRedirectUri } from "./extension-codes";

describe("extension auth codes", () => {
  it("hashes codes deterministically without returning the raw code", () => {
    const first = hashExtensionAuthCode("secret-code");
    const second = hashExtensionAuthCode("secret-code");
    expect(first).toBe(second);
    expect(first).not.toContain("secret-code");
  });

  it("allows only chromium extension redirect URLs", () => {
    expect(isSafeExtensionRedirectUri("https://abc123.chromiumapp.org/auth")).toBe(true);
    expect(isSafeExtensionRedirectUri("https://evil.example.com/auth")).toBe(false);
    expect(isSafeExtensionRedirectUri("javascript:alert(1)")).toBe(false);
  });
});
```

- [ ] **Step 3: Implement helper**

Create `apps/web/lib/anidachi-auth/extension-codes.ts`:

```ts
import { createHash, randomBytes } from "crypto";
import { db } from "./db";

const EXTENSION_CODE_TTL_MS = 5 * 60 * 1000;

export function generateExtensionAuthCode(): string {
  return randomBytes(32).toString("base64url");
}

export function hashExtensionAuthCode(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isSafeExtensionRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org");
  } catch {
    return false;
  }
}

export async function createExtensionAuthCode(params: {
  userId: string;
  redirectUri: string;
  state: string;
}): Promise<string> {
  if (!isSafeExtensionRedirectUri(params.redirectUri)) {
    throw new Error("Unsafe extension redirect URI");
  }

  const code = generateExtensionAuthCode();
  const expiresAt = new Date(Date.now() + EXTENSION_CODE_TTL_MS);
  const { error } = await db().from("extension_auth_codes").insert({
    user_id: params.userId,
    code_hash: hashExtensionAuthCode(code),
    state_hash: hashExtensionAuthCode(params.state),
    redirect_uri: params.redirectUri,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`Failed to create extension auth code: ${error.message}`);
  return code;
}

export async function consumeExtensionAuthCode(params: {
  code: string;
  state: string;
}): Promise<{ userId: string } | null> {
  const codeHash = hashExtensionAuthCode(params.code);
  const stateHash = hashExtensionAuthCode(params.state);
  const client = db();

  const { data } = await client
    .from("extension_auth_codes")
    .select("id,user_id,state_hash,expires_at,consumed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (!data) return null;
  if (data.consumed_at) return null;
  if (data.state_hash !== stateHash) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  const { error } = await client
    .from("extension_auth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null);
  if (error) throw new Error(`Failed to consume extension auth code: ${error.message}`);

  return { userId: data.user_id as string };
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter anidachi test -- lib/anidachi-auth/extension-codes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/supabase/migrations apps/web/lib/anidachi-auth/extension-codes.ts apps/web/lib/anidachi-auth/extension-codes.test.ts
git commit -m "feat(web): add extension auth code storage"
```

## Task 3: Add Extension Token Issuing and Exchange Endpoints

**Files:**

- Modify: `apps/web/lib/anidachi-auth/jwt.ts`
- Create: `apps/web/lib/anidachi-auth/extension-session.ts`
- Create: `apps/web/app/extension/connect/page.tsx`
- Create: `apps/web/app/api/extension/auth/exchange/route.ts`
- Create: `apps/web/app/api/extension/auth/refresh/route.ts`
- Create: `apps/web/app/api/me/route.ts`
- Test: `apps/web/lib/anidachi-auth/extension-session.test.ts`

- [ ] **Step 1: Add JWT tests**

Create `apps/web/lib/anidachi-auth/extension-session.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { signExtensionAccessToken, verifyExtensionAccessToken } from "./extension-session";

beforeEach(() => {
  process.env.ANIDACHI_JWT_SECRET = "test-secret-test-secret-test-secret";
});

describe("extension session", () => {
  it("verifies extension access token claims", async () => {
    const token = await signExtensionAccessToken({
      sub: "user-1",
      email: "user@example.com",
      plan: "watcher",
    });
    await expect(verifyExtensionAccessToken(token)).resolves.toEqual({
      sub: "user-1",
      email: "user@example.com",
      plan: "watcher",
    });
  });

  it("rejects invalid tokens", async () => {
    await expect(verifyExtensionAccessToken("bad")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Implement extension session helper**

Create `apps/web/lib/anidachi-auth/extension-session.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { getUserById } from "./db";
import { generateRefreshToken, storeRefreshToken, validateRefreshToken } from "./db";

type Plan = "watcher" | "nakama" | "junkie";

function getJwtSecret(): Uint8Array {
  const secret = process.env.ANIDACHI_JWT_SECRET;
  if (!secret) throw new Error("ANIDACHI_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type ExtensionAccessTokenPayload = {
  sub: string;
  email: string;
  plan: Plan;
};

export async function signExtensionAccessToken(
  payload: ExtensionAccessTokenPayload,
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    plan: payload.plan,
    typ: "extension_access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setAudience("anidachi-extension")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getJwtSecret());
}

export async function verifyExtensionAccessToken(
  token: string,
): Promise<ExtensionAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      audience: "anidachi-extension",
    });
    if (payload.typ !== "extension_access") return null;
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.plan !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      plan: payload.plan as Plan,
    };
  } catch {
    return null;
  }
}

export async function issueExtensionTokenPair(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User ${userId} not found`);

  const accessToken = await signExtensionAccessToken({
    sub: user.id,
    email: user.email,
    plan: user.plan,
  });

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await storeRefreshToken(user.id, refreshToken, expiresAt);

  return { accessToken, refreshToken };
}

export async function refreshExtensionAccessToken(refreshToken: string): Promise<string | null> {
  const userId = await validateRefreshToken(refreshToken);
  if (!userId) return null;
  const user = await getUserById(userId);
  if (!user) return null;
  return signExtensionAccessToken({
    sub: user.id,
    email: user.email,
    plan: user.plan,
  });
}
```

- [ ] **Step 3: Add connect page**

Create `apps/web/app/extension/connect/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
import { createExtensionAuthCode, isSafeExtensionRedirectUri } from "@/lib/anidachi-auth/extension-codes";

type Props = {
  searchParams: Promise<{
    redirect_uri?: string;
    state?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ExtensionConnectPage({ searchParams }: Props) {
  const params = await searchParams;
  const redirectUri = params.redirect_uri ?? "";
  const state = params.state ?? "";

  if (!redirectUri || !state || !isSafeExtensionRedirectUri(redirectUri)) {
    redirect("/login?error=extension_invalid_redirect");
  }

  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/extension/connect?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`)}`);
  }

  const code = await createExtensionAuthCode({
    userId: session.userId,
    redirectUri,
    state,
  });

  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", state);
  redirect(callback.toString());
}
```

- [ ] **Step 4: Add exchange endpoint**

Create `apps/web/app/api/extension/auth/exchange/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { consumeExtensionAuthCode } from "@/lib/anidachi-auth/extension-codes";
import { getUserById } from "@/lib/anidachi-auth/db";
import { issueExtensionTokenPair } from "@/lib/anidachi-auth/extension-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    code?: string;
    state?: string;
  } | null;

  if (!body?.code || !body.state) {
    return NextResponse.json({ error: "code and state are required" }, { status: 400 });
  }

  const consumed = await consumeExtensionAuthCode({ code: body.code, state: body.state });
  if (!consumed) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  const user = await getUserById(consumed.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tokens = await issueExtensionTokenPair(user.id);
  return NextResponse.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      plan: user.plan,
    },
  });
}
```

- [ ] **Step 5: Add refresh endpoint**

Create `apps/web/app/api/extension/auth/refresh/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { refreshExtensionAccessToken } from "@/lib/anidachi-auth/extension-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { refreshToken?: string } | null;
  if (!body?.refreshToken) {
    return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
  }

  const accessToken = await refreshExtensionAccessToken(body.refreshToken);
  if (!accessToken) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  return NextResponse.json({ accessToken });
}
```

- [ ] **Step 6: Add `/api/me` endpoint**

Create `apps/web/app/api/me/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getSession } from "@/lib/anidachi-auth/session";
import { verifyExtensionAccessToken } from "@/lib/anidachi-auth/extension-session";

export const dynamic = "force-dynamic";

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export async function GET(request: NextRequest) {
  const bearer = bearerToken(request);
  const extensionPayload = bearer ? await verifyExtensionAccessToken(bearer) : null;
  const cookieSession = extensionPayload ? null : await getSession();
  const userId = extensionPayload?.sub ?? cookieSession?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      plan: user.plan,
    },
  });
}
```

- [ ] **Step 7: Run tests and commit**

```bash
pnpm --filter anidachi test -- lib/anidachi-auth/extension-session.test.ts lib/anidachi-auth/extension-codes.test.ts
pnpm --filter anidachi check
git add apps/web
git commit -m "feat(web): add extension auth bridge"
```

## Task 4: Add Extension Auth Client and Authenticated Identity Fallback

**Files:**

- Modify: `apps/extension/wxt.config.ts`
- Modify: `apps/extension/src/constants.ts`
- Create: `apps/extension/src/auth-tokens.ts`
- Create: `apps/extension/src/auth-client.ts`
- Create: `apps/extension/src/user-identity.ts`
- Modify: `apps/extension/src/identity.ts`
- Test: `apps/extension/test/auth-client.test.ts`

- [ ] **Step 1: Update WXT manifest**

Modify `apps/extension/wxt.config.ts`:

```ts
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Anidachi Local MVP",
    description: "Ambient watch-party overlay for local Anidachi MVP testing.",
    permissions: ["storage", "clipboardWrite", "identity"],
    externally_connectable: {
      matches: ["https://anidachi.app/*", "http://localhost:3003/*"],
    },
    host_permissions: [
      "http://127.0.0.1/*",
      "http://localhost/*",
      "http://*/*",
      "https://*/*",
      "file:///*",
    ],
    action: {
      default_title: "Anidachi",
    },
  },
});
```

- [ ] **Step 2: Add website base constants**

Modify `apps/extension/src/constants.ts`:

```ts
export const WEB_HTTP_BASE = import.meta.env.WXT_WEB_HTTP_BASE ?? "http://localhost:3003";
```

- [ ] **Step 3: Add token storage**

Create `apps/extension/src/auth-tokens.ts`:

```ts
import { storage } from "wxt/utils/storage";

const AUTH_STORAGE_KEY = "local:authTokens";

export interface StoredAuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    plan: "watcher" | "nakama" | "junkie";
  };
}

export async function getStoredAuthTokens(): Promise<StoredAuthTokens | null> {
  return (await storage.getItem<StoredAuthTokens>(AUTH_STORAGE_KEY)) ?? null;
}

export async function setStoredAuthTokens(tokens: StoredAuthTokens): Promise<void> {
  await storage.setItem(AUTH_STORAGE_KEY, tokens);
}

export async function clearStoredAuthTokens(): Promise<void> {
  await storage.removeItem(AUTH_STORAGE_KEY);
}
```

- [ ] **Step 4: Add auth client tests**

Create `apps/extension/test/auth-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseExtensionAuthRedirect } from "../src/auth-client";

describe("auth client", () => {
  it("parses code and matching state", () => {
    const parsed = parseExtensionAuthRedirect(
      "https://abc.chromiumapp.org/auth?code=c1&state=s1",
      "s1",
    );
    expect(parsed).toEqual({ code: "c1", state: "s1" });
  });

  it("rejects mismatched state", () => {
    expect(() =>
      parseExtensionAuthRedirect("https://abc.chromiumapp.org/auth?code=c1&state=bad", "s1"),
    ).toThrow("Auth state mismatch");
  });
});
```

- [ ] **Step 5: Add auth client**

Create `apps/extension/src/auth-client.ts`:

```ts
import { WEB_HTTP_BASE } from "./constants";
import { getStoredAuthTokens, setStoredAuthTokens, type StoredAuthTokens } from "./auth-tokens";

export function parseExtensionAuthRedirect(
  redirectUrl: string,
  expectedState: string,
): { code: string; state: string } {
  const url = new URL(redirectUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) throw new Error("Auth redirect is missing code or state");
  if (state !== expectedState) throw new Error("Auth state mismatch");
  return { code, state };
}

export async function signInWithWebsite(): Promise<StoredAuthTokens> {
  const state = crypto.randomUUID();
  const redirectUri = chrome.identity.getRedirectURL("auth");
  const connectUrl = new URL("/extension/connect", WEB_HTTP_BASE);
  connectUrl.searchParams.set("redirect_uri", redirectUri);
  connectUrl.searchParams.set("state", state);

  const finalUrl = await chrome.identity.launchWebAuthFlow({
    url: connectUrl.toString(),
    interactive: true,
  });
  if (!finalUrl) throw new Error("Authentication was cancelled");

  const parsed = parseExtensionAuthRedirect(finalUrl, state);
  const response = await fetch(new URL("/api/extension/auth/exchange", WEB_HTTP_BASE), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
  if (!response.ok) throw new Error(`Auth exchange failed: ${response.status}`);

  const tokens = (await response.json()) as StoredAuthTokens;
  await setStoredAuthTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string | null> {
  const stored = await getStoredAuthTokens();
  return stored?.accessToken ?? null;
}
```

- [ ] **Step 6: Add unified identity loader**

Create `apps/extension/src/user-identity.ts`:

```ts
import type { Participant } from "@anidachi/protocol";
import { getStoredAuthTokens } from "./auth-tokens";
import { createGuestParticipant } from "./identity";

export async function createCurrentParticipant(): Promise<Participant> {
  const auth = await getStoredAuthTokens();
  if (!auth) return createGuestParticipant();

  return {
    id: auth.user.id,
    displayName: auth.user.displayName,
    avatarUrl: auth.user.avatarUrl ?? undefined,
    role: "viewer",
    cameraEnabled: false,
    syncStatus: "unknown",
    lastSeenAt: Date.now(),
  };
}
```

- [ ] **Step 7: Wire overlay participant creation**

Modify `apps/extension/src/overlay-app.tsx` import:

```ts
import { createCurrentParticipant } from "./user-identity";
```

Replace the initial effect:

```ts
useEffect(() => {
  void createCurrentParticipant().then((createdParticipant) => {
    logDebug("identity", "participant ready", {
      participantId: createdParticipant.id,
      displayName: createdParticipant.displayName,
    });
    setParticipant(createdParticipant);
  });
  return () => clientRef.current.close();
}, []);
```

- [ ] **Step 8: Run tests and commit**

```bash
pnpm --filter @anidachi/extension test -- auth-client.test.ts
pnpm --filter @anidachi/extension check
git add apps/extension
git commit -m "feat(extension): add website auth client"
```

## Task 5: Authenticate Website Room Creation From Extension

**Files:**

- Modify: `apps/web/app/api/rooms/route.ts`
- Modify: `apps/web/app/api/rooms/[roomId]/connect/route.ts`
- Modify: `apps/extension/src/room-client.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Test: `apps/extension/test/room-client-auth.test.ts`

- [ ] **Step 1: Add website bearer session helper**

Add to `apps/web/lib/anidachi-auth/extension-session.ts`:

```ts
export async function getExtensionSessionFromAuthorization(
  authorization: string | null,
): Promise<ExtensionAccessTokenPayload | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  return verifyExtensionAccessToken(authorization.slice("Bearer ".length));
}
```

- [ ] **Step 2: Modify website `/api/rooms` to accept bearer**

In `apps/web/app/api/rooms/route.ts`, replace session loading with:

```ts
const cookieSession = await getSession();
const extensionSession = cookieSession
  ? null
  : await getExtensionSessionFromAuthorization(request.headers.get("authorization"));
const session = cookieSession ?? (extensionSession
  ? { userId: extensionSession.sub, email: extensionSession.email, plan: extensionSession.plan }
  : null);
```

Return room token in JSON:

```ts
const roomToken = await signRoomToken({
  sub: session.userId,
  roomId: room.room_id,
  role: "host",
});

return NextResponse.json({
  roomId: room.room_id,
  roomToken,
  shareableLink: `${origin}/room/${room.room_id}`,
});
```

- [ ] **Step 3: Modify extension `createRoom`**

In `apps/extension/src/room-client.ts`, change `createRoom` signature:

```ts
export async function createRoom(accessToken?: string | null): Promise<{
  roomId: string;
  roomToken?: string;
  shareableLink?: string;
}> {
  const response = await fetch(`${WEB_HTTP_BASE}/api/rooms`, {
    method: "POST",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(`Failed to create website room: ${response.status}`);
  }
  return (await response.json()) as {
    roomId: string;
    roomToken?: string;
    shareableLink?: string;
  };
}
```

Keep Worker `/rooms` fallback behind explicit guest mode if website auth is absent:

```ts
export async function createGuestWorkerRoom(): Promise<string> {
  const response = await fetch(`${API_HTTP_BASE}/rooms`, { method: "POST" });
  if (!response.ok) throw new Error(`Failed to create room: ${response.status}`);
  const payload = (await response.json()) as { roomId: string };
  return payload.roomId;
}
```

- [ ] **Step 4: Store active room token in overlay**

In `apps/extension/src/overlay-app.tsx`, add state:

```ts
const [roomToken, setRoomToken] = useState<string | null>(null);
const roomTokenRef = useRef<string | null>(null);
useEffect(() => {
  roomTokenRef.current = roomToken;
}, [roomToken]);
```

When creating room:

```ts
const accessToken = await getValidAccessToken();
const created = accessToken ? await createRoom(accessToken) : { roomId: await createGuestWorkerRoom() };
setRoomToken(created.roomToken ?? null);
connectToRoom(created.roomId, created.roomToken ?? null);
```

- [ ] **Step 5: Commit**

```bash
pnpm check
pnpm test
git add apps/web apps/extension
git commit -m "feat: create authenticated rooms from extension"
```

## Task 6: Make Worker Verify Room Tokens Without Breaking Guest Prototype

**Files:**

- Create: `apps/api/src/auth.ts`
- Create: `apps/api/test/auth.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/room-state.ts`
- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/test/protocol.test.ts`

- [ ] **Step 1: Add Worker auth tests**

Create `apps/api/test/auth.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { signRoomTokenForTest, verifyRoomToken } from "../src/auth";

beforeEach(() => {
  process.env.ANIDACHI_JWT_SECRET = "test-secret-test-secret-test-secret";
});

describe("worker auth", () => {
  it("verifies room token for matching room", async () => {
    const token = await signRoomTokenForTest({
      sub: "user-1",
      roomId: "room-1",
      role: "host",
    });
    await expect(verifyRoomToken(token, "room-1", process.env)).resolves.toEqual({
      sub: "user-1",
      roomId: "room-1",
      role: "host",
    });
  });

  it("rejects room token for another room", async () => {
    const token = await signRoomTokenForTest({
      sub: "user-1",
      roomId: "room-1",
      role: "host",
    });
    await expect(verifyRoomToken(token, "room-2", process.env)).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Implement Worker auth helper**

Create `apps/api/src/auth.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";

export interface WorkerAuthEnv {
  ANIDACHI_JWT_SECRET?: string;
}

export type VerifiedRoomToken = {
  sub: string;
  roomId: string;
  role: "host" | "member";
};

function getSecret(env: WorkerAuthEnv): Uint8Array {
  const secret = env.ANIDACHI_JWT_SECRET;
  if (!secret) throw new Error("ANIDACHI_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function verifyRoomToken(
  token: string,
  expectedRoomId: string,
  env: WorkerAuthEnv,
): Promise<VerifiedRoomToken | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(env), {
      audience: "anidachi-worker",
    });
    if (payload.typ !== "room") return null;
    if (payload.sub !== undefined && typeof payload.sub !== "string") return null;
    if (!payload.sub || payload.roomId !== expectedRoomId) return null;
    if (payload.role !== "host" && payload.role !== "member") return null;
    return {
      sub: payload.sub,
      roomId: payload.roomId as string,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function signRoomTokenForTest(params: VerifiedRoomToken): Promise<string> {
  return new SignJWT({
    roomId: params.roomId,
    role: params.role,
    typ: "room",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.sub)
    .setAudience("anidachi-worker")
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(getSecret(process.env));
}
```

- [ ] **Step 3: Add env fields**

Modify `apps/api/src/index.ts` `Env`:

```ts
ANIDACHI_JWT_SECRET?: string;
ANIDACHI_ALLOW_GUEST_ROOMS?: string;
```

- [ ] **Step 4: Authenticate WebSocket**

Recommended WebSocket URL:

```txt
wss://worker/ws/:roomId?roomToken=<jwt>
```

In `RoomDurableObject.fetch`, parse and verify before `server.accept()`:

```ts
const url = new URL(request.url);
const roomToken = url.searchParams.get("roomToken");
const allowGuest = this.env.ANIDACHI_ALLOW_GUEST_ROOMS === "true";
const verified = roomToken ? await verifyRoomToken(roomToken, this.room.roomId, this.env) : null;
if (!verified && !allowGuest) {
  return new Response("Unauthorized", { status: 401 });
}
```

Store verified socket identity:

```ts
private readonly verifiedBySocket = new Map<WebSocket, VerifiedRoomToken>();
```

After accept:

```ts
if (verified) {
  this.verifiedBySocket.set(server, verified);
}
```

- [ ] **Step 5: Derive participant in JOIN**

In authenticated mode, ignore incoming `event.participant` fields and build:

```ts
const verified = this.verifiedBySocket.get(socket);
const participant: Participant = verified
  ? {
      id: verified.sub,
      displayName: `User ${verified.sub.slice(0, 4)}`,
      role: verified.role === "host" ? "host" : "viewer",
      cameraEnabled: false,
      syncStatus: "unknown",
      lastSeenAt: Date.now(),
    }
  : event.participant;
```

Later, improve this by embedding display name/avatar in the room token or by adding a Worker profile lookup endpoint.

- [ ] **Step 6: Modify extension WebSocket connection**

In `apps/extension/src/room-client.ts`, extend options:

```ts
roomToken?: string | null;
```

Build WebSocket URL:

```ts
const url = new URL(`${API_WS_BASE}/ws/${encodeURIComponent(options.roomId)}`);
if (options.roomToken) url.searchParams.set("roomToken", options.roomToken);
const ws = new WebSocket(url.toString());
```

- [ ] **Step 7: Run Worker tests**

```bash
pnpm --filter @anidachi/api test -- auth.test.ts room-state.test.ts
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
```

- [ ] **Step 8: Commit**

```bash
git add apps/api apps/extension packages/protocol
git commit -m "feat(api): verify room tokens for websocket rooms"
```

## Task 7: Authenticated Invite Landing and Extension Handoff

**Files:**

- Modify: `apps/web/app/room/[roomId]/page.tsx`
- Modify: `apps/web/app/room/[roomId]/extension-check.tsx`
- Modify: `apps/extension/entrypoints/*.ts`
- Modify: `apps/extension/wxt.config.ts`

- [ ] **Step 1: Add extension external message handler**

In the extension background or content entrypoint, handle messages:

```ts
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ANIDACHI_JOIN_ROOM") return false;
  chrome.storage.local.set({
    anidachiLaunchIntent: {
      roomId: message.roomId,
      sourceUrl: message.sourceUrl,
      createdAt: Date.now(),
    },
  });
  sendResponse({ ok: true });
  return true;
});
```

- [ ] **Step 2: Update room page**

The website should:

- Require login.
- Call `/api/rooms/:roomId/join`.
- Show install/open extension state.
- Send `ANIDACHI_JOIN_ROOM` to extension if detected.
- Fall back to copyable invite.

- [ ] **Step 3: Test manually**

Manual test:

1. Open website room page while signed out.
2. Confirm redirect to login.
3. Sign in.
4. Confirm room page shows host/member count.
5. Confirm extension detects the room.
6. Confirm extension joins Worker room with authenticated user id.

- [ ] **Step 4: Commit**

```bash
git add apps/web apps/extension
git commit -m "feat: add authenticated room invite handoff"
```

## Task 8: Production Hardening Before Public Users

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/site-extension-integration-notes.md`
- Modify: `.env.example` files

- [ ] **Step 1: Document env vars**

Required website env:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANIDACHI_JWT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
ANIDACHI_GOOGLE_CLIENT_ID=
ANIDACHI_GOOGLE_CLIENT_SECRET=
```

Required Worker env/secrets:

```txt
ANIDACHI_JWT_SECRET=
ANIDACHI_ALLOW_GUEST_ROOMS=false
CLOUDFLARE_TURN_KEY_ID=
CLOUDFLARE_TURN_KEY_API_TOKEN=
```

Required extension build env:

```txt
WXT_WEB_HTTP_BASE=https://anidachi.app
WXT_API_HTTP_BASE=https://anidachi-api.vladislav-gul7.workers.dev
WXT_API_WS_BASE=wss://anidachi-api.vladislav-gul7.workers.dev
```

- [ ] **Step 2: Add security checklist**

Checklist:

- `ANIDACHI_ALLOW_GUEST_ROOMS=false` in production Worker.
- Extension has no service-role key.
- Website has no auth endpoint returning HttpOnly cookie tokens to arbitrary origins.
- Extension auth codes are single-use and expire in 5 minutes.
- Room tokens expire in 30 minutes.
- Refresh tokens can be revoked.
- RLS remains enabled on all public tables.

- [ ] **Step 3: Commit docs**

```bash
git add docs apps/web/.env.example
git commit -m "docs: document authenticated extension integration"
```

## Test Matrix

Run after every task that touches code:

```bash
pnpm check
pnpm test
```

Manual auth test:

1. Start web app on `http://localhost:3003`.
2. Start Worker on `http://127.0.0.1:8787`.
3. Build/load extension.
4. Click `Sign in`.
5. Complete Discord/Google OAuth.
6. Verify extension stores `authTokens`.
7. Create a room from extension.
8. Verify Supabase `rooms` row exists.
9. Verify Worker room snapshot participant id equals real user id, not guest id.
10. Invite second user/profile.
11. Verify second user joins as member/viewer.
12. Verify play/pause/seek/reactions/P2P media still work.

Regression test:

1. Clear extension auth storage.
2. Reload extension.
3. Confirm guest/local room still works if `ANIDACHI_ALLOW_GUEST_ROOMS=true`.
4. Confirm guest/local room is rejected in production when `ANIDACHI_ALLOW_GUEST_ROOMS=false`.

## Rollback Plan

If website auth breaks:

```bash
cd /path/to/anidachi-LP
git switch main
git reset --hard auth-integration-base-2026-06-02
```

If extension auth breaks but current guest MVP must keep working:

```bash
cd /Users/vladyslavhulyi/anidachi
git revert <auth-commit-sha>
pnpm build:extension:public
```

If Worker rejects all joins:

```bash
wrangler secret put ANIDACHI_ALLOW_GUEST_ROOMS
# value for emergency local/prototype only:
true
pnpm --filter @anidachi/api deploy
```

Production rollback should prefer reverting the Worker deployment to the previous version in Cloudflare dashboard over disabling auth permanently.

## Recommended Execution Order

1. Finish and commit current P2P/TURN state.
2. Create `codex/auth-integration`.
3. Merge or mirror website into `apps/web`.
4. Implement website extension auth bridge.
5. Implement extension login UI/storage.
6. Keep guest room fallback and verify no regressions.
7. Switch room creation to website API for signed-in users.
8. Add Worker room-token verification.
9. Turn authenticated mode on locally.
10. Test with two Chrome profiles.
11. Test with Mac + Windows.
12. Deploy website/Worker staging.
13. Only after staging passes, set production Worker `ANIDACHI_ALLOW_GUEST_ROOMS=false`.

## Key Decision

Use website/Supabase as the canonical identity and durable room database. Use the Worker only for realtime, transient room state. Keep the extension as the actual product interface over video.

This avoids three bad outcomes:

- duplicate user databases;
- extension-held backend secrets;
- permanent guest identities that cannot support friends, watch progress, billing, or real room membership.
