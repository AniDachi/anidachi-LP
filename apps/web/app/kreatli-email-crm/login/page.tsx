import { redirect } from "next/navigation";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function KreatliCrmLoginPage() {
  if (await verifyKreatliCrmSession()) {
    redirect("/kreatli-email-crm");
  }

  return (
    <main className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <LoginForm />
    </main>
  );
}
