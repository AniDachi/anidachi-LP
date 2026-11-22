# Disney+ staging adapter

The Disney+ adapter covers on-demand movies and episodes on `www.disneyplus.com`, including titles selected from the Hulu hub. The staging extension requests access to that origin. The public extension manifest retains its existing site permissions.

## Rooms

The adapter attaches to the Disney+ playback surface on a `/play/<uuid>` route. A catalog preview cannot start playback synchronization or a history entry. Rooms use the playable UUID as their source identity. Guest navigation uses the same UUID with the guest’s current Disney+ locale.

The existing catalog room owns the connection, chat and call across player and catalog transitions. When the host returns to the catalog, the room stays open. A guest can browse independently and use the return control. Starting another title as host takes the guest to that title. Disney+ controls access to each stream through the viewer’s subscription and concurrent-stream allowance.

## History

Movies are keyed by their playable UUID. Episodes use the series entity UUID and episode playable UUID. Season and episode labels enrich those identities. The adapter reads the player’s content timeline to write progress. On a direct playback link the adapter resolves the public Disney+ title document in the current route locale. It uses the provider’s series, season and episode IDs and localized episode labels. A regional playable with a different ID can be matched to the player’s displayed series, episode title and both ordinals. The personal event keeps the ID of the actual playable.

The published episode lists and the signed-in detail grid supply the catalog. When history requests a refresh, missing seasons load through Disney’s own season selector URLs with at most three concurrent requests. A route or account change cancels pending work. Named seasons keep their Disney season UUID. A snapshot remains partial because public listings cannot establish entitlement to every release. Catalog rows alone never count as watched.

History clients opt into Disney+ through provider and capacity version 4. Earlier versions preserve their provider sets. The additive database migration covers history and room source validation. Test its installation and the previous provider cohorts before sharing the staging build.
