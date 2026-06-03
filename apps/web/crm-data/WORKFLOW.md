# Daily workflow (human)

1. **Queue** — Web: “Due today” on `/kreatli-email-crm`. CLI: `npm run crm -- queue`.
2. **Draft** — Pick a template; “Copy rendered” on a contact, or CLI: `npm run crm -- render intro --contact you@co.com`.
3. **Send** — Connect Gmail on the CRM page (OAuth, send-only scope), then use **Send via Gmail** on each contact; or paste into Gmail manually.
4. **Log** — Web: “Log touch” summary on the contact. CLI: `npm run crm -- log-touch you@co.com "1st touch sent"`.
5. **Schedule** — Set **Next action** date and **Save** (or CLI `npm run crm -- set --email x --next YYYY-MM-DD`).
6. **Replies** — Set **status** to `replied` / `booked` / `closed` as appropriate.

# Agent / OpenClaw (phase 2)

- Point the agent **workspace** at this `crm-data/` directory (or repo root with `CRM_DATA_DIR`).
- Prefer **`exec`** the same CLI: `npm run crm -- …` from the repo root, or read/write `contacts.json` / `touches.jsonl` per `SCHEMA.md`.
- Do **not** auto-send cold email without an explicit human step.
