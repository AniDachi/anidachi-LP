# Waitlist And CRM Durable Storage Recovery Design

Status: Approved for implementation on 2026-08-23. Production data changes and
the final `main` promotion remain separate, announced actions after staging
evidence.

## Incident

The production homepage currently reports a zero-person waitlist even though the
legacy public Blob contains 683 contacts, including 682 survey leads. The newer
private snapshot contains 644 contacts, including 643 survey leads, and is a
strict older subset of the public snapshot. Two additional production survey
submissions reached the application after the cutover but were not persisted.

The data was not deleted. Commit `3c3ec2b9` moved Kreatli CRM reads and writes
behind the shared private-integration Blob boundary. Production intentionally
did not receive that shared private-integration configuration. The CRM store then
fell back to `crm-data` on Vercel: reads produced an empty list and writes failed
with a read-only-filesystem error. `/api/subscribe-interest` hid the failed write
and still returned optimistic success.

## Product Contract

- The homepage must show the durable survey-lead count. An unavailable CRM must
  show neutral waitlist copy, never a fabricated zero.
- A waitlist submission is successful only after it is durably stored. The UI
  remains on the form with a retryable error when storage is unavailable.
- Contact messages and feature requests are successful only after their primary
  archive record is durably stored. Optional notification email does not decide
  whether the submission succeeded.
- Existing contacts, touches, contact messages, feature requests, referral data,
  and waitlist positions must survive the repair.
- The two known failed survey submissions are recovered idempotently when their
  payloads remain available in Vercel logs.
- Public request logs do not contain a user's name, email, survey answers,
  contact-message body, or feature-request body.

## Architecture

Use the existing private Blob store and the existing `kreatli-crm/*` object
paths. Do not introduce Supabase tables, a queue, a second CRM, a new service, or
a new Blob store for this MVP repair.

Production and staging receive one CRM-specific server-only credential:

```txt
KREATLI_CRM_BLOB_READ_WRITE_TOKEN
```

An optional OIDC form may use:

```txt
KREATLI_CRM_BLOB_STORE_ID + VERCEL_OIDC_TOKEN
```

The existing shared variables `PRIVATE_INTEGRATION_BLOB_*` remain absent from
production. Therefore this repair does not activate Bloü/OpenClaw, social
publishing credentials, Gmail OAuth, or any other deferred private integration.
The explicit CRM credential is passed to the Blob SDK and takes priority over
ambient Blob variables.

Local development may continue to use `CRM_DATA_DIR`. Any Vercel runtime without
CRM-specific durable configuration fails closed; it must never read or write the
deployment filesystem as an apparent CRM authority.

## Concurrency And Persistence

Every mutable Blob read bypasses CDN cache and retains the returned ETag. Every
runtime read-modify-write uses `put(..., { ifMatch: etag })`. A precondition
failure reloads the latest object, reapplies the idempotent mutation, and retries
within a small fixed bound. Exhausted contention is a retryable storage error,
not last-write-wins data loss.

The canonical contacts object must exist before runtime cutover. A missing
configured contacts object is a configuration/migration failure, not an empty
waitlist. JSONL archives use the same optimistic-update helper. `meta.json` is
operational metadata only; failure to advance its timestamp cannot convert an
already committed contact into a failed user submission.

## Data Reconciliation

The old public objects remain untouched as rollback evidence. A repository
script defaults to dry-run and handles only these CRM data objects:

```txt
kreatli-crm/contacts.json
kreatli-crm/touches.jsonl
kreatli-crm/meta.json
kreatli-crm/contact-messages.jsonl
kreatli-crm/feature-requests.jsonl
```

It intentionally does not migrate or modify `kreatli-crm/gmail-tokens.json`.

The script reads origin-fresh public data, reads origin-fresh private data,
validates the schemas, and builds a lossless union. Contacts are identity-checked
by both UUID and normalized email. JSONL records are identity-checked by `id`.
The same identity with different payloads is a conflict and stops before any
write. Destination writes require its observed ETag, then the script rereads and
verifies byte count, SHA-256, object counts, survey-lead count, and record IDs.
Any source or destination change during the operation aborts safely.

Immediately before apply, live data is inventoried again. The previously
observed 683/682 and 644/643 counts are evidence, not hard-coded migration
inputs. The two missed survey submissions are replayed through the same
idempotent contact mutation after reconciliation and are never printed or saved
to a repository file.

## Deployment Order

1. Implement and verify the code and reconciliation script on a feature branch
   from current `staging`.
2. Add the CRM-specific credential to Preview/staging; existing runtime ignores
   it.
3. Re-run reconciliation dry-run, apply the verified union to the private store,
   and retain the public objects unchanged.
4. Merge the feature PR to `staging` and verify the real count, one new survey
   submission, one contact message, and one feature request across a redeploy.
5. Recover the two known failed submissions idempotently if log retention still
   permits it.
6. Add the same CRM-specific credential to Production before runtime promotion;
   existing production code ignores it.
7. After explicit approval, promote the tested staging runtime to `main`.
8. Verify production count, one controlled idempotent signup, persistence, and
   absence of filesystem/PII errors. Keep the old public Blob as rollback data.

## Rollback

Before `main`, rollback is the feature PR revert plus removal of the unused
CRM-specific environment variable. The reconciled private objects remain a
verified copy and the public objects remain unchanged.

After `main`, roll back to the previous web deployment only if the public-form
outage is preferable to the repaired path. Do not point the repaired runtime at
the old public token and do not delete either snapshot. A forward fix can use
the retained private ETag and the public rollback objects to reconcile again.
