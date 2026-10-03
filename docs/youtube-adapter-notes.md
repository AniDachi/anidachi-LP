# YouTube Adapter Notes

This document is the maintenance contract for AniDachi's YouTube provider
adapter. Shared room and overlay code must consume normalized adapter
capabilities; it must not inspect YouTube selectors or infer YouTube state.

## Supported Surface

- The overlay mounts only on finite-duration YouTube `/watch?v=<id>` pages.
- Feed previews, Shorts, embeds, channel pages, search, and other YouTube routes
  are blocked from adapter fallback and do not receive the AniDachi overlay.
- A YouTube room can navigate only to another valid YouTube watch source.
  Cross-provider navigation is rejected by both the extension and Room Worker.
- Navigation uses a canonical watch URL and a bounded room hash. It does not use
  undocumented YouTube player APIs.

## Ownership

The YouTube folder owns:

- watch-route and video-ID parsing;
- player discovery and source identity;
- same-provider navigation;
- player chrome measurement and overlay safe insets;
- playback-phase detection;
- YouTube-specific playback observations.

The shared `PlaybackSyncController` owns host authority, drift correction,
barriers, buffering debounce, autoplay recovery, and transport events. It sees
only normalized phase snapshots and never reads YouTube DOM.

## Playback Phases

`YouTubePlaybackPhaseTracker` reports:

- `content`: stable finite VOD content;
- `interstitial`: a confirmed local advertisement;
- `buffering`: confirmed content without enough ready data;
- `transition`: source identity or player readiness is not stable;
- `unsupported`: metadata confirms a non-finite/live timeline.

The tracker observes only the player class and bounded ad containers, plus
native media readiness events. `ad-showing` is a strong signal. Persistent weak
ad nodes require corroboration and hidden nodes are ignored. A short exit grace
prevents an ad pod from briefly leaking content events between consecutive ads.

Signal precedence is:

```txt
transition -> interstitial -> unsupported -> buffering -> content
```

Contradictory state fails closed to `transition`.

## Synchronization Policy

- Advertisement media is never paused, played, sought, skipped, or published as
  room content.
- A host advertisement persists one paused `HOST_STATE` at the last confirmed
  content time. A pre-roll uses time `0`.
- A guest advertisement does not pause the room. Only the newest authoritative
  host state is retained and applied after content returns.
- Source transitions and unsupported media block local events, heartbeats, and
  remote media operations. A transition that does not stabilize within ten
  seconds reports a source mismatch.
- Host buffering shorter than 500 ms is ignored. Longer buffering persists one
  content hold; guest buffering remains local.
- Host playback rate is authoritative and is applied before drift correction.
- `NotAllowedError` produces one `Resume sync` action. AniDachi does not retry
  autoplay in a timer loop.

## Selector Maintenance

When YouTube changes its DOM:

1. Capture privacy-safe diagnostics from both participants.
2. Update selectors only inside `source-adapters/youtube/`.
3. Add a fixture proving strong, weak, hidden, entry, exit, and cleanup behavior.
4. Keep observers scoped to the player and ensure disposal remains idempotent.
5. Run the full extension suite and two-profile staging acceptance.

Diagnostics may include adapter ID, provider, phase, content time, playback
rate, action, source generation, and navigation status. Do not log video IDs,
raw fingerprints, URLs, titles, DOM text, or advertisement metadata.

## Required Acceptance

Automated:

```bash
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm build:extension:staging
pnpm validate:extension:staging
```

Manual, with two independent browser profiles:

- play, pause, seek, and playback-rate changes;
- guest-local control rejection;
- host-only ad, guest-only ad, simultaneous/different-length ads, and pre-roll;
- short and long host buffering plus guest buffering;
- blocked autoplay and `Resume sync`;
- same-provider source switching and reconnect during a hold;
- normal, theater, and fullscreen player chrome behavior;
- a final Crunchyroll regression pass.

Automated fixtures do not replace real-ad acceptance.


## Message composer interaction: local candidate, October 1, 2026

After confirming the Crunchyroll composer fix, the owner requested the same
behavior on YouTube. The shared keyboard/quiet-release mechanism is reused.
`youtube/composer-chrome.ts` owns the CSS selectors; the content entrypoint includes
them in its existing page stylesheet. No provider-specific branches or selectors
are added to the shared React overlay.

Opening/typing/sending keeps native controls, top/bottom gradients, progress bar,
control tooltips and the central control animation hidden. The modern YouTube DOM
has a separate progress-bar sibling, so hiding only the bottom panel is not enough.
Descendant visibility and pointer events are suppressed too, because YouTube
buttons explicitly restore them. The rule requires an AniDachi-owned YouTube
player and the existing composer marker; removal of either restores native styles.

Video, captions, buffering/error UI, ads and AniDachi UI are not hidden. The rule
also excludes `ad-showing` players, preserving their native controls. The existing
geometry observer tracks composer-marker changes to release/restore safe insets.
No player classes, playback APIs, ad behavior, room events or permissions change.

Evidence: current YouTube player DOM inspected read-only; computed-style tests
cover guard/open/quiet states, descendant hit targets, protected surfaces, native
first-event delivery, unmounted players and ad-mode escape. Geometry tests cover
hide/release notifications. The new cases fail before the changes; afterwards,
typecheck and all 2,150 extension tests pass. Build and validate the local staging
artifact before owner Reload. This does not deploy the staging website/Worker.

Owner acceptance is pending: Reload the unpacked extension and refresh YouTube,
then open and send via Enter/Send, use emoji, reopen/close, and resume native video
controls. Check normal, theater and fullscreen modes, including Space/K, seek,
Escape and captions. Existing ad/sync acceptance remains independent: these input
and CSS fixtures do not establish real-ad or two-client playback evidence.
