# HBO Max staging adapter

The staging extension recognizes HTTPS links on the bare, `www` and `play` hosts of `hbomax.com` and `max.com`. HBO can redirect older links to its current site. The overlay attaches to the main on-demand player on `/video/watch/<content UUID>` and `/video/watch/<content UUID>/<edition UUID>`. The first UUID identifies the episode or movie across links. The extension keeps the existing canonical address and fingerprint for invitations and history.

## Rooms

Participants can browse independently on Home, Search, My Stuff, Series, Movies, Categories, genre and channel pages, and title details. Opening a title in the host's player directs guests to its watch URL. A guest browsing the catalog can also select **Back to video**. For either action, the extension prefers the local HBO episode link when the guest's page identifies a single matching edition. Otherwise it uses the guest's HBO host and the content UUID. Regional catalog and title pages keep the room attached during browsing. Opening a localized title page alone does not start playback. The shared catalog-room transport owns the connection and call during navigation.

## Watch history

A movie has a catalog UUID and a separate playback UUID. A series has one show UUID and individual playable episode UUIDs. History groups progress by the catalog identity and resumes the exact playable video. Capture requires confirmed content time. A trailer, loading screen or recognized ad cannot create progress.

The adapter reads the episode links HBO Max renders in each selected season. Localized season and episode labels supply display text and corroborate the series and episode coordinates. Ambiguous labels cannot assign a watch to an unrelated series or season. Observations add to a partial catalog and preserve prior progress. On a fresh watch link the room descriptor or a previously verified history row can provide the catalog identity. An unidentified watch link can support a room without writing an unverified personal history entry.

The history API uses provider and capacity version 5 for the HBO Max cohort. Older readers retain the providers negotiated by their existing version. Public extension manifests have no HBO Max site access.

## Validation

Check a movie and a series from their detail pages, a guest entering through an invite, playback controls, a host changing episodes, host and guest catalog visits, and the guest's return action. Check progress on the account history page. Region, title availability and concurrent-stream limits depend on the signed-in HBO Max accounts.
