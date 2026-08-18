import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  get as vercelBlobGet,
  head as vercelBlobHead,
  list as vercelBlobList,
  put as vercelBlobPut,
} from "@vercel/blob";
import { isPrivateIntegrationBlobPath } from "../lib/private-integration-blob";

type BlobAuth =
  | { token: string }
  | { storeId: string; oidcToken?: string };

type BlobReadResult = {
  statusCode: number;
  stream: ReadableStream<Uint8Array> | null;
  blob: {
    pathname: string;
    size?: number | null;
    contentType?: string | null;
    etag?: string;
    cacheControl?: string;
  };
} | null;

type BlobListRow = {
  pathname: string;
  size: number;
  contentType?: string | null;
  etag?: string;
  url: string;
};

type BlobHeadResult = {
  pathname: string;
  url: string;
  etag: string;
} | null;

type PrivatePutOptions = BlobAuth & {
  access: "private";
  addRandomSuffix: false;
  allowOverwrite: false;
  cacheControlMaxAge: 60;
  contentType: "application/json" | "application/x-ndjson";
};

export type PrivateIntegrationBlobMigrationSdk = {
  head: (pathname: string, options: BlobAuth) => Promise<BlobHeadResult>;
  list: (options: BlobAuth & {
    cursor?: string;
    limit: number;
    prefix?: string;
  }) => Promise<{
    blobs: BlobListRow[];
    hasMore: boolean;
    cursor?: string;
  }>;
  get: (
    pathname: string,
    options: (
      | { access: "public" }
      | { access: "private"; useCache?: boolean }
    ) & BlobAuth,
  ) => Promise<BlobReadResult>;
  put: (
    pathname: string,
    body: ReadableStream<Uint8Array>,
    options: PrivatePutOptions,
  ) => Promise<{ pathname: string }>;
};

const DEFAULT_SDK: PrivateIntegrationBlobMigrationSdk = {
  head: vercelBlobHead as PrivateIntegrationBlobMigrationSdk["head"],
  list: vercelBlobList as PrivateIntegrationBlobMigrationSdk["list"],
  get: vercelBlobGet as PrivateIntegrationBlobMigrationSdk["get"],
  put: vercelBlobPut as PrivateIntegrationBlobMigrationSdk["put"],
};

type MigrationLogEntry = {
  pathname?: string;
  size?: number;
  status: "discovered" | "copied" | "verified" | "conflict";
};

type Digest = { bytes: number; sha256: string };

async function digestStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Digest> {
  const reader = stream.getReader();
  const hash = createHash("sha256");
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    hash.update(value);
  }
  return { bytes, sha256: hash.digest("hex") };
}

function contentTypeFor(
  pathname: string,
): PrivatePutOptions["contentType"] {
  return pathname.endsWith(".jsonl")
    ? "application/x-ndjson"
    : "application/json";
}

async function listInventoriedSourceObjects(
  sdk: PrivateIntegrationBlobMigrationSdk,
  sourceAuth: BlobAuth,
): Promise<BlobListRow[]> {
  const rows = new Map<string, BlobListRow>();
  let cursor: string | undefined;
  do {
    const page = await sdk.list({ ...sourceAuth, cursor, limit: 1000 });
    for (const row of page.blobs) {
      if (isPrivateIntegrationBlobPath(row.pathname)) {
        rows.set(row.pathname, row);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
    if (page.hasMore && !cursor) {
      throw new Error("Source Blob listing omitted its continuation cursor");
    }
  } while (cursor);
  return [...rows.values()].sort((left, right) =>
    left.pathname.localeCompare(right.pathname),
  );
}

async function destinationContainsPath(
  sdk: PrivateIntegrationBlobMigrationSdk,
  privateAuth: BlobAuth,
  pathname: string,
): Promise<boolean> {
  let cursor: string | undefined;
  do {
    const page = await sdk.list({
      ...privateAuth,
      prefix: pathname,
      cursor,
      limit: 1000,
    });
    if (page.blobs.some((row) => row.pathname === pathname)) return true;
    cursor = page.hasMore ? page.cursor : undefined;
    if (page.hasMore && !cursor) {
      throw new Error("Destination Blob listing omitted its continuation cursor");
    }
  } while (cursor);
  return false;
}

function assertReadableResult(
  result: BlobReadResult,
  pathname: string,
  source: "source" | "destination",
): asserts result is NonNullable<BlobReadResult> & {
  stream: ReadableStream<Uint8Array>;
} {
  if (
    !result ||
    result.statusCode !== 200 ||
    !result.stream ||
    result.blob.pathname !== pathname
  ) {
    throw new Error(`Unable to read ${source} metadata for ${pathname}`);
  }
}

function normalizedEtag(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^W\//i, "").replace(/^"|"$/g, "");
}

function sourceReadTarget(params: {
  pathname: string;
  metadata: BlobHeadResult;
}): { url: string; etag: string } {
  const { pathname, metadata } = params;
  if (!metadata) {
    throw new Error(`Unable to read source metadata for ${pathname}`);
  }
  const url = new URL(metadata.url);
  const etag = normalizedEtag(metadata.etag);
  if (
    metadata.pathname !== pathname ||
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".public.blob.vercel-storage.com") ||
    url.pathname.slice(1) !== pathname ||
    !etag
  ) {
    throw new Error(`Source Blob metadata was invalid for ${pathname}`);
  }
  url.search = "";
  url.searchParams.set("v", etag);
  return { url: url.toString(), etag };
}

export async function runPrivateIntegrationBlobMigration(input: {
  mode: "dry-run" | "apply";
  sourceAuth: BlobAuth;
  privateAuth: BlobAuth;
  sdk?: PrivateIntegrationBlobMigrationSdk;
  log?: (entry: MigrationLogEntry) => void;
}): Promise<{
  discovered: number;
  copied: number;
  verified: number;
  conflicts: number;
}> {
  const sdk = input.sdk ?? DEFAULT_SDK;
  const log = input.log ?? ((entry) => console.log(JSON.stringify(entry)));
  const rows = await listInventoriedSourceObjects(sdk, input.sourceAuth);
  const result = {
    discovered: rows.length,
    copied: 0,
    verified: 0,
    conflicts: 0,
  };

  for (const row of rows) {
    log({ pathname: row.pathname, size: row.size, status: "discovered" });
    if (input.mode === "dry-run") continue;

    const destinationExists = await destinationContainsPath(
      sdk,
      input.privateAuth,
      row.pathname,
    );
    const freshSource = sourceReadTarget({
      pathname: row.pathname,
      metadata: await sdk.head(row.pathname, input.sourceAuth),
    });
    const [source, existingDestination] = await Promise.all([
      sdk.get(freshSource.url, { access: "public", ...input.sourceAuth }),
      destinationExists
        ? sdk.get(row.pathname, {
            access: "private",
            useCache: false,
            ...input.privateAuth,
          })
        : Promise.resolve(null),
    ]);
    assertReadableResult(source, row.pathname, "source");
    const fetchedEtag = normalizedEtag(source.blob.etag);
    if (fetchedEtag !== freshSource.etag) {
      await source.stream.cancel().catch(() => undefined);
      throw new Error(`Source changed during migration for ${row.pathname}`);
    }

    const destinationMissing =
      !destinationExists || existingDestination?.statusCode === 404;
    if (!destinationMissing) {
      assertReadableResult(existingDestination, row.pathname, "destination");
      const [sourceDigest, destinationDigest] = await Promise.all([
        digestStream(source.stream),
        digestStream(existingDestination.stream),
      ]);
      if (
        sourceDigest.bytes === destinationDigest.bytes &&
        sourceDigest.sha256 === destinationDigest.sha256
      ) {
        result.verified += 1;
        log({ pathname: row.pathname, size: row.size, status: "verified" });
      } else {
        result.conflicts += 1;
        log({ pathname: row.pathname, size: row.size, status: "conflict" });
      }
      continue;
    }

    const [uploadStream, digestInput] = source.stream.tee();
    const [sourceDigest, written] = await Promise.all([
      digestStream(digestInput),
      sdk.put(row.pathname, uploadStream, {
        access: "private",
        ...input.privateAuth,
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60,
        contentType: contentTypeFor(row.pathname),
      }),
    ]);
    if (written.pathname !== row.pathname) {
      throw new Error(`Destination wrote an unexpected path for ${row.pathname}`);
    }
    result.copied += 1;
    log({ pathname: row.pathname, size: row.size, status: "copied" });

    const destination = await sdk.get(row.pathname, {
      access: "private",
      useCache: false,
      ...input.privateAuth,
    });
    assertReadableResult(destination, row.pathname, "destination");
    const destinationDigest = await digestStream(destination.stream);
    if (
      sourceDigest.bytes !== destinationDigest.bytes ||
      sourceDigest.sha256 !== destinationDigest.sha256
    ) {
      throw new Error(`Destination verification failed for ${row.pathname}`);
    }
    result.verified += 1;
    log({ pathname: row.pathname, size: row.size, status: "verified" });
  }

  return result;
}

function authFromEnvironment(prefix: "source" | "private"): BlobAuth {
  if (prefix === "source") {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (token) return { token };
    const storeId = process.env.PUBLIC_BLOB_STORE_ID?.trim();
    if (storeId) {
      const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
      return oidcToken ? { storeId, oidcToken } : { storeId };
    }
  } else {
    const token = process.env.PRIVATE_INTEGRATION_BLOB_READ_WRITE_TOKEN?.trim();
    if (token) return { token };
    const storeId = process.env.PRIVATE_INTEGRATION_BLOB_STORE_ID?.trim();
    if (storeId) {
      const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
      return oidcToken ? { storeId, oidcToken } : { storeId };
    }
  }
  throw new Error(`${prefix} Blob authentication is not configured`);
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const result = await runPrivateIntegrationBlobMigration({
    mode,
    sourceAuth: authFromEnvironment("source"),
    privateAuth: authFromEnvironment("private"),
  });
  console.log(JSON.stringify({ mode, ...result }));
  if (result.conflicts > 0) process.exitCode = 2;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  });
}
