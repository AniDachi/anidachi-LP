export const STAGING_ACCESS_COOKIE = "anidachi_staging_access";
export const STAGING_ACCESS_PATH = "/__anidachi/staging-access";

export type StagingAccessConfig =
  | { enabled: false }
  | {
      enabled: true;
      passwordHash: string;
      cookieSecret: string;
      cookieMaxAgeSeconds: number;
    };

type Env = Record<string, string | undefined>;

const DEFAULT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function normalizeSha256Hash(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || !SHA256_HEX_PATTERN.test(normalized)) return null;
  return normalized;
}

function parseCookieMaxAge(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_COOKIE_MAX_AGE_SECONDS;
  return Math.max(60, Math.min(Math.floor(parsed), 60 * 60 * 24 * 90));
}

export async function getStagingAccessConfig(
  env: Env = process.env,
): Promise<StagingAccessConfig> {
  if (env.ANIDACHI_STAGING_GATE_ENABLED !== "true") return { enabled: false };
  if (env.VERCEL_ENV === "production") return { enabled: false };

  const passwordHash =
    normalizeSha256Hash(env.ANIDACHI_STAGING_GATE_PASSWORD_SHA256) ??
    (env.ANIDACHI_STAGING_GATE_PASSWORD
      ? await sha256Hex(env.ANIDACHI_STAGING_GATE_PASSWORD)
      : null);

  if (!passwordHash) return { enabled: false };

  return {
    enabled: true,
    passwordHash,
    cookieSecret: env.ANIDACHI_STAGING_GATE_COOKIE_SECRET || passwordHash,
    cookieMaxAgeSeconds: parseCookieMaxAge(
      env.ANIDACHI_STAGING_GATE_COOKIE_MAX_AGE_SECONDS,
    ),
  };
}

export async function passwordMatchesStagingGate(
  password: string,
  config: Extract<StagingAccessConfig, { enabled: true }>,
): Promise<boolean> {
  return (await sha256Hex(password)) === config.passwordHash;
}

export async function buildStagingAccessCookieValue(
  config: Extract<StagingAccessConfig, { enabled: true }>,
): Promise<string> {
  const signature = await sha256Hex(
    `anidachi-staging-access:v1:${config.passwordHash}:${config.cookieSecret}`,
  );
  return `v1.${signature}`;
}

export async function isValidStagingAccessCookie(
  value: string | undefined,
  config: Extract<StagingAccessConfig, { enabled: true }>,
): Promise<boolean> {
  if (!value?.startsWith("v1.")) return false;
  return value === (await buildStagingAccessCookieValue(config));
}

export function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$/i.test(
      pathname,
    )
  );
}

function canBearerBypassStagingGate(pathname: string, method: string): boolean {
  if (pathname === "/api/me" && method === "GET") return true;
  if (pathname === "/api/me/profile" && method === "PATCH") return true;
  if (pathname === "/api/friends" && method === "GET") return true;
  if (pathname === "/api/friends/requests" && method === "POST") return true;
  if (/^\/api\/friends\/requests\/[^/]+\/accept$/.test(pathname) && method === "POST") {
    return true;
  }
  if (/^\/api\/friends\/requests\/[^/]+\/decline$/.test(pathname) && method === "POST") {
    return true;
  }
  if (/^\/api\/friends\/[^/]+$/.test(pathname) && method === "DELETE") return true;
  if (/^\/api\/users\/[^/]+\/block$/.test(pathname) && method === "POST") {
    return true;
  }
  if (pathname === "/api/recent-people" && method === "GET") return true;
  if (/^\/api\/recent-people\/[^/]+\/hide$/.test(pathname) && method === "POST") {
    return true;
  }
  if (pathname === "/api/groups" && (method === "GET" || method === "POST")) {
    return true;
  }
  if (/^\/api\/groups\/[^/]+$/.test(pathname) && (method === "PATCH" || method === "DELETE")) {
    return true;
  }
  if (/^\/api\/groups\/[^/]+\/members$/.test(pathname) && method === "POST") {
    return true;
  }
  if (/^\/api\/groups\/[^/]+\/members\/[^/]+$/.test(pathname) && method === "DELETE") {
    return true;
  }
  if (pathname === "/api/invites" && (method === "GET" || method === "POST")) {
    return true;
  }
  if (/^\/api\/invites\/[^/]+\/accept$/.test(pathname) && method === "POST") {
    return true;
  }
  if (/^\/api\/invites\/[^/]+\/decline$/.test(pathname) && method === "POST") {
    return true;
  }
  if (pathname === "/api/rooms" && method === "POST") return true;
  if (/^\/api\/rooms\/[^/]+$/.test(pathname) && method === "GET") return true;
  if (/^\/api\/rooms\/[^/]+\/connect$/.test(pathname) && method === "POST") {
    return true;
  }
  if (/^\/api\/rooms\/[^/]+\/end$/.test(pathname) && method === "POST") {
    return true;
  }
  return false;
}

export function canBypassStagingGate(params: {
  pathname: string;
  method: string;
  authorization?: string | null;
}): boolean {
  if (params.method === "OPTIONS") return true;
  if (isStaticAssetPath(params.pathname)) return true;
  if (params.pathname === STAGING_ACCESS_PATH) return true;
  if (params.pathname.startsWith("/api/extension/auth/")) return true;
  if (params.pathname === "/api/stripe/webhook" && params.method === "POST") {
    return true;
  }
  return (
    params.authorization?.startsWith("Bearer ") === true &&
    canBearerBypassStagingGate(params.pathname, params.method)
  );
}

export function sanitizeStagingAccessNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith(STAGING_ACCESS_PATH)) return "/";
  return value;
}
