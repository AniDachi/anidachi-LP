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

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          category,
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
      setName("");
      setEmail("");
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
        className="rounded-[20px] border border-ani-line bg-ani-panel px-6 py-8 text-center"
        role="status"
      >
        <p className="text-lg font-semibold tracking-[-0.01em] text-ani-text">
          Message sent
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ani-muted">
          We typically reply within a few business days. Urgent billing issues —
          put “Billing” in the subject next time.
        </p>
        <Button
          type="button"
          variant="ghost"
          className="mt-6 border border-ani-line"
          onClick={() => setStatus("idle")}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ani-text">Name</span>
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-ani-control-border bg-ani-canvas px-3.5 py-2.5 text-ani-text outline-none transition-colors focus:border-ani-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus"
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ani-text">Email</span>
          <input
            required
            type="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-ani-control-border bg-ani-canvas px-3.5 py-2.5 text-ani-text outline-none transition-colors focus:border-ani-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus"
            autoComplete="email"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ani-text">Topic</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ContactCategory)}
          className="w-full rounded-xl border border-ani-control-border bg-ani-canvas px-3.5 py-2.5 text-ani-text outline-none transition-colors focus:border-ani-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus"
        >
          {CONTACT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ani-text">Subject</span>
        <input
          required
          maxLength={160}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-ani-control-border bg-ani-canvas px-3.5 py-2.5 text-ani-text outline-none transition-colors focus:border-ani-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ani-text">Message</span>
        <textarea
          required
          maxLength={4000}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Include the page URL, browser, and extension version when relevant."
          className="w-full resize-y rounded-xl border border-ani-control-border bg-ani-canvas px-3.5 py-2.5 text-ani-text outline-none transition-colors placeholder:text-ani-muted focus:border-ani-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus"
        />
      </label>

      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
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
        disabled={status === "submitting"}
        className="w-full sm:w-auto"
        variant="cream"
        size="control"
      >
        {status === "submitting" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
