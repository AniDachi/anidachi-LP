"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BlouManagerLogoutButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="border-teal-300 text-teal-900 hover:bg-teal-50"
      onClick={async () => {
        await fetch("/api/kreatli-crm/logout", { method: "POST" });
        router.push("/blou/login");
        router.refresh();
      }}
    >
      Log out
    </Button>
  );
}
