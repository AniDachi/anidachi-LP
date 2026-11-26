# Room history in the extension

The Room tab offers a platform selector and the existing room action. Beneath it, Recent rooms shows up to three completed rooms, newest completion first. Each row shows the platform, the local creation date and the elapsed time from room creation to completion. Opening a row shows the two times and any known companions. View all reads older rooms on demand.

The extension reads `GET /api/account/room-history` with its current access token. The server derives the owner from that token and pages by completion time and room ID. The host sees their completed rooms. A guest sees rooms where the server observed them together with another participant. An outstanding invitation or an HTTP join alone does not establish joint presence.

The existing verified WebSocket presence writer saves one unordered user pair per room in `room_companion_pairs`. Reconnecting is idempotent. Each viewer sees only their own confirmed companions, subject to account blocks. Earlier rooms can have partial participant details because the previous evidence kept only the most recent room per pair. Account or room deletion cascades to these pair records.
