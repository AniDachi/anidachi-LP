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
        className="rounded-2xl border border-brand-border/80 bg-brand-surface px-6 py-8 text-center"
        role="status"
      >
        <p className="text-lg font-semibold tracking-[-0.01em] text-foreground">
          Message sent
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/65">
          We typically reply within a few business days. Urgent billing issues —
          put “Billing” in the subject next time.
        </p>
        <Button
          type="button"
          variant="ghost"
          className="mt-6 border border-brand-border"
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
          <span className="mb-1.5 block font-medium text-foreground">Name</span>
          <input
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

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">Topic</span>
        <select
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

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">Subject</span>
        <input
          required
          maxLength={160}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">Message</span>
        <textarea
          required
          maxLength={4000}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Include the page URL, browser, and extension version when relevant."
          className="w-full resize-y rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange placeholder:text-foreground/35"
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
        size="touch"
        disabled={status === "submitting"}
        className="w-full bg-brand-orange font-semibold text-primary-foreground transition-[transform,background-color] duration-200 hover:bg-brand-orange-deep active:scale-[0.98] sm:w-auto"
      >
        {status === "submitting" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
