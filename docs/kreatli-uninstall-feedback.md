# Uninstall feedback contacts in the CRM

November 8, 2026: owner-authorized implementation. Deployment status is recorded
in the staging and production release PRs.

`/kreatli-email-crm` → **Uninstall feedback** displays Date, Email, Discord ID,
Reason and Comment. Contacts come from the existing feedback `user_id` link to
`public.users`, so both earlier and future signed-in submissions are covered.
The reader returns current account values, not a new copy stored at submission.
Anonymous responses and responses whose account was deleted retain their reason
and comment, with contact details unavailable. Google-only accounts may have an
email without a Discord ID. The general profile name is not a Discord username;
the inbox labels the stored provider identifier explicitly as **Discord ID**.

Only the server-side CRM session may read this data. Ordinary website login does
not grant CRM access. `/api/kreatli-crm/uninstall-feedback` authenticates before
querying and returns private/no-store, noindex responses. Contacts render as
escaped, selectable text; there is no automatic outreach, export or public feed.
Internal user IDs and anti-abuse hashes remain absent from the response.

Migration `20261108093000_uninstall_feedback_admin_email.sql` adds the
service-role-only `list_uninstall_feedback_v2` reader with the existing 50-row
page plus one lookahead, precise cursor validation and stable ordering. It uses
a left join so missing accounts cannot drop responses or break pagination.
The table permissions and submission/billing flows remain unchanged.

Delivery: feature PR → staging migration → staging web verification → accepted
production promotion. Apply the additive migration before switching the reader.
Rollback may restore the prior web build using v1; leave both readers and all
feedback data in place. No extension, Worker, Stripe, credential or env change
is needed. A prepared source change does not imply it is already deployed.
