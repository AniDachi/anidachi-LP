# HBO Max staging adapter

The staging extension supports on-demand playback on `https://www.hbomax.com`. The main player owns the overlay on a `/video/watch/<uuid>` route. The extension observes the site's visible player and catalog. Playback detection and invitations use the playable UUID.

## Rooms

Participants can browse independently on Home, Search, My Stuff, Series, Movies, Categories, genre and channel pages, and title details. Opening a title in the host's player directs guests to its watch URL. A guest browsing the catalog can also select **Back to video**. The shared catalog-room transport owns the connection and call during navigation.

## Watch history

A movie has a catalog UUID and a separate playback UUID. A series has one show UUID and individual playable episode UUIDs. History groups progress by the catalog identity and resumes the exact playable video. Capture requires confirmed content time. A trailer, loading screen or recognized ad cannot create progress.

The adapter reads the episode links HBO Max renders in each selected season. Observations add to a partial catalog and preserve prior progress. On a fresh watch link the room descriptor or a previously verified history row can provide the catalog identity. An unidentified watch link can support a room without writing an unverified personal history entry.

The history API uses provider and capacity version 5 for the HBO Max cohort. Older readers retain the providers negotiated by their existing version. Public extension manifests have no HBO Max site access.

## Validation

Check a movie and a series from their detail pages, a guest entering through an invite, playback controls, a host changing episodes, host and guest catalog visits, and the guest's return action. Check progress on the account history page. Region, title availability and concurrent-stream limits depend on the signed-in HBO Max accounts.
