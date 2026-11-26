# Disney+ staging adapter

The Disney+ adapter covers on-demand movies and episodes on `www.disneyplus.com`, including titles selected from the Hulu hub. The staging extension requests access to that origin. The public extension manifest retains its existing site permissions.

## Rooms

The adapter attaches to the Disney+ playback surface on a `/play/<uuid>` route. A catalog preview cannot start playback synchronization or a history entry. Rooms use the playable UUID as their source identity. Guest navigation uses the same UUID with the guest’s current Disney+ locale.

The existing catalog room owns the connection, chat and call across player and catalog transitions. When the host returns to the catalog, the room stays open. A guest can browse independently and use the return control. Starting another title as host takes the guest to that title. Disney+ controls access to each stream through the viewer’s subscription and concurrent-stream allowance.

## History

Movies are keyed by their playable UUID. Episodes use the series entity UUID and episode playable UUID. Season and episode labels enrich those identities. The adapter reads the player’s content timeline to write progress. It collects episode cards as Disney+ renders them and marks an observed roster as partial. Inventory alone never creates watched progress.

History clients opt into Disney+ through provider and capacity version 4. Earlier versions preserve their provider sets. The additive database migration covers history and room source validation. Test its installation and the previous provider cohorts before sharing the staging build.
