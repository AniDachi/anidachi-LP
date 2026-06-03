import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import { BlouLoginForm } from "./blou-login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — Bloü",
  robots: { index: false, follow: false },
};

export default async function BlouLoginPage() {
  if (await verifyKreatliCrmSession()) {
    redirect("/blou/manager");
  }

  return (
    <main className="min-h-screen bg-[#f0f7f4]">
      <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
        <Suspense fallback={<p className="text-sm text-stone-600">Loading…</p>}>
          <BlouLoginForm />
        </Suspense>
      </div>
    </main>
  );
}
