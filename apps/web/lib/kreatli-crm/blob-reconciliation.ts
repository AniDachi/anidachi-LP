import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { vercelBlobEtagForIfMatch } from "../private-integration-blob";
import type { ContactStatus } from "./types";

export const KREATLI_CRM_RECONCILIATION_PATHS = [
  "kreatli-crm/contacts.json",
  "kreatli-crm/touches.jsonl",
  "kreatli-crm/meta.json",
  "kreatli-crm/contact-messages.jsonl",
  "kreatli-crm/feature-requests.jsonl",
] as const;

type ReconciliationPath =
  (typeof KREATLI_CRM_RECONCILIATION_PATHS)[number];

export type KreatliCrmBlobAuth =
  | { token: string }
  | { storeId: string; oidcToken?: string };

type BlobReadResult = {
  statusCode: number;
  stream: ReadableStream<Uint8Array> | null;
  blob: {
    pathname: string;
    etag?: string;
    size?: number | null;
  };
} | null;

type BlobHeadResult = {
  pathname: string;
  url: string;
  etag: string;
} | null;

type ReconciliationPutOptions = KreatliCrmBlobAuth & {
  access: "private";
  addRandomSuffix: false;
  allowOverwrite: boolean;
  cacheControlMaxAge: 60;
  contentType: "application/json" | "application/x-ndjson";
  ifMatch?: string;
};

export type KreatliCrmReconciliationSdk = {
  head: (
    pathname: string,
    options: KreatliCrmBlobAuth,
  ) => Promise<BlobHeadResult>;
  get: (
    pathname: string,
    options:
      & ({ access: "public" } | { access: "private"; useCache: false })
      & KreatliCrmBlobAuth,
  ) => Promise<BlobReadResult>;
  put: (
    pathname: string,
    body: string | ReadableStream<Uint8Array>,
    options: ReconciliationPutOptions,
  ) => Promise<{ pathname: string }>;
};

type JsonObject = Record<string, unknown>;

export type MergedCrmObject = {
  text: string;
  records: number;
  surveyLeads: number | null;
};

type ObjectSnapshot = {
  pathname: ReconciliationPath;
  text: string | null;
  etag: string | null;
};

export type KreatliCrmReconciliationReport = {
  mode: "dry-run" | "apply";
  conflicts: number;
  written: number;
  verified: number;
  objects: Array<{
    pathname: ReconciliationPath;
    changed: boolean;
    sourceBytes: number;
    destinationBytes: number;
    mergedBytes: number;
    sourceSha256: string;
    destinationSha256: string;
    mergedSha256: string;
    records: number;
    surveyLeads: number | null;
  }>;
};

const CONTACT_STATUSES = new Set<ContactStatus>([
  "active",
  "replied",
  "booked",
  "closed",
  "dnc",
]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizedEtag(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^W\//i, "").replace(/^"|"$/g, "");
}

function digest(text: string | null): { bytes: number; sha256: string } {
  const body = text ?? "";
  return {
    bytes: Buffer.byteLength(body),
    sha256: createHash("sha256").update(body).digest("hex"),
  };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`Invalid ${label} JSON${detail}`);
  }
}

function assertContact(value: unknown, label: string): asserts value is JsonObject {
  if (
    !isObject(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.email !== "string" ||
    !normalizeEmail(value.email) ||
    typeof value.company !== "string" ||
    typeof value.first_name !== "string" ||
    !Array.isArray(value.segments) ||
    !value.segments.every((segment) => typeof segment === "string") ||
    typeof value.notes !== "string" ||
    typeof value.status !== "string" ||
    !CONTACT_STATUSES.has(value.status as ContactStatus) ||
    !(value.next_action_date === null || typeof value.next_action_date === "string") ||
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    throw new Error(`Invalid contact in ${label}`);
  }
}

function parseContacts(raw: string | null, label: string): JsonObject[] {
  if (raw === null) {
    if (label === "source") {
      throw new Error("Source contacts object is missing");
    }
    return [];
  }
  const parsed = parseJson(raw, "contacts");
  if (!Array.isArray(parsed)) throw new Error(`Invalid contacts JSON in ${label}`);
  const byId = new Set<string>();
  const byEmail = new Set<string>();
  for (const value of parsed) {
    assertContact(value, label);
    const id = value.id as string;
    const email = normalizeEmail(value.email as string);
    if (byId.has(id)) throw new Error(`Duplicate contact id in ${label}`);
    if (byEmail.has(email)) throw new Error(`Duplicate contact email in ${label}`);
    byId.add(id);
    byEmail.add(email);
  }
  return parsed as JsonObject[];
}

function mergeContacts(
  sourceText: string | null,
  destinationText: string | null,
): MergedCrmObject {
  const source = parseContacts(sourceText, "source");
  const destination = parseContacts(destinationText, "destination");
  const merged = source.map((contact) => structuredClone(contact));
  const byId = new Map(merged.map((contact) => [contact.id as string, contact]));
  const byEmail = new Map(
    merged.map((contact) => [normalizeEmail(contact.email as string), contact]),
  );

  for (const contact of destination) {
    const idMatch = byId.get(contact.id as string);
    const emailMatch = byEmail.get(normalizeEmail(contact.email as string));
    if (idMatch || emailMatch) {
      if (!idMatch || !emailMatch || idMatch !== emailMatch) {
        throw new Error("Divergent contact identity between source and destination");
      }
      if (!isDeepStrictEqual(idMatch, contact)) {
        throw new Error("Divergent contact identity between source and destination");
      }
      continue;
    }
    const copy = structuredClone(contact);
    merged.push(copy);
    byId.set(copy.id as string, copy);
    byEmail.set(normalizeEmail(copy.email as string), copy);
  }

  return {
    text: JSON.stringify(merged, null, 2),
    records: merged.length,
    surveyLeads: merged.filter(
      (contact) =>
        Array.isArray(contact.segments) &&
        contact.segments.includes("survey_lead"),
    ).length,
  };
}

function parseJsonl(raw: string | null, label: string): JsonObject[] {
  if (!raw) return [];
  const records: JsonObject[] = [];
  const ids = new Set<string>();
  for (const [index, line] of raw.split("\n").entries()) {
    if (!line.trim()) continue;
    const value = parseJson(line, `JSONL ${label} line ${index + 1}`);
    if (!isObject(value) || typeof value.id !== "string" || !value.id.trim()) {
      throw new Error(`Invalid JSONL record in ${label}`);
    }
    if (ids.has(value.id)) throw new Error(`Duplicate JSONL id in ${label}`);
    ids.add(value.id);
    records.push(value);
  }
  return records;
}

function mergeJsonl(
  sourceText: string | null,
  destinationText: string | null,
): MergedCrmObject {
  const source = parseJsonl(sourceText, "source");
  const destination = parseJsonl(destinationText, "destination");
  const merged = source.map((record) => structuredClone(record));
  const byId = new Map(merged.map((record) => [record.id as string, record]));

  for (const record of destination) {
    const existing = byId.get(record.id as string);
    if (existing) {
      if (!isDeepStrictEqual(existing, record)) {
        throw new Error("Divergent JSONL identity between source and destination");
      }
      continue;
    }
    const copy = structuredClone(record);
    merged.push(copy);
    byId.set(copy.id as string, copy);
  }

  if (destinationText !== null && isDeepStrictEqual(merged, destination)) {
    return {
      text: destinationText,
      records: merged.length,
      surveyLeads: null,
    };
  }

  return {
    text: merged.length
      ? `${merged.map((record) => JSON.stringify(record)).join("\n")}\n`
      : "",
    records: merged.length,
    surveyLeads: null,
  };
}

type CrmMeta = { schema_version: number; updated_at: string | null };

function parseMeta(raw: string | null, label: string): CrmMeta {
  if (raw === null) return { schema_version: 1, updated_at: null };
  const value = parseJson(raw, `metadata ${label}`);
  if (
    !isObject(value) ||
    typeof value.schema_version !== "number" ||
    !Number.isInteger(value.schema_version) ||
    value.schema_version < 1 ||
    !(value.updated_at === null || typeof value.updated_at === "string")
  ) {
    throw new Error(`Invalid CRM metadata in ${label}`);
  }
  if (
    typeof value.updated_at === "string" &&
    !Number.isFinite(Date.parse(value.updated_at))
  ) {
    throw new Error(`Invalid CRM metadata timestamp in ${label}`);
  }
  return value as CrmMeta;
}

function mergeMeta(
  sourceText: string | null,
  destinationText: string | null,
): MergedCrmObject {
  const source = parseMeta(sourceText, "source");
  const destination = parseMeta(destinationText, "destination");
  const timestamps = [source.updated_at, destination.updated_at].filter(
    (value): value is string => Boolean(value),
  );
  return {
    text: JSON.stringify(
      {
        schema_version: Math.max(
          source.schema_version,
          destination.schema_version,
        ),
        updated_at: timestamps.sort().at(-1) ?? null,
      },
      null,
      2,
    ),
    records: 1,
    surveyLeads: null,
  };
}

export function mergeKreatliCrmObject(
  pathname: string,
  sourceText: string | null,
  destinationText: string | null,
): MergedCrmObject {
  if (pathname === "kreatli-crm/contacts.json") {
    return mergeContacts(sourceText, destinationText);
  }
  if (pathname === "kreatli-crm/meta.json") {
    return mergeMeta(sourceText, destinationText);
  }
  if (
    KREATLI_CRM_RECONCILIATION_PATHS.includes(
      pathname as ReconciliationPath,
    ) &&
    pathname.endsWith(".jsonl")
  ) {
    return mergeJsonl(sourceText, destinationText);
  }
  throw new Error(`Unsupported CRM reconciliation path: ${pathname}`);
}

async function textFromResult(
  result: NonNullable<BlobReadResult>,
): Promise<string> {
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob read failed for ${result.blob.pathname}`);
  }
  return new Response(result.stream).text();
}

async function readFreshPublic(
  pathname: ReconciliationPath,
  auth: KreatliCrmBlobAuth,
  sdk: KreatliCrmReconciliationSdk,
): Promise<ObjectSnapshot> {
  const metadata = await sdk.head(pathname, auth);
  if (!metadata) return { pathname, text: null, etag: null };
  const etag = normalizedEtag(metadata.etag);
  const url = new URL(metadata.url);
  if (
    metadata.pathname !== pathname ||
    !etag ||
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".public.blob.vercel-storage.com") ||
    url.pathname.slice(1) !== pathname
  ) {
    throw new Error(`Invalid source Blob metadata for ${pathname}`);
  }
  url.search = "";
  url.searchParams.set("v", etag);
  const result = await sdk.get(url.toString(), { access: "public", ...auth });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Unable to read source object ${pathname}`);
  }
  if (
    result.blob.pathname !== pathname ||
    normalizedEtag(result.blob.etag) !== etag
  ) {
    await result.stream.cancel().catch(() => undefined);
    throw new Error(`Source changed during reconciliation for ${pathname}`);
  }
  return { pathname, text: await textFromResult(result), etag };
}

async function readFreshPrivate(
  pathname: ReconciliationPath,
  auth: KreatliCrmBlobAuth,
  sdk: KreatliCrmReconciliationSdk,
): Promise<ObjectSnapshot> {
  const result = await sdk.get(pathname, {
    access: "private",
    useCache: false,
    ...auth,
  });
  if (!result || result.statusCode === 404) {
    return { pathname, text: null, etag: null };
  }
  if (
    result.statusCode !== 200 ||
    !result.stream ||
    result.blob.pathname !== pathname
  ) {
    throw new Error(`Unable to read destination object ${pathname}`);
  }
  const etag = vercelBlobEtagForIfMatch(result.blob.etag);
  if (!etag) {
    await result.stream.cancel().catch(() => undefined);
    throw new Error(`Destination Blob returned no ETag for ${pathname}`);
  }
  return { pathname, text: await textFromResult(result), etag };
}

function contentTypeFor(pathname: ReconciliationPath) {
  return pathname.endsWith(".jsonl")
    ? ("application/x-ndjson" as const)
    : ("application/json" as const);
}

export async function reconcileKreatliCrmBlobs(input: {
  mode: "dry-run" | "apply";
  sourceAuth: KreatliCrmBlobAuth;
  destinationAuth: KreatliCrmBlobAuth;
  sdk: KreatliCrmReconciliationSdk;
  log?: (entry: Record<string, unknown>) => void;
}): Promise<KreatliCrmReconciliationReport> {
  const log = input.log ?? ((entry) => console.log(JSON.stringify(entry)));
  const planned: Array<{
    source: ObjectSnapshot;
    destination: ObjectSnapshot;
    merged: MergedCrmObject;
  }> = [];

  for (const pathname of KREATLI_CRM_RECONCILIATION_PATHS) {
    const [source, destination] = await Promise.all([
      readFreshPublic(pathname, input.sourceAuth, input.sdk),
      readFreshPrivate(pathname, input.destinationAuth, input.sdk),
    ]);
    const merged = mergeKreatliCrmObject(
      pathname,
      source.text,
      destination.text,
    );
    planned.push({ source, destination, merged });
  }

  const report: KreatliCrmReconciliationReport = {
    mode: input.mode,
    conflicts: 0,
    written: 0,
    verified: 0,
    objects: planned.map(({ source, destination, merged }) => {
      const sourceDigest = digest(source.text);
      const destinationDigest = digest(destination.text);
      const mergedDigest = digest(merged.text);
      return {
        pathname: source.pathname,
        changed: destination.text !== merged.text,
        sourceBytes: sourceDigest.bytes,
        destinationBytes: destinationDigest.bytes,
        mergedBytes: mergedDigest.bytes,
        sourceSha256: sourceDigest.sha256,
        destinationSha256: destinationDigest.sha256,
        mergedSha256: mergedDigest.sha256,
        records: merged.records,
        surveyLeads: merged.surveyLeads,
      };
    }),
  };

  for (const object of report.objects) log({ mode: input.mode, ...object });
  if (input.mode === "dry-run") return report;

  for (const item of planned) {
    const objectReport = report.objects.find(
      ({ pathname }) => pathname === item.source.pathname,
    )!;
    if (!objectReport.changed) {
      report.verified += 1;
      continue;
    }

    if (item.source.etag) {
      const currentSource = await input.sdk.head(
        item.source.pathname,
        input.sourceAuth,
      );
      if (normalizedEtag(currentSource?.etag) !== item.source.etag) {
        throw new Error(
          `Source changed during reconciliation for ${item.source.pathname}`,
        );
      }
    }

    const written = await input.sdk.put(
      item.destination.pathname,
      item.merged.text,
      {
        access: "private",
        ...input.destinationAuth,
        addRandomSuffix: false,
        allowOverwrite: item.destination.etag !== null,
        cacheControlMaxAge: 60,
        contentType: contentTypeFor(item.destination.pathname),
        ...(item.destination.etag
          ? { ifMatch: item.destination.etag }
          : {}),
      },
    );
    if (written.pathname !== item.destination.pathname) {
      throw new Error(
        `Destination wrote an unexpected path for ${item.destination.pathname}`,
      );
    }
    report.written += 1;

    const verified = await readFreshPrivate(
      item.destination.pathname,
      input.destinationAuth,
      input.sdk,
    );
    const expectedDigest = digest(item.merged.text);
    const actualDigest = digest(verified.text);
    if (
      expectedDigest.bytes !== actualDigest.bytes ||
      expectedDigest.sha256 !== actualDigest.sha256
    ) {
      throw new Error(
        `Destination verification failed for ${item.destination.pathname}`,
      );
    }
    report.verified += 1;
  }

  return report;
}
