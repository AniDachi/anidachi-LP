## Goal

What does this PR change, and why?

## Changed Areas

- [ ] Web / site
- [ ] API / Worker / Durable Objects
- [ ] Extension
- [ ] Shared protocol
- [ ] CI / deployment
- [ ] Docs / process
- [ ] Other:

## Affected Planes

- [ ] Durable product state (`apps/web` / Supabase / Stripe)
- [ ] Live room state (`apps/api` / Durable Objects / WebSockets)
- [ ] Browser runtime (`apps/extension`)
- [ ] Shared contracts (`packages/protocol`)
- [ ] No cross-plane behavior change

## Risk Class

- [ ] Low - docs or isolated non-runtime change
- [ ] Medium - user-visible behavior or one runtime surface
- [ ] High - auth, payments, extension, Worker, protocol, room/P2P, deploy, or env/secrets

## Quality Gate

- Gate profile from `docs/development-quality-gates.md`:
- `pnpm dev:check` result:
- Required manual/staging acceptance: yes / no / not applicable

## Verification

Commands run:

```bash

```

Results / notes:

```txt

```

## Staging / Release Notes

- Staging URL checked:
- Extension artifact / version_name if relevant:
- Worker deploy / smoke status if relevant:
- Manual acceptance required before `main`: yes / no

## Docs / Graphify

- [ ] Docs updated
- [ ] Docs not needed because:
- [ ] `pnpm graph:update` run
- [ ] Graphify update not needed because:

## Security / Env Impact

- [ ] No new secrets or env vars
- [ ] New or changed env vars are documented
- [ ] OAuth redirect allowlists unchanged or documented
- [ ] No secret values are committed or logged

## AI Contribution Notes

- Agent/tool used:
- Docs/plans read:
- Human/manual checks still needed:

## Rollback

How do we safely revert or roll back if this breaks staging/production?
