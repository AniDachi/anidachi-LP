import { pathToFileURL } from "node:url";
import {
  get as vercelBlobGet,
  head as vercelBlobHead,
  put as vercelBlobPut,
} from "@vercel/blob";
import {
  reconcileKreatliCrmBlobs,
  type KreatliCrmBlobAuth,
  type KreatliCrmReconciliationSdk,
} from "../lib/kreatli-crm/blob-reconciliation";

const sdk: KreatliCrmReconciliationSdk = {
  head: vercelBlobHead as KreatliCrmReconciliationSdk["head"],
  get: vercelBlobGet as KreatliCrmReconciliationSdk["get"],
  put: vercelBlobPut as KreatliCrmReconciliationSdk["put"],
};

function tokenAuth(variable: string): KreatliCrmBlobAuth {
  const token = process.env[variable]?.trim();
  if (!token) throw new Error(`${variable} is not configured`);
  return { token };
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const report = await reconcileKreatliCrmBlobs({
    mode,
    sourceAuth: tokenAuth(
      "KREATLI_CRM_LEGACY_PUBLIC_BLOB_READ_WRITE_TOKEN",
    ),
    destinationAuth: tokenAuth("KREATLI_CRM_BLOB_READ_WRITE_TOKEN"),
    sdk,
  });
  console.log(
    JSON.stringify({
      mode: report.mode,
      objects: report.objects.length,
      changed: report.objects.filter(({ changed }) => changed).length,
      written: report.written,
      verified: report.verified,
      conflicts: report.conflicts,
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "CRM reconciliation failed",
    );
    process.exitCode = 1;
  });
}
