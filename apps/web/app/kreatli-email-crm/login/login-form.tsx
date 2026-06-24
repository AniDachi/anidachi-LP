"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/kreatli-crm/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/kreatli-email-crm");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-sm space-y-4 rounded-xl border border-brand-orange/30/80 bg-white/90 p-8 shadow-lg backdrop-blur"
    >
      <div>
        <h1 className="text-xl font-semibold text-purple-950">
          Kreatli Email CRM
        </h1>
        <p className="mt-1 text-sm text-brand-orange/80">
          Enter the access password to continue.
        </p>
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-purple-900"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-brand-orange/30 bg-background px-3 py-2 text-purple-950 shadow-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-full bg-brand-orange hover:bg-purple-800"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
