import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Contact, Touch } from "./types";
import {
  hasKreatliCrmBlobConfiguration,
  readKreatliCrmBlobText,
  updateKreatliCrmBlobText,
} from "@/lib/private-integration-blob";

export function getCrmDataDir(): string {
  if (process.env.CRM_DATA_DIR) {
    return path.resolve(process.env.CRM_DATA_DIR);
  }
  return path.join(process.cwd(), "crm-data");
}

export const KREATLI_CRM_CONTACTS_BLOB_PATH = "kreatli-crm/contacts.json";
export const KREATLI_CRM_TOUCHES_BLOB_PATH = "kreatli-crm/touches.jsonl";
export const KREATLI_CRM_META_BLOB_PATH = "kreatli-crm/meta.json";
const CONTACTS_BLOB_PATH = KREATLI_CRM_CONTACTS_BLOB_PATH;
const TOUCHES_BLOB_PATH = KREATLI_CRM_TOUCHES_BLOB_PATH;
const META_BLOB_PATH = KREATLI_CRM_META_BLOB_PATH;

async function blobReadText(blobPath: string): Promise<string | null> {
  return readKreatliCrmBlobText(blobPath);
}

async function blobUpdateText(
  blobPath: string,
  mutate: (current: string | null) => string | Promise<string>,
): Promise<string> {
  return updateKreatliCrmBlobText(blobPath, mutate);
}

function assertLocalCrmRuntime(): void {
  if (process.env.VERCEL === "1") {
    throw new Error("CRM durable storage is not configured on Vercel");
  }
}

function parseContacts(raw: string, source: string): Contact[] {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`Invalid CRM contacts data from ${source}${detail}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(`Invalid CRM contacts data from ${source}: expected an array`);
  }
  return data as Contact[];
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error &&
    (error as NodeJS.ErrnoException).code === "ENOENT";
}

function paths() {
  const dir = getCrmDataDir();
  return {
    dir,
    contacts: path.join(dir, "contacts.json"),
    touches: path.join(dir, "touches.jsonl"),
    meta: path.join(dir, "meta.json"),
  };
}

export type CrmMeta = {
  schema_version: number;
  updated_at: string | null;
};

async function ensureDir() {
  await fs.mkdir(paths().dir, { recursive: true });
}

let localContactsMutationTail: Promise<void> = Promise.resolve();

async function serializeLocalContactsMutation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const previous = localContactsMutationTail;
  let release!: () => void;
  localContactsMutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function writeContactsFileAtomically(contacts: Contact[]): Promise<void> {
  await ensureDir();
  const target = paths().contacts;
  const temporary = path.join(
    paths().dir,
    `.contacts-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporary, JSON.stringify(contacts, null, 2), "utf8");
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readMeta(): Promise<CrmMeta> {
  if (hasKreatliCrmBlobConfiguration()) {
    const blobText = await blobReadText(META_BLOB_PATH);
    if (!blobText) return { schema_version: 1, updated_at: null };
    try {
      const data = JSON.parse(blobText) as CrmMeta;
      return {
        schema_version:
          typeof data.schema_version === "number" ? data.schema_version : 1,
        updated_at: data.updated_at ?? null,
      };
    } catch {
      return { schema_version: 1, updated_at: null };
    }
  }

  assertLocalCrmRuntime();
  await ensureDir();
  const { meta } = paths();
  try {
    const raw = await fs.readFile(meta, "utf8");
    const data = JSON.parse(raw) as CrmMeta;
    return {
      schema_version: typeof data.schema_version === "number" ? data.schema_version : 1,
      updated_at: data.updated_at ?? null,
    };
  } catch {
    return { schema_version: 1, updated_at: null };
  }
}

export async function writeMeta(partial: Partial<CrmMeta>): Promise<void> {
  if (hasKreatliCrmBlobConfiguration()) {
    await blobUpdateText(META_BLOB_PATH, (current) => {
      let cur: CrmMeta = { schema_version: 1, updated_at: null };
      if (current) {
        try {
          const parsed = JSON.parse(current) as CrmMeta;
          cur = {
            schema_version:
              typeof parsed.schema_version === "number"
                ? parsed.schema_version
                : 1,
            updated_at: parsed.updated_at ?? null,
          };
        } catch {
          cur = { schema_version: 1, updated_at: null };
        }
      }
      const next: CrmMeta = {
        schema_version: partial.schema_version ?? cur.schema_version,
        updated_at: partial.updated_at ?? cur.updated_at,
      };
      return JSON.stringify(next, null, 2);
    });
    return;
  }

  assertLocalCrmRuntime();
  await ensureDir();
  const cur = await readMeta();
  const next: CrmMeta = {
    schema_version: partial.schema_version ?? cur.schema_version,
    updated_at: partial.updated_at ?? cur.updated_at,
  };
  await fs.writeFile(paths().meta, JSON.stringify(next, null, 2), "utf8");
}

export async function readContacts(): Promise<Contact[]> {
  if (hasKreatliCrmBlobConfiguration()) {
    const blobText = await blobReadText(CONTACTS_BLOB_PATH);
    if (blobText === null) {
      throw new Error("CRM contacts object is missing from durable storage");
    }
    return parseContacts(blobText, "Vercel Blob");
  }

  assertLocalCrmRuntime();
  await ensureDir();
  const { contacts } = paths();
  try {
    const raw = await fs.readFile(contacts, "utf8");
    return parseContacts(raw, contacts);
  } catch (error) {
    if (isFileNotFound(error)) return [];
    throw error;
  }
}

export async function writeContacts(contacts: Contact[]): Promise<void> {
  if (hasKreatliCrmBlobConfiguration()) {
    await blobUpdateText(CONTACTS_BLOB_PATH, (current) => {
      if (current === null) {
        throw new Error("CRM contacts object is missing from durable storage");
      }
      return JSON.stringify(contacts, null, 2);
    });
    await writeMeta({ updated_at: new Date().toISOString() }).catch((error) => {
      console.error("[kreatli-crm] Failed to update CRM metadata", error);
    });
    return;
  }

  assertLocalCrmRuntime();
  await writeContactsFileAtomically(contacts);
  await writeMeta({ updated_at: new Date().toISOString() });
}

export type ContactMutation<T> = (
  contacts: Contact[],
) => { changed: boolean; value: T };

export type ContactMutationResult<T> = {
  changed: boolean;
  contacts: Contact[];
  value: T;
};

export async function mutateContacts<T>(
  mutation: ContactMutation<T>,
): Promise<ContactMutationResult<T>> {
  if (hasKreatliCrmBlobConfiguration()) {
    let outcome: { changed: boolean; value: T } | undefined;
    const committedText = await blobUpdateText(CONTACTS_BLOB_PATH, (current) => {
      if (current === null) {
        throw new Error("CRM contacts object is missing from durable storage");
      }
      const contacts = parseContacts(current, "Vercel Blob");
      outcome = mutation(contacts);
      return outcome.changed ? JSON.stringify(contacts, null, 2) : current;
    });
    if (!outcome) throw new Error("CRM contact mutation did not run");
    const committed = parseContacts(committedText, "Vercel Blob");
    if (outcome.changed) {
      await writeMeta({ updated_at: new Date().toISOString() }).catch(
        (error) => {
          console.error("[kreatli-crm] Failed to update CRM metadata", error);
        },
      );
    }
    return { ...outcome, contacts: committed };
  }

  assertLocalCrmRuntime();
  return serializeLocalContactsMutation(async () => {
    const contacts = await readContacts();
    const outcome = mutation(contacts);
    if (outcome.changed) {
      await writeContactsFileAtomically(contacts);
      await writeMeta({ updated_at: new Date().toISOString() });
    }
    return { ...outcome, contacts };
  });
}

export async function readTouches(): Promise<Touch[]> {
  if (hasKreatliCrmBlobConfiguration()) {
    const blobText = await blobReadText(TOUCHES_BLOB_PATH);
    if (!blobText) return [];
    try {
      const lines = blobText.split("\n").filter((l) => l.trim());
      return lines.map((line) => JSON.parse(line) as Touch);
    } catch {
      return [];
    }
  }

  assertLocalCrmRuntime();
  await ensureDir();
  const { touches } = paths();
  try {
    const raw = await fs.readFile(touches, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    return lines.map((line) => JSON.parse(line) as Touch);
  } catch {
    return [];
  }
}

export async function appendTouch(touch: Touch): Promise<void> {
  if (hasKreatliCrmBlobConfiguration()) {
    await blobUpdateText(TOUCHES_BLOB_PATH, (current) => {
      const cur = current ?? "";
      return `${cur}${cur && !cur.endsWith("\n") ? "\n" : ""}${JSON.stringify(touch)}\n`;
    });
    return;
  }

  assertLocalCrmRuntime();
  await ensureDir();
  const line = `${JSON.stringify(touch)}\n`;
  await fs.appendFile(paths().touches, line, "utf8");
}

export function crmDataDir(): string {
  return paths().dir;
}

export function contactsFilePath(): string {
  return paths().contacts;
}

export function touchesFilePath(): string {
  return paths().touches;
}
