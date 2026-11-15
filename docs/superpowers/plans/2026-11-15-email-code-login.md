# Email code login — staging

Owner approved implementation and staging delivery on November 15, 2026.
Production promotion is separate.

## Contract

- Add email → six-digit code → existing website session alongside Google/Discord.
- Resend only delivers mail from `AniDachi <notifications@anidachi.app>`.
- Codes expire after ten minutes, work once, are bound to the requesting browser,
  and permit five attempts. Resends wait sixty seconds. Durable email/IP/global
  send limits protect the sender quota; no in-memory rate-limit authority.
  Initial staging limits: five emails per address/hour, twenty per IP/hour,
  eighty overall per rolling day. Review the quota before production activation.
- Store keyed hashes, never clear codes. No code/email in URLs or logs.
- Only a unique, previously verified existing email can log into an old account.
  A legacy account first signs in with its usual provider to establish proof.
  Never infer verification from the mere presence of a Google/Discord ID.
- Create a new Free account only after code verification. Keep existing user IDs,
  names, profiles, subscriptions, friends, room quota and sessions unchanged.
- Email accounts still using the default `AniDachi user` name continue to
  `/login/name` after verification. A compact **Choose your name** form saves
  only `displayName` through the existing owner-checked profile endpoint, then
  resumes the original invitation, checkout, extension handoff or account path.
  Named accounts skip this step; existing names are never overwritten. The form
  remains available after reload, and an interrupted setup appears again on the
  next email sign-in. No schema change or new account flag is needed.
- Normalize email case without Gmail dot/plus alias rewriting. A database unique
  index prevents concurrent email/OAuth sign-ins from creating duplicate users.
- Reuse website token issuance/cookies and the existing sanitized return target,
  including extension PKCE handoff, checkout and invitation links.
- Feature defaults off; missing mail configuration fails closed for email only.

## Delivery and verification

1. Review existing identity/session contracts and current provider documentation.
2. Add private challenge/rate tables, atomic verification and account resolution;
   test expiry, attempts, replay, ownership, privileges and account preservation.
3. Add send/verify endpoints, compact accessible login UI, and a plain English
   text/HTML email. Test route failures and OAuth/session regression paths.
4. Run web checks/tests, focused extension auth checks, local SQL checks and build.
5. PR to staging with email login disabled. Let the guarded staging DB workflow
   apply the additive migration. Verify schema before enabling staging-only envs.
6. Verify hosted login, existing provider entrypoints and extension return target;
   hand staging to the owner. Do not enable production or change billing.

Rollback: disable `ANIDACHI_EMAIL_LOGIN_ENABLED` and redeploy staging. Existing
Google/Discord and issued sessions remain usable; retain additive schema and
new accounts. Never delete users as rollback.

Implementation uses private, RLS-enabled Supabase tables and service-role-only,
security-invoker RPCs. The existing narrowly scoped verified-email writer is
reused. Hourly cleanup removes expired challenges and old rate buckets; no new
queue or auth provider is introduced. OAuth lookup becomes case-insensitive,
escapes SQL pattern characters, rejects unverified new provider linking and
re-reads after a concurrent unique conflict. Existing provider IDs cannot be
overwritten. No billing API, subscription schema, extension or Worker contract
changes are required.

References checked: [Resend sending](https://resend.com/docs/api-reference/emails/send-email),
[idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
