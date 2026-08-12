"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  FEATURE_REQUEST_CATEGORIES,
  type FeatureRequestCategory,
} from "@/lib/kreatli-crm/feature-request-shared";

const CATEGORY_LABELS: Record<FeatureRequestCategory, string> = {
  watchrooms: "Watchrooms",
  sync: "Live sync",
  async: "Async catch-up",
  platforms: "Platforms (Crunchyroll / YouTube)",
  billing: "Billing & plans",
  other: "Other",
};

export function FeatureRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] =
    useState<FeatureRequestCategory>("watchrooms");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          title,
          description,
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
      setTitle("");
      setDescription("");
      setCategory("watchrooms");
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
          Thanks — we got your request.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/65">
          We read every submission. If we need more detail, we will reply to the
          email you shared.
        </p>
        <Button
          type="button"
          variant="ghost"
          className="mt-6 border border-brand-border"
          onClick={() => setStatus("idle")}
        >
          Submit another idea
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
        <span className="mb-1.5 block font-medium text-foreground">Category</span>
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as FeatureRequestCategory)
          }
          className="w-full rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange"
        >
          {FEATURE_REQUEST_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">
          Short title
        </span>
        <input
          required
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Episode progress for YouTube playlists"
          className="w-full rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange placeholder:text-foreground/35"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">
          Describe the request
        </span>
        <textarea
          required
          maxLength={4000}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What problem does this solve for your watch group?"
          className="w-full resize-y rounded-xl border border-brand-border bg-background px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-brand-orange placeholder:text-foreground/35"
        />
      </label>

      {/* Honeypot — leave empty */}
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
        {status === "submitting" ? "Sending…" : "Submit feature request"}
      </Button>
    </form>
  );
}
