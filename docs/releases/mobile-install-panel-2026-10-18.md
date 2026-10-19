# Mobile installation panel — October 18, 2026

## Scope and behavior

The owner accepted the third mobile design and its local implementation, then
authorized delivery through a feature PR into staging. This is Web-only work.
Production promotion, extension packaging, billing and account changes are outside
this delivery.

On phones and iPadOS, explicit installation clicks open one native dialog with
the accepted charcoal surface, ivory Store button, phone-to-computer illustration
and real platform marks. It explains that AniDachi runs in desktop Chrome. The
Store destination remains `CHROME_WEB_STORE_URL`; this UI does not claim that the
extension has already been installed. The Add to Desktop hint follows
[Google's public instructions](https://support.google.com/chrome_webstore/answer/2664769?hl=en),
including using the same Google account in Chrome on both devices.

Entry points include marketing/navigation/install hub, the Free pricing CTA,
empty Watch Library, Free billing card and active trial/paid welcome screen.
Desktop, modified clicks and unsupported-dialog browsers retain normal links.
The compact navigation label is `Install` so it fits a 320px viewport.

The lightweight `InstallLink` context is separate from the panel's visual imports.
Panel content mounts after the first tap. Native modal focus, Escape and backdrop
dismissal, reduced motion and the existing background-scroll lock are preserved.
No polling, billing request or trial activation is added by opening the panel.

Share uses the native share sheet where available, then clipboard; if neither
works, a selectable URL is shown. Cancellation never reports success. Rapid taps
share one pending operation, and a late result cannot alter a reopened panel.
The URL keeps the current origin and only validated `/extension` context:
the existing safe room return, `welcome=1`, or the `#using` instruction anchor.
Unrelated query data and external destinations are discarded.

## Local verification

- Web TypeScript check passed.
- Full Web suite: 1,282 passed, six existing skips, no failures. A subsequently
  added late-clipboard/reopen case passed with the focused install suite (12/12),
  followed by another successful TypeScript check.
- Actual local homepage with mobile Chrome user-agent: 390x844 and 320x568;
  panel and primary button fit without horizontal overflow. At 320x568 the
  panel is about 513px tall and the primary button ends near 377px.
- Install from the mobile menu closes the menu before opening the panel.
  Escape restores focus, background scrolling is locked, and reopening works.
- Desktop routing, safe return URLs, native-share cancellation, clipboard/manual
  fallbacks, iPadOS detection and mobile trial/paid welcome integration are covered
  by tests. Physical-device Google handoff is not claimed tested.
- The development-only `/dev/mobile-install` preview returns 404 in deployed builds.
  Staging verification uses the actual homepage and `/extension` instead.
- `git diff --check` passed. CI and deployment identities belong in the PR receipt.

The staging-preparation run exposed an existing randomized anti-abuse test flaw:
replacing the signature suffix with `AA` can leave the original signature intact.
The fixture now flips one decoded signature byte, guaranteeing tampering. Only
the test fixture changes; production verification and trial behavior are unchanged.
The local preview's internal home link also uses Next.js Link to satisfy build lint.

No new environment variables, secrets, OAuth allowlists, schema migrations,
entitlements, protocol payloads or extension permissions are introduced. The
accepted extension ZIP remains unchanged.

## Graphify and release gates

Graphify was queried for installation and staging relationships; source and tests
remain authoritative. The required code refresh failed before publication with
`Unresolved cross-source AST node: storage (wxt/utils/storage)`. This comes from
pending extension graph reconciliation, outside this Web-only patch. The existing
graph/report/manifest remain unchanged. Semantic extraction and its safe adapter
attempt are recorded in the PR; do not claim a successful graph refresh or broaden
this change into graph tooling repair.

Staging remains password-gated and noindex. Inspect its successful deployment and
mobile panel before production promotion; physical-phone Add to Desktop is a
separate acceptance check. No production action is authorized by this record.

## Rollback

Revert this feature PR through another staging PR and redeploy Web. There is no
database, Worker, extension or payment rollback to coordinate. Existing desktop
installation destinations and the frozen Store ZIP stay compatible.
