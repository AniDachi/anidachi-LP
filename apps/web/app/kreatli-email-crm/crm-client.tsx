"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { GmailUiStatus } from "@/lib/kreatli-crm/gmail-ui";
import { isContactDue } from "@/lib/kreatli-crm/queue";
import type { ImportPreviewLine } from "@/lib/kreatli-crm/import-merge";
import {
  formatSurveyValue,
  isHighIntentTiming,
  isSurveyLead,
  parseSurveyTags,
  recommendedPlanLabelForTags,
  SURVEY_FIELD_LABELS,
  surveyLeadsToDelimited,
  type ParsedSurveyTags,
} from "@/lib/kreatli-crm/survey-lead-shared";
import type { Contact, Touch } from "@/lib/kreatli-crm/types";
import {
  addContactAction,
  applyImportAction,
  deleteContactAction,
  exportCsvDataAction,
  exportSurveyLeadsCsvAction,
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

type SurveyDateRange = "all" | "7" | "30";

type SurveyFilters = {
  timing: string;
  segment: string;
  priority: string;
  dateRange: SurveyDateRange;
};

type SurveySortKey =
  | "updated_at"
  | "email"
  | "segment"
  | "priority"
  | "timing"
  | "status";

const DEFAULT_SURVEY_FILTERS: SurveyFilters = {
  timing: "",
  segment: "",
  priority: "",
  dateRange: "all",
};

function passesSurveyDateRange(
  updatedAt: string,
  range: SurveyDateRange,
): boolean {
  if (range === "all") return true;
  const days = range === "7" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(updatedAt) >= cutoff;
}

function contactStatusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-brand-orange/15 text-brand-orange";
    case "replied":
      return "bg-blue-500/15 text-blue-400";
    case "booked":
      return "bg-brand-orange/20 text-brand-orange-bright";
    case "closed":
      return "bg-brand-surface text-foreground/60";
    case "dnc":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-brand-surface text-foreground/70";
  }
}

function surveyRowUrgencyClass(timing?: string): string {
  if (timing === "today") return "border-l-4 border-l-red-500";
  if (timing === "this_week") return "border-l-4 border-l-amber-500";
  return "border-l-4 border-l-transparent";
}

function formatCapturedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
      <p className="text-sm text-foreground/60">
        No survey answers recorded on this contact yet.
      </p>
    );
  }

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(({ key, label, value }) => (
        <div
          key={key}
          className="rounded-md border border-brand-border bg-brand-surface px-3 py-2"
        >
          <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-orange/80">
            {label}
          </dt>
          <dd className="text-sm font-medium text-foreground">{value}</dd>
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
      className="border-brand-border text-foreground/80 hover:bg-brand-orange/10 hover:text-brand-orange"
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
      className="mb-6 rounded-lg border border-brand-orange/30 bg-brand-orange/10 p-4 text-sm text-foreground"
      aria-labelledby="google-ads-connect-heading"
    >
      <h2
        id="google-ads-connect-heading"
        className="mb-2 text-base font-semibold text-foreground"
      >
        Google Ads (Keyword Planner)
      </h2>
      <p className="mb-3 text-foreground/80">
        Connect once to store a refresh token for Keyword Planner API calls.
        Sign in with the Google account that has access to customer ID{" "}
        <code className="rounded bg-brand-surface px-1">572-335-2650</code>.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild className="bg-brand-orange hover:bg-brand-orange-deep">
          <a href="/api/google-ads/oauth/connect">Connect Google Ads</a>
        </Button>
      </div>
      <p className="mt-3 text-xs text-foreground/70">
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
        className="mb-6 rounded-lg border border-brand-orange/40 bg-brand-orange/10 p-4 text-sm text-foreground"
        aria-labelledby="gmail-banner-heading"
      >
        <h2
          id="gmail-banner-heading"
          className="mb-2 text-base font-semibold text-foreground"
        >
          Gmail
        </h2>
        <p className="mb-3 text-foreground/80">
          The <strong>Connect Gmail</strong> action is hidden until Google OAuth
          env vars are set. Add{" "}
          <code className="rounded bg-brand-surface px-1">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="rounded bg-brand-surface px-1">GOOGLE_CLIENT_SECRET</code>{" "}
          to <code className="rounded bg-brand-surface px-1">.env.local</code>, then{" "}
          <strong>restart</strong>{" "}
          <code className="rounded bg-brand-surface px-1">npm run dev</code> and
          reload this page — the blue Connect button will show here.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled
            className="cursor-not-allowed bg-brand-orange/20 text-foreground/80 opacity-90 hover:bg-brand-orange/20"
            title="Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, restart dev server, then reload"
          >
            Connect Gmail
          </Button>
          <span className="text-xs text-foreground/60">
            Inactive until OAuth credentials are in env.
          </span>
        </div>
        <p className="text-foreground/70">
          In Google Cloud Console, create OAuth credentials (Web application)
          and add this <strong>authorized redirect URI</strong> (must match
          exactly — this page uses your current origin):
        </p>
        <code className="mt-1 mb-2 block break-all rounded bg-brand-surface px-1 py-0.5">
          {oauthCallbackUrl}
        </code>
        <p className="text-foreground/70">
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
      className="mb-6 rounded-lg border border-brand-orange/30 bg-brand-orange/10 p-4 text-sm text-foreground"
      aria-labelledby="gmail-connected-heading"
    >
      <h2
        id="gmail-connected-heading"
        className="mb-2 text-base font-semibold text-foreground"
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
          className="border-brand-orange text-foreground/80 hover:bg-brand-orange/15"
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
      <p className="mt-3 text-xs leading-relaxed text-foreground/70">
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
      <ul className="mt-2 list-inside list-disc text-xs text-foreground/60">
        <li>
          <code className="rounded bg-white/70 px-1">
            GOOGLE_GMAIL_SENDER_NAME
          </code>{" "}
          on this server:{" "}
          {status.senderDisplayNameEnvSet ? (
            <span className="font-medium text-brand-orange">set</span>
          ) : (
            <span className="font-medium text-brand-orange">
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
  const [surveyFilters, setSurveyFilters] =
    useState<SurveyFilters>(DEFAULT_SURVEY_FILTERS);
  const [surveySortKey, setSurveySortKey] =
    useState<SurveySortKey>("updated_at");
  const [surveySortDir, setSurveySortDir] = useState<"asc" | "desc">("desc");
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [copyTsvMsg, setCopyTsvMsg] = useState<string | null>(null);

  const surveyStats = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let thisWeek = 0;
    let highIntent = 0;
    for (const c of surveyLeads) {
      const tags = parseSurveyTags(c.segments);
      if (now - new Date(c.updated_at).getTime() <= weekMs) thisWeek++;
      if (isHighIntentTiming(tags.timing)) highIntent++;
    }
    return { total: surveyLeads.length, thisWeek, highIntent };
  }, [surveyLeads]);

  const activeList =
    activeTab === "survey_leads" ? surveyLeads : outreachContacts;

  const filtered = useMemo(() => {
    if (activeTab === "survey_leads") {
      const q = segmentFilter.trim().toLowerCase();
      return surveyLeads.filter((c) => {
        const tags = parseSurveyTags(c.segments);
        if (surveyFilters.timing && tags.timing !== surveyFilters.timing) {
          return false;
        }
        if (surveyFilters.segment && tags.segment !== surveyFilters.segment) {
          return false;
        }
        if (
          surveyFilters.priority &&
          tags.priority !== surveyFilters.priority
        ) {
          return false;
        }
        if (
          !passesSurveyDateRange(c.updated_at, surveyFilters.dateRange)
        ) {
          return false;
        }
        if (!q) return true;
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
    const q = segmentFilter.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter((c) =>
      c.segments.some((s) => s.toLowerCase().includes(q)),
    );
  }, [activeList, activeTab, segmentFilter, surveyFilters, surveyLeads]);

  const sortedSurveyLeads = useMemo(() => {
    const list = [...filtered];
    const dir = surveySortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const tagsA = parseSurveyTags(a.segments);
      const tagsB = parseSurveyTags(b.segments);
      let cmp = 0;
      switch (surveySortKey) {
        case "updated_at":
          cmp = a.updated_at.localeCompare(b.updated_at);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "segment":
          cmp = (tagsA.segment ?? "").localeCompare(tagsB.segment ?? "");
          break;
        case "priority":
          cmp = (tagsA.priority ?? "").localeCompare(tagsB.priority ?? "");
          break;
        case "timing":
          cmp = (tagsA.timing ?? "").localeCompare(tagsB.timing ?? "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return cmp * dir;
    });
    return list;
  }, [filtered, surveySortDir, surveySortKey]);

  function toggleSurveySort(key: SurveySortKey) {
    if (surveySortKey === key) {
      setSurveySortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSurveySortKey(key);
    setSurveySortDir(key === "updated_at" ? "desc" : "asc");
  }

  function resetSurveyTabState() {
    setSegmentFilter("");
    setSurveyFilters(DEFAULT_SURVEY_FILTERS);
    setExpandedLeadId(null);
    setCopyTsvMsg(null);
  }

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

  const surveyFilterOptions = useMemo(() => {
    const timing = new Set<string>();
    const segment = new Set<string>();
    const priority = new Set<string>();
    for (const c of surveyLeads) {
      const tags = parseSurveyTags(c.segments);
      if (tags.timing) timing.add(tags.timing);
      if (tags.segment) segment.add(tags.segment);
      if (tags.priority) priority.add(tags.priority);
    }
    return {
      timing: [...timing].sort(),
      segment: [...segment].sort(),
      priority: [...priority].sort(),
    };
  }, [surveyLeads]);

  async function runExportSurveyLeads() {
    const r = await exportSurveyLeadsCsvAction();
    if (!r.ok) {
      alert(r.error);
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-leads-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyFilteredSurveyLeadsTsv() {
    setCopyTsvMsg(null);
    try {
      const tsv = surveyLeadsToDelimited(sortedSurveyLeads, "\t");
      await navigator.clipboard.writeText(tsv);
      setCopyTsvMsg(`Copied ${sortedSurveyLeads.length} leads as TSV`);
    } catch {
      setCopyTsvMsg("Copy failed — check clipboard permissions");
    }
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Kreatli Email CRM
          </h1>
          {activeTab === "contacts" ? (
            <p className="text-sm text-brand-orange/80">
              Data:{" "}
              <code className="rounded bg-brand-orange/15 px-1">crm-data/</code> ·
              CLI:{" "}
              <code className="rounded bg-brand-orange/15 px-1">
                npm run crm -- doctor
              </code>
            </p>
          ) : (
            <p className="text-sm text-foreground/70">
              Homepage plan survey leads — review, filter, and export.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === "contacts" ? (
            <Button
              type="button"
              variant="secondary"
              className="border border-brand-orange/30 bg-background text-foreground/80 hover:bg-brand-orange/20"
              onClick={() => runExport()}
            >
              Export CSV
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                className="border border-brand-border bg-background text-foreground/80 hover:bg-brand-surface"
                onClick={() => router.refresh()}
              >
                Refresh
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="border border-brand-border bg-background text-foreground/80 hover:bg-brand-surface"
                onClick={() => copyFilteredSurveyLeadsTsv()}
              >
                Copy as TSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="border border-brand-border bg-background text-foreground/80 hover:bg-brand-surface"
                onClick={() => runExportSurveyLeads()}
              >
                Export survey leads
              </Button>
            </>
          )}
          <LogoutButton />
        </div>
      </div>

      {gmailFlash ? (
        <div
          className="mb-4 rounded-lg border border-brand-orange/30 bg-brand-orange/10 px-4 py-2 text-sm text-foreground/80"
          role="status"
        >
          {gmailFlash}
          <button
            type="button"
            className="ml-3 text-brand-orange underline"
            onClick={() => setGmailFlash(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {activeTab === "contacts" ? (
        <>
          <GmailBanner status={gmailStatus} />
          <GoogleAdsBanner />
        </>
      ) : null}

      <div
        className="mb-8 flex flex-wrap gap-1 rounded-xl border border-brand-border bg-brand-surface p-1"
        role="tablist"
        aria-label="CRM sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "contacts"}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "contacts"
              ? "bg-brand-orange text-primary-foreground shadow-sm"
              : "text-foreground/60 hover:bg-brand-orange/10"
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
              ? "bg-brand-orange text-primary-foreground shadow-sm"
              : "text-foreground/60 hover:bg-brand-orange/10"
          }`}
          onClick={() => {
            setActiveTab("survey_leads");
            resetSurveyTabState();
          }}
        >
          Survey leads ({surveyLeads.length})
        </button>
      </div>

      {activeTab === "contacts" ? (
        <>
      <section className="mb-10 rounded-xl border border-brand-orange/30 bg-brand-orange/10 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          Due today (UTC)
        </h2>
        <p className="mb-3 text-sm text-foreground/70">
          Active contacts with{" "}
          <code className="rounded bg-brand-orange/15 px-1">next_action_date</code> on
          or before today. Null date = not in queue.
        </p>
        {due.length === 0 ? (
          <p className="text-sm text-foreground/60">
            Nobody due. You are clear.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {due.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-brand-border bg-brand-surface px-3 py-2"
              >
                <span className="font-medium text-foreground">{c.email}</span>
                {c.company ? (
                  <span className="text-brand-orange/80"> — {c.company}</span>
                ) : null}
                <span className="text-brand-orange">
                  {" "}
                  · next {c.next_action_date}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-xl border border-brand-orange/30 bg-brand-orange/10 p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          Import CSV / paste
        </h2>
        <p className="mb-4 text-sm text-foreground/70">
          Paste from Sheets or open a{" "}
          <code className="rounded bg-brand-surface px-1">.csv</code> file. Headers
          like <strong>email</strong>, <strong>company</strong>,{" "}
          <strong>first name</strong> are auto-mapped. Preview, then apply.
        </p>
        <div className="mb-3">
          <input
            type="file"
            accept=".csv,.txt,.tsv,text/csv"
            className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand-orange file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-brand-orange-deep"
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
            className="w-full rounded-md border border-brand-orange/30 bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-brand-orange/20"
          />
          <input type="hidden" name="mode" value={importMode} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <span>Merge mode</span>
              <select
                value={importMode}
                onChange={(e) =>
                  setImportMode(e.target.value as "skip" | "upsert")
                }
                className="rounded-md border border-brand-orange/30 px-2 py-1 text-sm"
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
              className="bg-background"
              disabled={importBusy}
              onClick={() => runPreview()}
            >
              {importBusy ? "Preview…" : "Preview import"}
            </Button>
            <Button
              type="submit"
              disabled={applyPending || !importText.trim()}
              className="bg-brand-orange hover:bg-brand-orange-deep"
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
          <p className="mt-3 text-sm text-foreground/80">
            Preview: +{importCounts.create} new · {importCounts.skip} skip ·{" "}
            {importCounts.update} update
          </p>
        ) : null}
        {importPreview && importPreview.length > 0 ? (
          <div className="mt-3 max-h-48 overflow-auto rounded-md border border-brand-orange/30 bg-background text-xs">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-brand-surface">
                <tr>
                  <th className="p-2">Action</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.slice(0, 200).map((row, i) => (
                  <tr key={i} className="border-t border-brand-border">
                    <td className="p-2 font-medium">{row.action}</td>
                    <td className="p-2">{row.email}</td>
                    <td className="p-2 text-brand-orange">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importPreview.length > 200 ? (
              <p className="p-2 text-brand-orange">
                … truncated to 200 rows in preview
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mb-10 rounded-xl border border-brand-orange/30/80 bg-brand-surface p-6 shadow-md backdrop-blur">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Add contact
        </h2>
        <form action={addFormAction} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground/80">
              Email *
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-brand-orange/30 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/80">
              Company
            </label>
            <input
              name="company"
              type="text"
              className="w-full rounded-md border border-brand-orange/30 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/80">
              First name
            </label>
            <input
              name="first_name"
              type="text"
              className="w-full rounded-md border border-brand-orange/30 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground/80">
              Segments (comma-separated)
            </label>
            <input
              name="segments"
              type="text"
              placeholder="e.g. Austin video, warm intro"
              className="w-full rounded-md border border-brand-orange/30 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground/80">
              Notes
            </label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-md border border-brand-orange/30 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/80">
              Next action date
            </label>
            <input
              name="next_action_date"
              type="date"
              className="w-full rounded-md border border-brand-orange/30 px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button
              type="submit"
              disabled={addPending}
              className="bg-brand-orange hover:bg-brand-orange-deep"
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
          <h2 className="text-lg font-semibold text-foreground">
            All contacts ({filtered.length}
            {segmentFilter ? ` of ${outreachContacts.length}` : ""})
          </h2>
          <div className="flex max-w-md flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-foreground/80">
              Filter by segment (substring)
            </label>
            <input
              type="search"
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              placeholder="e.g. video"
              className="rounded-md border border-brand-orange/30 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand-orange/20"
            />
          </div>
        </div>
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-brand-orange/80">
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
        <section aria-labelledby="survey-leads-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                id="survey-leads-heading"
                className="text-lg font-semibold text-foreground"
              >
                Survey leads ({sortedSurveyLeads.length}
                {sortedSurveyLeads.length !== surveyLeads.length
                  ? ` of ${surveyLeads.length}`
                  : ""}
                )
              </h2>
              <p className="mt-1 text-sm text-foreground/70">
                Homepage plan survey captures — kept separate from outreach
                contacts.
              </p>
            </div>
            {copyTsvMsg ? (
              <p className="text-xs text-brand-orange/80" role="status">
                {copyTsvMsg}
              </p>
            ) : null}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-brand-orange/15 px-3 py-1 text-xs font-medium text-foreground/80">
              {surveyStats.total} total
            </span>
            <span className="rounded-full bg-brand-orange/15 px-3 py-1 text-xs font-medium text-foreground/80">
              {surveyStats.thisWeek} this week
            </span>
            <span className="rounded-full bg-brand-orange/20 px-3 py-1 text-xs font-medium text-brand-orange">
              {surveyStats.highIntent} high intent
            </span>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Search email or survey answers
              </label>
              <input
                type="search"
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                placeholder="e.g. planning ahead, long distance"
                className="w-full rounded-md border border-brand-border px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand-orange/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Timing
              </label>
              <select
                value={surveyFilters.timing}
                onChange={(e) =>
                  setSurveyFilters((f) => ({ ...f, timing: e.target.value }))
                }
                className="w-full rounded-md border border-brand-border px-2 py-2 text-sm text-foreground"
              >
                <option value="">All</option>
                {surveyFilterOptions.timing.map((v) => (
                  <option key={v} value={v}>
                    {formatSurveyValue(v)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Who
              </label>
              <select
                value={surveyFilters.segment}
                onChange={(e) =>
                  setSurveyFilters((f) => ({ ...f, segment: e.target.value }))
                }
                className="w-full rounded-md border border-brand-border px-2 py-2 text-sm text-foreground"
              >
                <option value="">All</option>
                {surveyFilterOptions.segment.map((v) => (
                  <option key={v} value={v}>
                    {formatSurveyValue(v)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Priority
              </label>
              <select
                value={surveyFilters.priority}
                onChange={(e) =>
                  setSurveyFilters((f) => ({ ...f, priority: e.target.value }))
                }
                className="w-full rounded-md border border-brand-border px-2 py-2 text-sm text-foreground"
              >
                <option value="">All</option>
                {surveyFilterOptions.priority.map((v) => (
                  <option key={v} value={v}>
                    {formatSurveyValue(v)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-xs font-medium text-foreground/80">
                Captured
              </label>
              <select
                value={surveyFilters.dateRange}
                onChange={(e) =>
                  setSurveyFilters((f) => ({
                    ...f,
                    dateRange: e.target.value as SurveyDateRange,
                  }))
                }
                className="w-full rounded-md border border-brand-border px-2 py-2 text-sm text-foreground"
              >
                <option value="all">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>
          </div>

          <p
            className="mb-3 text-xs text-foreground/60"
            aria-live="polite"
          >
            Showing {sortedSurveyLeads.length} lead
            {sortedSurveyLeads.length === 1 ? "" : "s"}
          </p>

          {sortedSurveyLeads.length === 0 ? (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-6 text-sm text-foreground/60">
              {surveyLeads.length === 0 ? (
                <>
                  No survey leads yet. They appear here when someone saves their
                  plan in the homepage survey.{" "}
                  <Link
                    href="/#pick-a-plan"
                    className="font-medium text-brand-orange/80 underline hover:text-foreground/80"
                  >
                    Test the survey
                  </Link>
                </>
              ) : (
                "No leads match your filters. Clear search or filters to see all leads."
              )}
            </div>
          ) : (
            <SurveyLeadsTable
              leads={sortedSurveyLeads}
              expandedLeadId={expandedLeadId}
              onToggleExpand={(id) =>
                setExpandedLeadId((cur) => (cur === id ? null : id))
              }
              sortKey={surveySortKey}
              sortDir={surveySortDir}
              onSort={toggleSurveySort}
              byContact={byContact}
              templateSlugs={templateSlugs}
              gmailConnected={gmailStatus.connected}
            />
          )}
        </section>
      )}
    </main>
  );
}

function SurveySortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className = "",
}: {
  label: string;
  column: SurveySortKey;
  sortKey: SurveySortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SurveySortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  return (
    <th className={`p-2 text-left ${className}`} scope="col">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-foreground/60 hover:text-foreground"
        onClick={() => onSort(column)}
      >
        {label}
        {active ? (
          <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span>
        ) : null}
      </button>
    </th>
  );
}

function SurveyLeadsTable({
  leads,
  expandedLeadId,
  onToggleExpand,
  sortKey,
  sortDir,
  onSort,
  byContact,
  templateSlugs,
  gmailConnected,
}: {
  leads: Contact[];
  expandedLeadId: string | null;
  onToggleExpand: (id: string) => void;
  sortKey: SurveySortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SurveySortKey) => void;
  byContact: Record<string, Touch[]>;
  templateSlugs: string[];
  gmailConnected: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface shadow-sm">
      <table className="min-w-[960px] w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-brand-surface backdrop-blur">
          <tr className="border-b border-brand-border">
            <th className="sticky left-0 z-20 bg-brand-surface p-2 text-xs font-semibold uppercase tracking-wide text-foreground/60 backdrop-blur">
              <span className="sr-only">Expand</span>
            </th>
            <SurveySortHeader
              label="Email"
              column="email"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className="sticky left-8 z-20 min-w-[200px] bg-brand-surface backdrop-blur"
            />
            <SurveySortHeader
              label="Captured"
              column="updated_at"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th
              className="p-2 text-xs font-semibold uppercase tracking-wide text-foreground/60"
              scope="col"
            >
              Plan
            </th>
            <SurveySortHeader
              label="Who"
              column="segment"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SurveySortHeader
              label="Priority"
              column="priority"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SurveySortHeader
              label="Timing"
              column="timing"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th
              className="p-2 text-xs font-semibold uppercase tracking-wide text-foreground/60"
              scope="col"
            >
              Group
            </th>
            <th
              className="p-2 text-xs font-semibold uppercase tracking-wide text-foreground/60"
              scope="col"
            >
              Tool
            </th>
            <th
              className="p-2 text-xs font-semibold uppercase tracking-wide text-foreground/60"
              scope="col"
            >
              Discovery
            </th>
            <SurveySortHeader
              label="Status"
              column="status"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
          </tr>
        </thead>
        <tbody>
          {leads.map((c) => {
            const tags = parseSurveyTags(c.segments);
            const expanded = expandedLeadId === c.id;
            const planLabel = recommendedPlanLabelForTags(tags);
            const isHostTier = planLabel === "Pro";
            return (
              <SurveyLeadTableRow
                key={c.id}
                contact={c}
                tags={tags}
                expanded={expanded}
                onToggleExpand={() => onToggleExpand(c.id)}
                planLabel={planLabel}
                isHostTier={isHostTier}
                touches={byContact[c.id] ?? []}
                templateSlugs={templateSlugs}
                gmailConnected={gmailConnected}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SurveyLeadTableRow({
  contact: c,
  tags,
  expanded,
  onToggleExpand,
  planLabel,
  isHostTier,
  touches,
  templateSlugs,
  gmailConnected,
}: {
  contact: Contact;
  tags: ParsedSurveyTags;
  expanded: boolean;
  onToggleExpand: () => void;
  planLabel: string;
  isHostTier: boolean;
  touches: Touch[];
  templateSlugs: string[];
  gmailConnected: boolean;
}) {
  const urgency = surveyRowUrgencyClass(tags.timing);
  const rowBg = expanded ? "bg-brand-orange/5" : "bg-background";

  return (
    <>
      <tr
        className={`border-b border-brand-border ${urgency} ${rowBg} hover:bg-brand-surface/80`}
      >
        <td className={`sticky left-0 z-[1] p-2 ${rowBg}`}>
          <button
            type="button"
            className="rounded p-1 text-brand-orange/80 hover:bg-brand-orange/15"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse lead details" : "Expand lead details"}
            onClick={onToggleExpand}
          >
            {expanded ? "▼" : "▶"}
          </button>
        </td>
        <td
          className={`sticky left-8 z-[1] min-w-[200px] p-2 font-medium text-foreground ${rowBg}`}
        >
          <button
            type="button"
            className="text-left hover:underline"
            onClick={onToggleExpand}
          >
            {c.email}
          </button>
        </td>
        <td className="whitespace-nowrap p-2 text-foreground/60">
          {formatCapturedAt(c.updated_at)}
        </td>
        <td className="p-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              isHostTier
                ? "bg-indigo-100 text-indigo-900"
                : "bg-sky-100 text-sky-900"
            }`}
          >
            {planLabel}
          </span>
        </td>
        <td className="p-2 text-foreground/80">
          {tags.segment ? formatSurveyValue(tags.segment) : "—"}
        </td>
        <td className="p-2 text-foreground/80">
          {tags.priority ? formatSurveyValue(tags.priority) : "—"}
        </td>
        <td className="p-2">
          {tags.timing ? (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                isHighIntentTiming(tags.timing)
                  ? "bg-brand-orange/15 text-foreground"
                  : "bg-brand-orange/15 text-foreground/80"
              }`}
            >
              {formatSurveyValue(tags.timing)}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="p-2 text-foreground/80">
          {tags.group_size ? formatSurveyValue(tags.group_size) : "—"}
        </td>
        <td className="p-2 text-foreground/80">
          {tags.current_solution
            ? formatSurveyValue(tags.current_solution)
            : "—"}
        </td>
        <td className="p-2 text-foreground/80">
          {tags.discovery ? formatSurveyValue(tags.discovery) : "—"}
        </td>
        <td className="p-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${contactStatusBadgeClass(c.status)}`}
          >
            {c.status}
          </span>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-brand-border bg-brand-surface/80">
          <td colSpan={11} className="p-4">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-orange/80">
                  Survey answers
                </p>
                <SurveyAnswersSummary tags={tags} />
              </div>
              {c.notes.trim() ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-orange/80">
                    Notes snapshot
                  </p>
                  <pre className="max-h-40 overflow-auto rounded-md border border-brand-border bg-brand-surface p-3 text-xs whitespace-pre-wrap text-foreground">
                    {c.notes}
                  </pre>
                </div>
              ) : null}
              <details className="rounded-lg border border-brand-border bg-brand-surface">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-foreground/80">
                  Outreach tools (optional)
                </summary>
                <div className="px-4 pb-4">
                  <ContactCard
                    contact={c}
                    touches={touches}
                    templateSlugs={templateSlugs}
                    gmailConnected={gmailConnected}
                    embedded
                  />
                </div>
              </details>
            </div>
          </td>
        </tr>
      ) : null}
    </>
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
          ? "border-t border-brand-border pt-4"
          : "rounded-xl border border-brand-orange/30/80 bg-brand-surface p-5 shadow-sm"
      }
    >
      {!embedded ? (
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">{c.email}</h3>
          <p className="text-sm text-brand-orange/85">
            {[c.first_name, c.company].filter(Boolean).join(" · ") || "—"}
            {c.segments.length > 0 ? (
              <span className="text-brand-orange">
                {" "}
                · {c.segments.join(", ")}
              </span>
            ) : null}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${contactStatusBadgeClass(c.status)}`}
        >
          {c.status}
        </span>
      </div>
      ) : null}

      {templateSlugs.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-end gap-2 border-b border-brand-border pb-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/80">
              Template → clipboard
            </label>
            <select
              value={tpl}
              onChange={(e) => setTpl(e.target.value)}
              className="rounded-md border border-brand-orange/30 px-2 py-1.5 text-sm text-foreground"
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
            <span className="text-xs text-brand-orange">{copyMsg}</span>
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
              className="w-full rounded-md border border-sky-200 bg-background px-2 py-1.5 text-sm text-foreground"
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
              className="w-full rounded-md border border-sky-200 bg-background px-2 py-1.5 font-mono text-sm text-foreground"
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
              className="rounded-md border border-brand-orange/50 bg-brand-orange/15 px-3 py-2 text-sm font-medium text-foreground shadow-sm"
              role="alert"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                Sender display name
              </p>
              <p className="mt-1">{sendWarn}</p>
            </div>
          ) : null}
          {sendDevFromMailbox ? (
            <div
              className="rounded-md border border-sky-300 bg-brand-surface px-3 py-2 text-xs text-sky-950"
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
        className="mb-4 grid gap-2 border-t border-brand-border pt-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={c.id} />
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/80">
            Status
          </label>
          <select
            name="status"
            defaultValue={c.status}
            className="w-full rounded-md border border-brand-orange/30 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="active">active</option>
            <option value="replied">replied</option>
            <option value="booked">booked</option>
            <option value="closed">closed</option>
            <option value="dnc">dnc</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/80">
            Next action
          </label>
          <input
            name="next_action_date"
            type="date"
            defaultValue={c.next_action_date ?? ""}
            className="w-full rounded-md border border-brand-orange/30 px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground/80">
            Notes
          </label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={c.notes}
            className="w-full rounded-md border border-brand-orange/30 px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={updPending}
            className="bg-brand-orange hover:bg-brand-orange-deep"
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
        className="mb-4 flex flex-wrap items-end gap-2 border-t border-brand-border pt-4"
      >
        <input type="hidden" name="contact_id" value={c.id} />
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-medium text-foreground/80">
            Log touch (summary)
          </label>
          <input
            name="summary"
            type="text"
            placeholder="e.g. 1st touch sent — intro Kreatli"
            className="w-full rounded-md border border-brand-orange/30 px-2 py-1.5 text-sm text-foreground"
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
        <div className="mb-4 border-t border-brand-border pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-orange">
            Recent touches
          </p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-foreground/80">
            {touches.slice(0, 8).map((t) => (
              <li key={t.id}>
                <span className="text-brand-orange">
                  {t.sent_at.slice(0, 10)}
                </span>{" "}
                — {t.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={delAction} className="border-t border-brand-border pt-3">
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
