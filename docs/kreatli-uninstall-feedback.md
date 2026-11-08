# Uninstall feedback contacts in the CRM

November 8, 2026: owner-authorized implementation. Deployment status is recorded
in the staging and production release PRs.

`/kreatli-email-crm` → **Uninstall feedback** displays Date, Name, Email, Discord ID,
Reason and Comment. Contacts come from the existing feedback `user_id` link to
`public.users`, so both earlier and future signed-in submissions are covered.
The reader returns current account values, not a new copy stored at submission.
Name is the existing `users.display_name`, which can be a full name or nickname.
It is not labeled First Name or split into first/last names. This change does not
collect additional provider data, change login, or add profile fields/tables.
Anonymous responses and responses whose account was deleted retain their reason
and comment, with contact details unavailable. Google-only accounts may have an
email without a Discord ID. The general profile name is not a Discord username;
the inbox labels the stored provider identifier explicitly as **Discord ID**.

Only the server-side CRM session may read this data. Ordinary website login does
not grant CRM access. `/api/kreatli-crm/uninstall-feedback` authenticates before
querying and returns private/no-store, noindex responses. Contacts render as
escaped, selectable text; there is no automatic outreach, export or public feed.
Internal user IDs and anti-abuse hashes remain absent from the response.

Migration `20261108093000_uninstall_feedback_admin_email.sql` added the contact
reader. `20261108150500_uninstall_feedback_admin_name.sql` adds the existing name
through the service-role-only `list_uninstall_feedback_v3` reader with the existing 50-row
page plus one lookahead, precise cursor validation and stable ordering. It uses
a left join so missing accounts cannot drop responses or break pagination.
Name is trimmed, limited to 200 characters for display, and nullable when absent.
The table permissions and submission/billing flows remain unchanged. v1/v2 stay
available; the client also accepts missing names from the older reader.

Delivery: feature PR → staging migration → staging web verification → accepted
production promotion. Apply the additive migration before switching the reader.
Rollback may restore the prior web build using v2; leave the readers and all
feedback data in place. No extension, Worker, Stripe, credential or env change
is needed. A prepared source change does not imply it is already deployed.
