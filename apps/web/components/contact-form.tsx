"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  CONTACT_CATEGORIES,
  type ContactCategory,
} from "@/lib/kreatli-crm/contact-message-shared";

const CATEGORY_LABELS: Record<ContactCategory, string> = {
  support: "Product support",
  privacy: "Privacy request",
  security: "Security report",
  press: "Press / partnerships",
  corrections: "Content correction",
  other: "Other",
};

const BUG_REPORT_SUBJECT_PREFIX = "[Bug report] ";

export function ContactForm({
  variant = "public",
  initialContact,
}: {
  variant?: "public" | "bug-report";
  initialContact?: { name: string; email: string };
}) {
  const isBugReport = variant === "bug-report";
  const [name, setName] = useState(initialContact?.name ?? "");
  const [email, setEmail] = useState(initialContact?.email ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<ContactCategory>("support");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    if (isBugReport && !subject.trim()) {
      setError("Add a short title for the problem.");
      return;
    }
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject: isBugReport
            ? `${BUG_REPORT_SUBJECT_PREFIX}${subject.trim()}`
            : subject,
          message,
          category: isBugReport ? "support" : category,
          company_website: honeypot,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setStatus("error");
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStatus("success");
      if (!isBugReport) {
        setName("");
        setEmail("");
      }
      setSubject("");
      setMessage("");
      setCategory("support");
      setHoneypot("");
    } catch {
      setStatus("error");
      setError("Network error. Check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        className={
          isBugReport
            ? "ac-empty ac-form-success"
            : "rounded-2xl border border-brand-border/80 bg-brand-surface px-6 py-8 text-center"
        }
        role="status"
      >
        <p className="text-lg font-semibold tracking-[-0.01em] text-foreground">
          {isBugReport ? "Bug report sent" : "Message sent"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/65">
          {isBugReport
            ? "Thanks for helping us improve AniDachi. We will reply to your email if we need more details."
            : "We typically reply within a few business days. Urgent billing issues — put “Billing” in the subject next time."}
        </p>
        <Button
          type="button"
          variant="ghost"
          className={
            isBugReport ? "ac-button mt-6" : "mt-6 border border-brand-border"
          }
          onClick={() => setStatus("idle")}
        >
          {isBugReport ? "Report another bug" : "Send another message"}
        </Button>
      </div>
    );
  }

  const contactFields = (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">Name</span>
        <input
          disabled={status === "submitting"}
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange"
          autoComplete="name"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">Email</span>
        <input
          disabled={status === "submitting"}
          required
          type="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange"
          autoComplete="email"
        />
      </label>
    </div>
  );

  return (
    <form
      onSubmit={onSubmit}
      className={
        isBugReport
          ? "ac-request-form relative space-y-5"
          : "relative space-y-5"
      }
      noValidate={!isBugReport}
    >
      {!isBugReport ? contactFields : null}

      {!isBugReport ? (
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-foreground">
            Topic
          </span>
          <select
            disabled={status === "submitting"}
            value={category}
            onChange={(e) => setCategory(e.target.value as ContactCategory)}
            className="w-full rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange"
          >
            {CONTACT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">
          {isBugReport ? "Short title" : "Subject"}
        </span>
        <input
          required
          disabled={status === "submitting"}
          maxLength={isBugReport ? 160 - BUG_REPORT_SUBJECT_PREFIX.length : 160}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={
            isBugReport
              ? "e.g. Microphone stays muted"
              : undefined
          }
          className="w-full rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">
          {isBugReport ? "What happened?" : "Message"}
        </span>
        <textarea
          required
          disabled={status === "submitting"}
          maxLength={4000}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            isBugReport
              ? "What were you doing, what did you expect, and what happened instead?"
              : "Include the page URL, browser, and extension version when relevant."
          }
          className="w-full resize-y rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange placeholder:text-foreground/35"
        />
      </label>

      {isBugReport ? (
        <>
          <div className="ac-form-contact-heading">
            <h2>Your contact details</h2>
            <p>We will use this email if we need to follow up.</p>
          </div>
          {contactFields}
        </>
      ) : null}

      <div
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        aria-hidden
      >
        <label>
          Company website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="touch"
        disabled={status === "submitting"}
        className={
          isBugReport
            ? "ac-button ac-button-primary"
            : "w-full bg-brand-orange font-semibold text-primary-foreground transition-[transform,background-color] duration-200 hover:bg-brand-orange-deep active:scale-[0.98] sm:w-auto"
        }
      >
        {status === "submitting"
          ? "Sending…"
          : isBugReport
            ? "Send bug report"
            : "Send message"}
      </Button>
    </form>
  );
}
