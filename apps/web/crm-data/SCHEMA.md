# Kreatli CRM data (agent-first)

## Layout

| File / dir | Purpose |
|-----------|---------|
| `meta.json` | `schema_version` (currently `1`), `updated_at` (ISO, bumped when contacts are saved). |
| `contacts.json` | Array of contacts (PII — gitignored). |
| `touches.jsonl` | One JSON object per line: `id`, `contact_id`, `sent_at` (ISO), `summary`. |
| `templates/*.md` | Email drafts; placeholders: `{{first_name}}`, `{{company}}`, `{{email}}`. |
| `inbox/` | Optional staging for proposed imports (human merges). |
| `gmail-tokens.json` | OAuth refresh/access tokens for Gmail send (gitignored). |
| `SCHEMA.md` | This file. |
| `WORKFLOW.md` | Human + agent daily steps. |
| `AGENTS.md` | Short OpenClaw / agent rules. |

## Contact fields

- `id` (UUID), `email` (lowercase), `company`, `first_name`, `segments[]`, `notes`
- `status`: `active` | `replied` | `booked` | `closed` | `dnc`
- `next_action_date`: `YYYY-MM-DD` or `null`
- `created_at`, `updated_at`: ISO 8601

## Pre-build decisions (locked)

- **Touches file:** `touches.jsonl` (append-only).
- **Queue:** Only `status === active` **and** `next_action_date` is set **and** `next_action_date <=` today’s **UTC** date (`YYYY-MM-DD`). If `next_action_date` is `null`, the contact is **not** in the queue.
- **Timezone:** Queue uses **UTC** for the calendar day (same as web “Due today” and CLI `queue`).
- **Runtime:** Next.js app + `npm run crm` CLI share `crm-data/`; override with env `CRM_DATA_DIR`.

## Import

- CSV/TSV with headers (`email`, `company`, `first name`, `segments`, `notes`) or headerless table with an email-like column.
- Modes: **`skip`** (default) = skip existing emails; **`upsert`** = fill empty fields on existing, union `segments`.

`contacts.json` and `touches.jsonl` are gitignored (PII). This file is safe to commit.

**Deployment:** This app writes under `crm-data/` on the local filesystem. Use a host with a **persistent disk** (e.g. `next start` on a VPS). Typical **serverless** platforms do not persist arbitrary file writes; switch to blob storage or a database if you deploy there.
