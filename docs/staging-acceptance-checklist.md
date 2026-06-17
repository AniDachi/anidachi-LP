# Staging Acceptance Checklist

Use this before promoting high-risk work from `staging` to `main`.

`staging.anidachi.app` is internal tester infrastructure. It must stay
password-gated and noindex.

## Always Check

- [ ] Latest PR/commit on `staging` is known.
- [ ] Required CI checks passed.
- [ ] Staging web loads after the staging password.
- [ ] `robots.txt` disallows indexing on staging.
- [ ] Staging gate response includes noindex headers.
- [ ] No production SEO/marketing page links to `staging.anidachi.app`.

## Site / Auth

- [ ] Google login works on staging.
- [ ] Discord login works on staging.
- [ ] `/api/me` returns the authenticated user after login.
- [ ] Extension connect flow opens `/extension/connect` and returns to the
      extension.
- [ ] New OAuth redirect URLs, if any, are documented.

## Extension

- [ ] Build the staging artifact with `pnpm build:extension:staging`.
- [ ] Validate with `pnpm validate:extension:staging`.
- [ ] Confirm manifest name is `Anidachi Staging`.
- [ ] Confirm debug info points at staging web/API/WS bases.
- [ ] Confirm permissions are narrow unless using the explicit broad local build.
- [ ] Load the artifact in a clean Chrome profile.
- [ ] Sign in from the extension.

## Room / P2P

Minimum for room/P2P changes:

- [ ] Host creates a room from a supported video page.
- [ ] Host can copy invite.
- [ ] Guest opens invite and joins.
- [ ] Guest is not left on a dead-end page.
- [ ] Both participants see remote Ghost Cam video when enabled.
- [ ] Push-to-talk sends audio to the peer.
- [ ] Playback sync works for play, pause, and seek.
- [ ] Reloading host recovers without ghost participants.
- [ ] Reloading guest recovers without ghost participants.
- [ ] Host can end room.
- [ ] Ended room cannot be rejoined.

Preferred media profile:

- [ ] Same machine, two clean Chrome profiles.
- [ ] Two separate machines.
- [ ] Different networks if connectivity, TURN, ICE, or reconnect changed.

## Evidence To Attach To PR

- Staging commit SHA.
- Extension `version_name` if extension changed.
- Commands run and pass/fail output summary.
- Screenshots or short recording for UI changes.
- Debug exports from host and guest for room/P2P changes.
- P2P scorecard output when debug exports are available.

## Promotion Rule

Do not promote high-risk room/auth/API/extension work to `main` until the
relevant sections above are checked or a deliberate exception is recorded in the
PR.
