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

const fieldClassName =
  "w-full rounded-xl border border-ani-control-border bg-ani-canvas px-3.5 py-2.5 text-ani-text outline-none transition-colors placeholder:text-ani-muted focus:border-ani-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus";

export function FeatureRequestForm({
  variant = "public",
  initialContact,
}: {
  variant?: "public" | "account";
  initialContact?: { name: string; email: string };
}) {
  const [name, setName] = useState(initialContact?.name ?? "");
  const [email, setEmail] = useState(initialContact?.email ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] =
    useState<FeatureRequestCategory>("watchrooms");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
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
      if (variant !== "account") {
        setName("");
        setEmail("");
      }
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
        className={
          variant === "account"
            ? "ac-empty ac-form-success"
            : "rounded-[20px] border border-ani-line bg-ani-panel px-6 py-8 text-center"
        }
        role="status"
      >
        <p className="text-lg font-semibold tracking-[-0.01em] text-ani-text">
          Thanks — we got your request.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ani-muted">
          We read every submission. If we need more detail, we will reply to the
          email you shared.
        </p>
        <Button
          type="button"
          variant="ghost"
          className={
            variant === "account"
              ? "ac-button mt-6"
              : "mt-6 border border-ani-line"
          }
          onClick={() => setStatus("idle")}
        >
          Submit another idea
        </Button>
      </div>
    );
  }

  const contactFields = (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ani-text">Name</span>
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClassName}
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
          className={fieldClassName}
          autoComplete="email"
        />
      </label>
    </div>
  );

  return (
    <form
      onSubmit={onSubmit}
      className={
        variant === "account"
          ? "ac-request-form relative space-y-5"
          : "relative space-y-5"
      }
      noValidate={variant !== "account"}
    >
      {variant !== "account" ? contactFields : null}

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ani-text">Category</span>
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as FeatureRequestCategory)
          }
          className={fieldClassName}
        >
          {FEATURE_REQUEST_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ani-text">
          Short title
        </span>
        <input
          required
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Episode progress for YouTube playlists"
          className={fieldClassName}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ani-text">
          Describe the request
        </span>
        <textarea
          required
          maxLength={4000}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What problem does this solve for your watch group?"
          className={fieldClassName + " resize-y"}
        />
      </label>

      {variant === "account" ? (
        <div className="ac-form-contact-heading">
          <h2>Your contact details</h2>
          <p>We will use this email if we need to follow up.</p>
        </div>
      ) : null}
      {variant === "account" ? contactFields : null}

      {/* Honeypot — leave empty */}
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
        disabled={status === "submitting"}
        className={
          variant === "account" ? "ac-button ac-button-primary" : "w-full sm:w-auto"
        }
        variant={variant === "account" ? "default" : "cream"}
        size={variant === "account" ? "touch" : "control"}
      >
        {status === "submitting" ? "Sending…" : "Submit feature request"}
      </Button>
    </form>
  );
}
