import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "./anidachi-auth/db";
import { emailLoginHash, emailRequestIp, normalizeLoginEmail } from "./anidachi-auth/email-login";
import { emailJson, guardEmailRequest, readEmailBody } from "./email-request";
import { installLinkEmail } from "./install-link-email";
import { sendTransactionalEmail } from "./transactional-email";

async function consumeLimit(key: string, seconds: number, max: number, signal: AbortSignal) {
  const { error, data } = await db().rpc("consume_email_login_limit_v1", {
    p_key: key, p_seconds: seconds, p_max: max,
  }).abortSignal(signal);
  if (error || !Number.isInteger(data) || data < 0) throw new Error("Limit unavailable");
  return data as number;
}

export function createInstallLinkHandler(consume = consumeLimit, send = sendTransactionalEmail) {
  return async function post(request: NextRequest) {
    // Next can normalize the request URL (e.g. 127.0.0.1 to localhost).
    // The browser's Origin must match the host that actually received its POST.
    const host = request.headers.get("host") ?? request.nextUrl.host;
    const blocked = guardEmailRequest(request, `${request.nextUrl.protocol}//${host}`);
    if (blocked) return blocked;
    const input = await readEmailBody(request);
    const email = normalizeLoginEmail(input?.email);
    if (!email) return emailJson({ error: "invalid_email" }, 400);
    try {
      const ipKey = emailLoginHash("install/ip", emailRequestIp(request.headers));
      const addressKey = emailLoginHash("install/address", email);
      // Separate buckets leave the sign-in allowance available to returning users.
      const limits: [string, number, number][] = [
        [`install:ip:${ipKey}`, 3600, 20],
        [`install:cooldown:${addressKey}`, 60, 1],
        [`install:address:${addressKey}`, 3600, 3],
        ["install:daily", 86400, 20],
      ];
      const deadline = AbortSignal.timeout(6000);
      for (const [key, seconds, max] of limits) {
        const retryAfter = await consume(key, seconds, max, deadline);
        if (retryAfter > 0) {
          const response = emailJson({ error: "rate_limited" }, 429);
          response.headers.set("Retry-After", String(retryAfter));
          return response;
        }
      }
      await send(email, installLinkEmail(), `install-link/${randomUUID()}`);
      return emailJson({ ok: true });
    } catch {
      return emailJson({ error: "unavailable" }, 503);
    }
  };
}
