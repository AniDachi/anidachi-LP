"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { GmailUiStatus } from "@/lib/kreatli-crm/gmail-ui";
import { isContactDue } from "@/lib/kreatli-crm/queue";
import type { ImportPreviewLine } from "@/lib/kreatli-crm/import-merge";
import {
  isSurveyLead,
  parseSurveyTags,
  type ParsedSurveyTags,
} from "@/lib/kreatli-crm/survey-lead-shared";
import type { Contact, Touch } from "@/lib/kreatli-crm/types";
import {
  addContactAction,
  applyImportAction,
  deleteContactAction,
  exportCsvDataAction,
  logTouchAction,
  previewImportAction,
  renderTemplateCopyAction,
  updateContactAction,
  type CrmActionState,
} from "./actions";

function groupTouches(touches: Touch[]): Record<string, Touch[]> {
  const m: Record<string, Touch[]> = {};
  for (const t of touches) {
    if (!m[t.contact_id]) m[t.contact_id] = [];
    m[t.contact_id].push(t);
  }
  for (const k of Object.keys(m)) {
    m[k].sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  }
  return m;
}

type CrmTab = "contacts" | "survey_leads";

const SURVEY_FIELD_LABELS: Record<keyof ParsedSurveyTags, string> = {
  segment: "Who",
  priority: "Priority",
  timing: "Timing",
  group_size: "Group size",
  current_solution: "Current tool",
  discovery: "Discovery",
};

function formatSurveyValue(raw: string): string {
  const labels: Record<string, string> = {
    Friend_group_host: "Friend group",
    Long_distance_watch: "Long distance",
    Community_mod: "Community / server",
    sync_and_no_spoilers: "Stay in sync (no spoilers)",
    chat_and_reactions: "Chat + reactions",
    async_progress: "Async progress tracking",
    host_controls: "Host controls",
    today: "Today",
    this_week: "This week",
    planning_ahead: "Planning ahead",
    just_researching: "Just researching",
    "2_3": "2–3 people",
    "4_8": "4–8 people",
    "9_plus": "9+ people",
    discord_screen_share: "Discord screen share",
    teleparty_watch2gether: "Teleparty / Watch2Gether",
    nothing_yet: "Nothing yet",
    another_tool: "Another watch-party tool",
    other: "Other",
    google_search: "Google search",
    reddit: "Reddit",
    discord: "Discord",
    friend: "Friend",
  };
  return labels[raw] ?? raw.replace(/_/g, " ");
}

function SurveyAnswersSummary({ tags }: { tags: ParsedSurveyTags }) {
  const entries = (
    Object.keys(SURVEY_FIELD_LABELS) as (keyof ParsedSurveyTags)[]
  ).flatMap((key) => {
    const value = tags[key];
    if (!value) return [];
    return [{ key, label: SURVEY_FIELD_LABELS[key], value: formatSurveyValue(value) }];
  });

  if (entries.length === 0) {
    return (
      <p className="text-sm text-violet-800/80">
        No survey answers recorded on this contact yet.
      </p>
    );
  }

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(({ key, label, value }) => (
        <div
          key={key}
          className="rounded-md border border-violet-200/80 bg-white/80 px-3 py-2"
        >
          <dt className="text-[11px] font-medium uppercase tracking-wide text-violet-700">
            {label}
          </dt>
          <dd className="text-sm font-medium text-violet-950">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      className="border-purple-300 text-purple-900 hover:bg-purple-100"
      onClick={async () => {
        await fetch("/api/kreatli-crm/logout", { method: "POST" });
        router.push("/kreatli-email-crm/login");
        router.refresh();
      }}
    >
      Log out
    </Button>
  );
}

function useGmailOAuthCallbackUrl(): string {
  const [url, setUrl] = useState(
    "http://localhost:3003/api/kreatli-crm/gmail/callback",
  );
  useEffect(() => {
    setUrl(`${window.location.origin}/api/kreatli-crm/gmail/callback`);
  }, []);
  return url;
}

function useGoogleAdsOAuthCallbackUrl(): string {
  const [url, setUrl] = useState(
    "http://localhost:3003/api/google-ads/oauth/callback",
  );
  useEffect(() => {
    setUrl(`${window.location.origin}/api/google-ads/oauth/callback`);
  }, []);
  return url;
}

function GoogleAdsBanner() {
  const oauthCallbackUrl = useGoogleAdsOAuthCallbackUrl();
  return (
    <section
      className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
      aria-labelledby="google-ads-connect-heading"
    >
      <h2
        id="google-ads-connect-heading"
        className="mb-2 text-base font-semibold text-emerald-950"
      >
        Google Ads (Keyword Planner)
      </h2>
      <p className="mb-3 text-emerald-900">
        Connect once to store a refresh token for Keyword Planner API calls.
        Sign in with the Google account that has access to customer ID{" "}
        <code className="rounded bg-white/80 px-1">572-335-2650</code>.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild className="bg-emerald-700 hover:bg-emerald-800">
          <a href="/api/google-ads/oauth/connect">Connect Google Ads</a>
        </Button>
      </div>
      <p className="mt-3 text-xs text-emerald-900/85">
        Add this redirect URI in Google Cloud (same AniDachi OAuth client) and
        enable scope{" "}
        <code className="rounded bg-white/70 px-1">.../auth/adwords</code> on
        the consent screen:{" "}
        <code className="break-all rounded bg-white/70 px-1 py-0.5">
          {oauthCallbackUrl}
        </code>
      </p>
    </section>
  );
}

function GmailBanner({ status }: { status: GmailUiStatus }) {
  const router = useRouter();
  const oauthCallbackUrl = useGmailOAuthCallbackUrl();
  if (!status.configured) {
    return (
      <section
        className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        aria-labelledby="gmail-banner-heading"
      >
        <h2
          id="gmail-banner-heading"
          className="mb-2 text-base font-semibold text-amber-950"
        >
          Gmail
        </h2>
        <p className="mb-3 text-amber-900">
          The <strong>Connect Gmail</strong> action is hidden until Google OAuth
          env vars are set. Add{" "}
          <code className="rounded bg-white/80 px-1">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="rounded bg-white/80 px-1">GOOGLE_CLIENT_SECRET</code>{" "}
          to <code className="rounded bg-white/80 px-1">.env.local</code>, then{" "}
          <strong>restart</strong>{" "}
          <code className="rounded bg-white/80 px-1">npm run dev</code> and
          reload this page — the blue Connect button will show here.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled
            className="cursor-not-allowed bg-amber-200/80 text-amber-900 opacity-90 hover:bg-amber-200/80"
            title="Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, restart dev server, then reload"
          >
            Connect Gmail
          </Button>
          <span className="text-xs text-amber-800/90">
            Inactive until OAuth credentials are in env.
          </span>
        </div>
        <p className="text-amber-900/90">
          In Google Cloud Console, create OAuth credentials (Web application)
          and add this <strong>authorized redirect URI</strong> (must match
          exactly — this page uses your current origin):
        </p>
        <code className="mt-1 mb-2 block break-all rounded bg-white/80 px-1 py-0.5">
          {oauthCallbackUrl}
        </code>
        <p className="text-amber-900/90">
          Enable the <strong>Gmail API</strong> for the project. Scope used:
          send only.
        </p>
      </section>
    );
  }
  if (!status.connected) {
    return (
      <section
        className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"
        aria-labelledby="gmail-connect-heading"
      >
        <h2
          id="gmail-connect-heading"
          className="mb-2 text-base font-semibold text-blue-950"
        >
          Gmail
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Connect your account to send email to contacts from this page
            (send-only OAuth).
          </span>
          <Button asChild className="bg-blue-700 hover:bg-blue-800">
            <a href="/api/kreatli-crm/gmail/connect">Connect Gmail</a>
          </Button>
        </div>
        <p className="mt-3 text-xs text-blue-900/85">
          Redirect URI in Google Cloud must match:{" "}
          <code className="break-all rounded bg-white/70 px-1 py-0.5">
            {oauthCallbackUrl}
          </code>
        </p>
      </section>
    );
  }
  return (
    <section
      className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-950"
      aria-labelledby="gmail-connected-heading"
    >
      <h2
        id="gmail-connected-heading"
        className="mb-2 text-base font-semibold text-green-950"
      >
        Gmail
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Connected
          {status.email ? (
            <strong className="font-medium"> — {status.email}</strong>
          ) : null}
          .
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-green-600 text-green-900 hover:bg-green-100"
          onClick={async () => {
            await fetch("/api/kreatli-crm/gmail/disconnect", {
              method: "POST",
            });
            router.refresh();
          }}
        >
          Disconnect Gmail
        </Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-green-900/90">
        Recipients see the <strong>From</strong> header Gmail attaches for the
        mailbox used on send — not only what Gmail Settings shows. Open{" "}
        <strong>Show original</strong> on a received message and confirm the
        address matches{" "}
        <strong>{status.email ?? "the connected address above"}</strong>
        {status.fromEmailOverride ? (
          <>
            {" "}
            (or your{" "}
            <code className="rounded bg-white/70 px-1">
              GOOGLE_GMAIL_FROM_EMAIL
            </code>{" "}
            override:{" "}
            <code className="rounded bg-white/70 px-1">
              {status.fromEmailOverride}
            </code>
            )
          </>
        ) : null}
        . If the address differs, fix{" "}
        <code className="rounded bg-white/70 px-1">
          GOOGLE_GMAIL_FROM_EMAIL
        </code>{" "}
        or reconnect so the stored profile matches.
      </p>
      <ul className="mt-2 list-inside list-disc text-xs text-green-900/85">
        <li>
          <code className="rounded bg-white/70 px-1">
            GOOGLE_GMAIL_SENDER_NAME
          </code>{" "}
          on this server:{" "}
          {status.senderDisplayNameEnvSet ? (
            <span className="font-medium text-green-800">set</span>
          ) : (
            <span className="font-medium text-amber-800">
              not set — the API will not sync send-as display name; set it in
              env and restart
            </span>
          )}
        </li>
        {status.fromEmailOverride ? (
          <li>
            Send mailbox override:{" "}
            <code className="rounded bg-white/70 px-1">
              {status.fromEmailOverride}
            </code>{" "}
            — must exist under Gmail → Send mail as.
          </li>
        ) : null}
      </ul>
    </section>
  );
}

export function CrmClient({
  contacts,
  touches,
  templateSlugs,
  gmailStatus,
}: {
  contacts: Contact[];
  touches: Touch[];
  templateSlugs: string[];
  gmailStatus: GmailUiStatus;
}) {
  const byContact = useMemo(() => groupTouches(touches), [touches]);
  const outreachContacts = useMemo(
    () => contacts.filter((c) => !isSurveyLead(c)),
    [contacts],
  );
  const surveyLeads = useMemo(
    () => contacts.filter(isSurveyLead),
    [contacts],
  );
  const due = useMemo(
    () => outreachContacts.filter(isContactDue),
    [outreachContacts],
  );
  const [activeTab, setActiveTab] = useState<CrmTab>("contacts");
  const [segmentFilter, setSegmentFilter] = useState("");

  const activeList =
    activeTab === "survey_leads" ? surveyLeads : outreachContacts;

  const filtered = useMemo(() => {
    const q = segmentFilter.trim().toLowerCase();
    if (!q) return activeList;
    if (activeTab === "survey_leads") {
      return activeList.filter((c) => {
        const tags = parseSurveyTags(c.segments);
        const haystack = [
          c.email,
          c.notes,
          ...Object.values(tags),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    return activeList.filter((c) =>
      c.segments.some((s) => s.toLowerCase().includes(q)),
    );
  }, [activeList, activeTab, segmentFilter]);

  const [addState, addFormAction, addPending] = useActionState(
    addContactAction,
    null as CrmActionState,
  );
  const [applyState, applyFormAction, applyPending] = useActionState(
    applyImportAction,
    null as CrmActionState,
  );
  const router = useRouter();
  const applyFinished = useRef(false);
  useEffect(() => {
    if (applyPending) {
      applyFinished.current = true;
      return;
    }
    if (applyFinished.current) {
      applyFinished.current = false;
      if (applyState === null) router.refresh();
    }
  }, [applyPending, applyState, router]);

  const [gmailFlash, setGmailFlash] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ok = p.get("gmail");
    const err = p.get("gmail_error");
    const googleAdsOk = p.get("google_ads");
    const googleAdsErr = p.get("google_ads_error");
    if (ok === "connected") {
      setGmailFlash("Gmail connected successfully.");
    }
    if (err) {
      setGmailFlash(`Gmail error: ${decodeURIComponent(err)}`);
    }
    if (googleAdsOk === "connected") {
      setGmailFlash(
        "Google Ads connected. Refresh token saved — run pnpm --filter @anidachi/web google-ads:keywords -- \"watch anime with friends\"",
      );
    }
    if (googleAdsErr) {
      setGmailFlash(`Google Ads error: ${decodeURIComponent(googleAdsErr)}`);
    }
    if (ok || err || googleAdsOk || googleAdsErr) {
      router.replace("/kreatli-email-crm", { scroll: false });
    }
  }, [router]);

  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"skip" | "upsert">("skip");
  const [importPreview, setImportPreview] = useState<
    ImportPreviewLine[] | null
  >(null);
  const [importCounts, setImportCounts] = useState<{
    create: number;
    skip: number;
    update: number;
  } | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  async function runPreview() {
    setImportBusy(true);
    setImportPreview(null);
    setImportCounts(null);
    try {
      const fd = new FormData();
      fd.set("import_text", importText);
      fd.set("mode", importMode);
      const r = await previewImportAction(fd);
      if (r.ok) {
        setImportPreview(r.preview);
        setImportCounts(r.counts);
      } else {
        alert(r.error);
      }
    } finally {
      setImportBusy(false);
    }
  }

  async function runExport() {
    const r = await exportCsvDataAction();
    if (!r.ok) {
      alert(r.error);
      return;
    }
    const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-purple-950">
            Kreatli Email CRM
          </h1>
          <p className="text-sm text-purple-800/80">
            Data:{" "}
            <code className="rounded bg-purple-100/80 px-1">crm-data/</code> ·
            CLI:{" "}
            <code className="rounded bg-purple-100/80 px-1">
              npm run crm -- doctor
            </code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="border border-purple-200 bg-white text-purple-900 hover:bg-purple-50"
            onClick={() => runExport()}
          >
            Export CSV
          </Button>
          <LogoutButton />
        </div>
      </div>

      {gmailFlash ? (
        <div
          className="mb-4 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm text-purple-900"
          role="status"
        >
          {gmailFlash}
          <button
            type="button"
            className="ml-3 text-purple-600 underline"
            onClick={() => setGmailFlash(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <GmailBanner status={gmailStatus} />
      <GoogleAdsBanner />

      <div
        className="mb-8 flex flex-wrap gap-1 rounded-xl border border-purple-200/80 bg-purple-50/60 p-1"
        role="tablist"
        aria-label="CRM sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "contacts"}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "contacts"
              ? "bg-white text-purple-950 shadow-sm"
              : "text-purple-800 hover:bg-white/60"
          }`}
          onClick={() => {
            setActiveTab("contacts");
            setSegmentFilter("");
          }}
        >
          Contacts ({outreachContacts.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "survey_leads"}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "survey_leads"
              ? "bg-white text-purple-950 shadow-sm"
              : "text-purple-800 hover:bg-white/60"
          }`}
          onClick={() => {
            setActiveTab("survey_leads");
            setSegmentFilter("");
          }}
        >
          Survey leads ({surveyLeads.length})
        </button>
      </div>

      {activeTab === "contacts" ? (
        <>
      <section className="mb-10 rounded-xl border border-amber-200/80 bg-amber-50/90 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-950">
          Due today (UTC)
        </h2>
        <p className="mb-3 text-sm text-amber-900/80">
          Active contacts with{" "}
          <code className="rounded bg-amber-100 px-1">next_action_date</code> on
          or before today. Null date = not in queue.
        </p>
        {due.length === 0 ? (
          <p className="text-sm text-amber-900/70">
            Nobody due. You are clear.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {due.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-amber-200/60 bg-white/80 px-3 py-2"
              >
                <span className="font-medium text-purple-950">{c.email}</span>
                {c.company ? (
                  <span className="text-purple-800/80"> — {c.company}</span>
                ) : null}
                <span className="text-purple-700">
                  {" "}
                  · next {c.next_action_date}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-emerald-950">
          Import CSV / paste
        </h2>
        <p className="mb-4 text-sm text-emerald-900/85">
          Paste from Sheets or open a{" "}
          <code className="rounded bg-white/80 px-1">.csv</code> file. Headers
          like <strong>email</strong>, <strong>company</strong>,{" "}
          <strong>first name</strong> are auto-mapped. Preview, then apply.
        </p>
        <div className="mb-3">
          <input
            type="file"
            accept=".csv,.txt,.tsv,text/csv"
            className="text-sm text-emerald-950 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-700 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-emerald-800"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => setImportText(String(reader.result ?? ""));
              reader.readAsText(f);
            }}
          />
        </div>
        <form action={applyFormAction} className="space-y-3">
          <textarea
            name="import_text"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder="email,company,first name&#10;a@b.co,Acme,Ada"
            className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 font-mono text-sm text-purple-950 outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <input type="hidden" name="mode" value={importMode} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-emerald-950">
              <span>Merge mode</span>
              <select
                value={importMode}
                onChange={(e) =>
                  setImportMode(e.target.value as "skip" | "upsert")
                }
                className="rounded-md border border-emerald-200 px-2 py-1 text-sm"
              >
                <option value="skip">skip existing emails</option>
                <option value="upsert">
                  upsert (fill empty fields, merge segments)
                </option>
              </select>
            </label>
            <Button
              type="button"
              variant="secondary"
              className="bg-white"
              disabled={importBusy}
              onClick={() => runPreview()}
            >
              {importBusy ? "Preview…" : "Preview import"}
            </Button>
            <Button
              type="submit"
              disabled={applyPending || !importText.trim()}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {applyPending ? "Applying…" : "Apply import"}
            </Button>
          </div>
          {applyState?.error ? (
            <p className="text-sm text-red-600" role="alert">
              {applyState.error}
            </p>
          ) : null}
        </form>
        {importCounts ? (
          <p className="mt-3 text-sm text-emerald-900">
            Preview: +{importCounts.create} new · {importCounts.skip} skip ·{" "}
            {importCounts.update} update
          </p>
        ) : null}
        {importPreview && importPreview.length > 0 ? (
          <div className="mt-3 max-h-48 overflow-auto rounded-md border border-emerald-200 bg-white text-xs">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-emerald-100/90">
                <tr>
                  <th className="p-2">Action</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.slice(0, 200).map((row, i) => (
                  <tr key={i} className="border-t border-emerald-100">
                    <td className="p-2 font-medium">{row.action}</td>
                    <td className="p-2">{row.email}</td>
                    <td className="p-2 text-purple-800">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importPreview.length > 200 ? (
              <p className="p-2 text-purple-600">
                … truncated to 200 rows in preview
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mb-10 rounded-xl border border-purple-200/80 bg-white/90 p-6 shadow-md backdrop-blur">
        <h2 className="mb-4 text-lg font-semibold text-purple-950">
          Add contact
        </h2>
        <form action={addFormAction} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-purple-900">
              Email *
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-purple-900">
              Company
            </label>
            <input
              name="company"
              type="text"
              className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-purple-900">
              First name
            </label>
            <input
              name="first_name"
              type="text"
              className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-purple-900">
              Segments (comma-separated)
            </label>
            <input
              name="segments"
              type="text"
              placeholder="e.g. Austin video, warm intro"
              className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-purple-900">
              Notes
            </label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-purple-900">
              Next action date
            </label>
            <input
              name="next_action_date"
              type="date"
              className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25"
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button
              type="submit"
              disabled={addPending}
              className="bg-purple-700 hover:bg-purple-800"
            >
              {addPending ? "Adding…" : "Add contact"}
            </Button>
          </div>
          {addState?.error ? (
            <p className="text-sm text-red-600 sm:col-span-2" role="alert">
              {addState.error}
            </p>
          ) : null}
        </form>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-purple-950">
            All contacts ({filtered.length}
            {segmentFilter ? ` of ${outreachContacts.length}` : ""})
          </h2>
          <div className="flex max-w-md flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-purple-900">
              Filter by segment (substring)
            </label>
            <input
              type="search"
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              placeholder="e.g. video"
              className="rounded-md border border-purple-200 px-3 py-2 text-sm text-purple-950 outline-none focus:ring-2 focus:ring-purple-500/25"
            />
          </div>
        </div>
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-purple-800/80">
              No contacts match. Clear the filter or import above.
            </p>
          ) : (
            filtered.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                touches={byContact[c.id] ?? []}
                templateSlugs={templateSlugs}
                gmailConnected={gmailStatus.connected}
              />
            ))
          )}
        </div>
      </section>
        </>
      ) : (
        <section>
          <div className="mb-6 rounded-xl border border-violet-200/80 bg-violet-50/80 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-violet-950">Survey leads</h2>
            <p className="mt-1 text-sm text-violet-900/85">
              Emails captured from the homepage plan survey. These are kept separate
              from outreach contacts so manual CRM work stays clean.
            </p>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-lg font-semibold text-violet-950">
              All survey leads ({filtered.length}
              {segmentFilter ? ` of ${surveyLeads.length}` : ""})
            </h2>
            <div className="flex max-w-md flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-violet-900">
                Search email or survey answers
              </label>
              <input
                type="search"
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                placeholder="e.g. planning ahead, long distance"
                className="rounded-md border border-violet-200 px-3 py-2 text-sm text-violet-950 outline-none focus:ring-2 focus:ring-violet-500/25"
              />
            </div>
          </div>

          <div className="space-y-6">
            {filtered.length === 0 ? (
              <p className="text-sm text-violet-800/80">
                No survey leads yet. They appear here when someone saves their plan
                recommendation in the homepage survey.
              </p>
            ) : (
              filtered.map((c) => (
                <SurveyLeadCard
                  key={c.id}
                  contact={c}
                  touches={byContact[c.id] ?? []}
                  templateSlugs={templateSlugs}
                  gmailConnected={gmailStatus.connected}
                />
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function SurveyLeadCard({
  contact: c,
  touches,
  templateSlugs,
  gmailConnected,
}: {
  contact: Contact;
  touches: Touch[];
  templateSlugs: string[];
  gmailConnected: boolean;
}) {
  const surveyTags = useMemo(() => parseSurveyTags(c.segments), [c.segments]);

  return (
    <article className="rounded-xl border border-violet-200/80 bg-white/95 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-violet-950">{c.email}</h3>
          <p className="text-xs text-violet-700">
            Captured {new Date(c.updated_at).toLocaleString()}
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">
          {c.status}
        </span>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-violet-700">
          Survey answers
        </p>
        <SurveyAnswersSummary tags={surveyTags} />
      </div>

      <ContactCard
        contact={c}
        touches={touches}
        templateSlugs={templateSlugs}
        gmailConnected={gmailConnected}
        embedded
      />
    </article>
  );
}

function ContactCard({
  contact: c,
  touches,
  templateSlugs,
  gmailConnected,
  embedded = false,
}: {
  contact: Contact;
  touches: Touch[];
  templateSlugs: string[];
  gmailConnected: boolean;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [updState, updAction, updPending] = useActionState(
    updateContactAction,
    null as CrmActionState,
  );
  const [touchState, touchAction, touchPending] = useActionState(
    logTouchAction,
    null as CrmActionState,
  );
  const [delState, delAction, delPending] = useActionState(
    deleteContactAction,
    null as CrmActionState,
  );
  const [tpl, setTpl] = useState(templateSlugs[0] ?? "");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sendWarn, setSendWarn] = useState<string | null>(null);
  const [sendDevFromMailbox, setSendDevFromMailbox] = useState<string | null>(
    null,
  );
  const [logTouchAfterSend, setLogTouchAfterSend] = useState(true);

  async function copyRendered() {
    setCopyMsg(null);
    if (!tpl) {
      setCopyMsg("Pick a template");
      return;
    }
    const r = await renderTemplateCopyAction(tpl, c.id);
    if (!r.ok) {
      setCopyMsg(r.error);
      return;
    }
    await navigator.clipboard.writeText(r.body);
    setSendBody(r.body);
    setCopyMsg("Copied + loaded into Send body below");
  }

  async function sendGmail() {
    setSendErr(null);
    setSendWarn(null);
    setSendDevFromMailbox(null);
    setSendBusy(true);
    try {
      const r = await fetch("/api/kreatli-crm/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: c.id,
          subject: sendSubject,
          body: sendBody,
          logTouch: logTouchAfterSend,
        }),
      });
      const d = (await r.json().catch(() => ({}))) as {
        error?: string;
        senderNameNote?: string;
        fromMailbox?: string;
      };
      if (!r.ok) throw new Error(d.error || "Send failed");
      setSendSubject("");
      setSendBody("");
      if (d.senderNameNote) {
        setSendWarn(d.senderNameNote);
      }
      if (d.fromMailbox) {
        setSendDevFromMailbox(d.fromMailbox);
      }
      router.refresh();
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSendBusy(false);
    }
  }

  const Wrapper = embedded ? "div" : "article";

  return (
    <Wrapper
      className={
        embedded
          ? "border-t border-violet-100 pt-4"
          : "rounded-xl border border-purple-200/80 bg-white/95 p-5 shadow-sm"
      }
    >
      {!embedded ? (
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-purple-950">{c.email}</h3>
          <p className="text-sm text-purple-800/85">
            {[c.first_name, c.company].filter(Boolean).join(" · ") || "—"}
            {c.segments.length > 0 ? (
              <span className="text-purple-600">
                {" "}
                · {c.segments.join(", ")}
              </span>
            ) : null}
          </p>
        </div>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-900">
          {c.status}
        </span>
      </div>
      ) : null}

      {templateSlugs.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-end gap-2 border-b border-purple-100 pb-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-purple-900">
              Template → clipboard
            </label>
            <select
              value={tpl}
              onChange={(e) => setTpl(e.target.value)}
              className="rounded-md border border-purple-200 px-2 py-1.5 text-sm text-purple-950"
            >
              {templateSlugs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => copyRendered()}
          >
            Copy rendered
          </Button>
          {copyMsg ? (
            <span className="text-xs text-purple-700">{copyMsg}</span>
          ) : null}
        </div>
      ) : null}

      {gmailConnected ? (
        <div className="mb-4 space-y-2 rounded-lg border border-sky-200 bg-sky-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-900">
            Send via Gmail → {c.email}
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-sky-900">
              Subject
            </label>
            <input
              type="text"
              value={sendSubject}
              onChange={(e) => setSendSubject(e.target.value)}
              className="w-full rounded-md border border-sky-200 bg-white px-2 py-1.5 text-sm text-purple-950"
              placeholder="Subject line"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-sky-900">
              Body (plain text)
            </label>
            <textarea
              value={sendBody}
              onChange={(e) => setSendBody(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-sky-200 bg-white px-2 py-1.5 font-mono text-sm text-purple-950"
              placeholder="Email body…"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-sky-900">
            <input
              type="checkbox"
              checked={logTouchAfterSend}
              onChange={(e) => setLogTouchAfterSend(e.target.checked)}
            />
            Log touch after send (&quot;Gmail sent: …&quot;)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-sky-700 hover:bg-sky-800"
              disabled={sendBusy || !sendSubject.trim() || !sendBody.trim()}
              onClick={() => sendGmail()}
            >
              {sendBusy ? "Sending…" : "Send email"}
            </Button>
          </div>
          {sendErr ? (
            <p className="text-sm text-red-600" role="alert">
              {sendErr}
            </p>
          ) : null}
          {sendWarn ? (
            <div
              className="rounded-md border border-amber-400 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950 shadow-sm"
              role="alert"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/90">
                Sender display name
              </p>
              <p className="mt-1">{sendWarn}</p>
            </div>
          ) : null}
          {sendDevFromMailbox ? (
            <div
              className="rounded-md border border-sky-300 bg-white/90 px-3 py-2 text-xs text-sky-950"
              role="status"
            >
              <span className="font-semibold text-sky-900">Dev:</span> this send
              used From mailbox{" "}
              <code className="rounded bg-sky-100 px-1 py-0.5 font-mono">
                {sendDevFromMailbox}
              </code>
              . Compare to the address in <strong>Show original</strong> on the
              received message.
            </div>
          ) : null}
        </div>
      ) : null}

      <form
        action={updAction}
        className="mb-4 grid gap-2 border-t border-purple-100 pt-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={c.id} />
        <div>
          <label className="mb-1 block text-xs font-medium text-purple-900">
            Status
          </label>
          <select
            name="status"
            defaultValue={c.status}
            className="w-full rounded-md border border-purple-200 px-2 py-1.5 text-sm text-purple-950"
          >
            <option value="active">active</option>
            <option value="replied">replied</option>
            <option value="booked">booked</option>
            <option value="closed">closed</option>
            <option value="dnc">dnc</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-purple-900">
            Next action
          </label>
          <input
            name="next_action_date"
            type="date"
            defaultValue={c.next_action_date ?? ""}
            className="w-full rounded-md border border-purple-200 px-2 py-1.5 text-sm text-purple-950"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-purple-900">
            Notes
          </label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={c.notes}
            className="w-full rounded-md border border-purple-200 px-2 py-1.5 text-sm text-purple-950"
          />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={updPending}
            className="bg-purple-700 hover:bg-purple-800"
          >
            {updPending ? "Saving…" : "Save"}
          </Button>
        </div>
        {updState?.error ? (
          <p className="text-sm text-red-600 sm:col-span-2">{updState.error}</p>
        ) : null}
      </form>

      <form
        action={touchAction}
        className="mb-4 flex flex-wrap items-end gap-2 border-t border-purple-100 pt-4"
      >
        <input type="hidden" name="contact_id" value={c.id} />
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-medium text-purple-900">
            Log touch (summary)
          </label>
          <input
            name="summary"
            type="text"
            placeholder="e.g. 1st touch sent — intro Kreatli"
            className="w-full rounded-md border border-purple-200 px-2 py-1.5 text-sm text-purple-950"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={touchPending}
        >
          {touchPending ? "…" : "Log touch"}
        </Button>
        {touchState?.error ? (
          <p className="w-full text-sm text-red-600">{touchState.error}</p>
        ) : null}
      </form>

      {touches.length > 0 ? (
        <div className="mb-4 border-t border-purple-100 pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-purple-700">
            Recent touches
          </p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-purple-900">
            {touches.slice(0, 8).map((t) => (
              <li key={t.id}>
                <span className="text-purple-500">
                  {t.sent_at.slice(0, 10)}
                </span>{" "}
                — {t.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={delAction} className="border-t border-purple-100 pt-3">
        <input type="hidden" name="id" value={c.id} />
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={delPending}
          className="bg-red-600 hover:bg-red-700"
        >
          {delPending ? "…" : "Delete contact"}
        </Button>
        {delState?.error ? (
          <p className="mt-2 text-sm text-red-600">{delState.error}</p>
        ) : null}
      </form>
    </Wrapper>
  );
}
