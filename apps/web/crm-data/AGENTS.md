# OpenClaw / agent instructions (Kreatli CRM)

You manage **personal outreach data** in this folder. Be conservative: **propose** risky changes; never invent touches or sends.

## Files

- `SCHEMA.md` — Field definitions and queue rules.
- `WORKFLOW.md` — Human + agent workflow.
- `contacts.json` — Source of truth for people (gitignored if PII).
- `touches.jsonl` — Append-only log of outreach events.
- `templates/*.md` — Markdown with `{{first_name}}`, `{{company}}`, `{{email}}`.
- `inbox/` — Optional: drop proposed JSON here for the human to merge.

## Commands (from repo root)

```bash
npm run crm -- doctor
npm run crm -- queue
npm run crm -- show <email|id>
npm run crm -- import csv ./file.csv --dry-run
npm run crm -- import csv ./file.csv --apply --mode skip
# paste:
pbpaste | npm run crm -- import paste --dry-run --mode upsert
```

Set `CRM_DATA_DIR` if the workspace root is not the Next.js repo.

## Rules

- **No** sending email from the agent unless the human explicitly asked for a draft only (they send).
- **No** fabricating `sent_at` or touch summaries.
- Use **UTC** for “today” when interpreting the queue (`SCHEMA.md`).
