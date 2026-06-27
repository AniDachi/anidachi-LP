import { type NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "./lib/anidachi-auth/cookies";
import { verifyAccessToken } from "./lib/anidachi-auth/jwt";
import {
  AUTH_REFRESH_PATH,
  shouldAutoRefreshWebsiteSession,
} from "./lib/anidachi-auth/session-refresh";
import { sanitizeAuthReturnTo } from "./lib/anidachi-auth/return-to";
import { isPublicMarketingPath } from "./lib/middleware-routes";
import {
  STAGING_ACCESS_COOKIE,
  STAGING_ACCESS_PATH,
  buildStagingAccessCookieValue,
  canBypassStagingGate,
  getStagingAccessConfig,
  isValidStagingAccessCookie,
  passwordMatchesStagingGate,
  sanitizeStagingAccessNextPath,
} from "./lib/staging-access";

function renderStagingAccessPage(params: {
  nextPath: string;
  invalid?: boolean;
  status?: number;
}): NextResponse {
  const error = params.invalid
    ? `<p class="error">Wrong password. Try again.</p>`
    : "";

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Anidachi Staging</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at 18% 16%, rgba(126, 87, 255, .28), transparent 34%),
          radial-gradient(circle at 82% 12%, rgba(40, 140, 255, .18), transparent 30%),
          linear-gradient(135deg, #060612, #101421 58%, #06070d);
        color: rgba(255,255,255,.92);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .panel {
        width: min(420px, 100%);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 24px;
        background: rgba(11, 12, 22, .72);
        box-shadow: 0 24px 80px rgba(0,0,0,.42);
        backdrop-filter: blur(24px);
        padding: 28px;
      }
      .mark {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: linear-gradient(135deg, #7c3cff, #2f6cff);
        font-weight: 850;
        box-shadow: 0 12px 28px rgba(90, 74, 255, .34);
      }
      h1 {
        margin: 22px 0 6px;
        font-size: 30px;
        line-height: 1;
        letter-spacing: 0;
      }
      p {
        margin: 0;
        color: rgba(255,255,255,.62);
        line-height: 1.45;
      }
      form {
        display: grid;
        gap: 12px;
        margin-top: 24px;
      }
      input {
        width: 100%;
        border: 1px solid rgba(255,255,255,.13);
        border-radius: 16px;
        background: rgba(255,255,255,.08);
        color: white;
        font: inherit;
        outline: none;
        padding: 15px 16px;
      }
      input:focus {
        border-color: rgba(150, 125, 255, .8);
        box-shadow: 0 0 0 4px rgba(124, 60, 255, .18);
      }
      button {
        border: 0;
        border-radius: 16px;
        padding: 15px 16px;
        color: white;
        background: linear-gradient(135deg, #7c3cff, #2f6cff);
        font: inherit;
        font-weight: 750;
        cursor: pointer;
      }
      .error {
        margin-top: 14px;
        color: #ffb4b4;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <div class="mark">A</div>
      <h1>Anidachi staging</h1>
      <p>This preview is private. Enter the staging password once and this browser will be remembered.</p>
      ${error}
      <form method="post" action="${STAGING_ACCESS_PATH}">
        <input type="hidden" name="next" value="${escapeHtml(params.nextPath)}" />
        <input name="password" type="password" autocomplete="current-password" placeholder="Password" autofocus />
        <button type="submit">Continue</button>
      </form>
    </main>
  </body>
</html>`,
    {
      status: params.status ?? 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function withStagingNoindexHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const currentPath = `${pathname}${request.nextUrl.search}`;
  const config = await getStagingAccessConfig();
  const isPublic = isPublicMarketingPath(pathname);

  // Public SEO/marketing pages on production skip JWT verify and auth-refresh redirects.
  if (isPublic && !config.enabled) {
    return NextResponse.next();
  }

  if (!isPublic) {
    const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    const hasValidAccessToken = accessToken
      ? Boolean(await verifyAccessToken(accessToken))
      : false;

    if (
      shouldAutoRefreshWebsiteSession({
        method: request.method,
        pathname,
        hasValidAccessToken,
        hasRefreshToken: Boolean(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value),
      })
    ) {
      const nextPath = sanitizeAuthReturnTo(currentPath);
      if (nextPath) {
        const refreshUrl = new URL(AUTH_REFRESH_PATH, request.url);
        refreshUrl.searchParams.set("next", nextPath);
        return NextResponse.redirect(refreshUrl);
      }
    }
  }

  if (!config.enabled) return NextResponse.next();

  const nextPath = sanitizeStagingAccessNextPath(
    currentPath,
  );

  if (pathname === STAGING_ACCESS_PATH && request.method === "GET") {
    return renderStagingAccessPage({
      nextPath: sanitizeStagingAccessNextPath(
        request.nextUrl.searchParams.get("next"),
      ),
      status: 200,
    });
  }

  if (pathname === STAGING_ACCESS_PATH && request.method === "POST") {
    const formData = await request.formData().catch(() => null);
    const password = formData?.get("password");
    const redirectPath = sanitizeStagingAccessNextPath(formData?.get("next"));

    if (
      typeof password === "string" &&
      (await passwordMatchesStagingGate(password, config))
    ) {
      const response = NextResponse.redirect(new URL(redirectPath, request.url), 303);
      response.cookies.set(
        STAGING_ACCESS_COOKIE,
        await buildStagingAccessCookieValue(config),
        {
          httpOnly: true,
          secure: request.nextUrl.protocol === "https:",
          sameSite: "lax",
          path: "/",
          maxAge: config.cookieMaxAgeSeconds,
        },
      );
      return response;
    }

    return renderStagingAccessPage({
      nextPath: redirectPath,
      invalid: true,
    });
  }

  if (
    canBypassStagingGate({
      pathname,
      method: request.method,
      authorization: request.headers.get("authorization"),
    })
  ) {
    return withStagingNoindexHeaders(NextResponse.next());
  }

  const cookieValue = request.cookies.get(STAGING_ACCESS_COOKIE)?.value;
  if (await isValidStagingAccessCookie(cookieValue, config)) {
    return withStagingNoindexHeaders(NextResponse.next());
  }

  if (isApiPath(pathname)) {
    return NextResponse.json(
      { error: "Staging access required" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }

  return renderStagingAccessPage({ nextPath });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)",
  ],
};
