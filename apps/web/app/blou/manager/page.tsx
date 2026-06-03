import { Suspense } from "react";
import { ConnectClient } from "./connect-client";

export default function ManagerPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 mb-6">
        Blou Content Manager
      </h1>
      <Suspense fallback={<div className="text-stone-500">Loading…</div>}>
        <ConnectClient />
      </Suspense>
    </div>
  );
}
