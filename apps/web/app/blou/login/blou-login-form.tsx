"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

function safeNextParam(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/blou/manager";
  if (!raw.startsWith("/blou")) return "/blou/manager";
  return raw;
}

export function BlouLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const afterLogin = useMemo(
    () => safeNextParam(searchParams.get("next")),
    [searchParams]
  );
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
      router.push(afterLogin);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-sm space-y-4 rounded-xl border border-teal-200/80 bg-white/90 p-8 shadow-lg backdrop-blur"
    >
      <div>
        <h1 className="text-xl font-semibold text-teal-950">Bloü</h1>
        <p className="mt-1 text-sm text-teal-900/80">
          Enter the access password to continue (same as Kreatli Email CRM).
        </p>
      </div>
      <div>
        <label htmlFor="blou-password" className="mb-1 block text-sm font-medium text-teal-900">
          Password
        </label>
        <input
          id="blou-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-teal-200 bg-white px-3 py-2 text-stone-900 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
