#!/usr/bin/env npx tsx
/**
 * Kreatli CRM CLI — run from repo root: `npm run crm -- <command>`
 * Optional: CRM_DATA_DIR=/path/to/crm-data
 */

import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { isContactDue } from "../../lib/kreatli-crm/queue";
import {
  buildImportPreview,
  contactsToCsv,
  parseImportText,
  type ImportMergeMode,
} from "../../lib/kreatli-crm/import-merge";
import {
  appendTouch,
  contactsFilePath,
  crmDataDir,
  mutateContacts,
  readContacts,
  readMeta,
  readTouches,
} from "../../lib/kreatli-crm/store";
import { renderTemplate } from "../../lib/kreatli-crm/template-render";
import type { Contact } from "../../lib/kreatli-crm/types";
import { isValidEmail, normalizeEmail, parseStatus } from "../../lib/kreatli-crm/validation";

function usage() {
  console.log(`
Kreatli CRM CLI (agent-first; same data as Next.js app when cwd is repo root)

  npm run crm -- queue
  npm run crm -- show <email|id>
  npm run crm -- add-contact --email <e> [--company ..] [--first_name ..] [--segments a,b] [--notes ..] [--next YYYY-MM-DD]
  npm run crm -- log-touch <email|id> "<summary>"
  npm run crm -- set --email <e>|--id <id> [--status active|...] [--next YYYY-MM-DD] [--notes ..]
  npm run crm -- import csv <file> [--mode skip|upsert] [--dry-run|--apply]
  npm run crm -- import paste [--mode skip|upsert] [--dry-run|--apply]   (reads stdin)
  npm run crm -- export csv [outfile|-]
  npm run crm -- render <template> --contact <email|id>
  npm run crm -- doctor

Env: CRM_DATA_DIR  Override data directory (default: ./crm-data from cwd)
`);
}

function findContact(contacts: Contact[], q: string): Contact | undefined {
  const t = q.trim().toLowerCase();
  return contacts.find(
    (c) => c.id === q || c.email === t || c.email.includes(t)
  );
}

function nowIso() {
  return new Date().toISOString();
}

async function cmdQueue() {
  const contacts = await readContacts();
  const due = contacts.filter(isContactDue);
  if (due.length === 0) {
    console.log("Queue empty (UTC): no active contacts due.");
    return;
  }
  for (const c of due) {
    console.log(`${c.email}\t${c.company}\t${c.next_action_date}`);
  }
}

async function cmdShow(q: string) {
  const contacts = await readContacts();
  const c = findContact(contacts, q);
  if (!c) {
    console.error("Not found");
    process.exit(1);
  }
  console.log(JSON.stringify(c, null, 2));
}

async function cmdAddContact(args: string[]) {
  const opts = parseOpts(args);
  const email = normalizeEmail(opts.email ?? "");
  if (!email || !isValidEmail(email)) {
    console.error("Need --email");
    process.exit(1);
  }
  const t = nowIso();
  const result = await mutateContacts((contacts) => {
    if (contacts.some((contact) => contact.email === email)) {
      return { changed: false, value: null as string | null };
    }
    const id = randomUUID();
    contacts.push({
      id,
      email,
      company: opts.company ?? "",
      first_name: opts.first_name ?? "",
      segments: (opts.segments ?? "")
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean),
      notes: opts.notes ?? "",
      status: "active",
      next_action_date: opts.next ?? null,
      created_at: t,
      updated_at: t,
    });
    return { changed: true, value: id };
  });
  if (!result.value) {
    console.error("Email exists");
    process.exit(1);
  }
  console.log(result.value);
}

async function cmdLogTouch(q: string, summary: string) {
  const contacts = await readContacts();
  const c = findContact(contacts, q);
  if (!c) {
    console.error("Contact not found");
    process.exit(1);
  }
  await appendTouch({
    id: randomUUID(),
    contact_id: c.id,
    sent_at: nowIso(),
    summary,
  });
  console.log("ok");
}

async function cmdSet(args: string[]) {
  const opts = parseOpts(args);
  const parsedStatus = opts.status ? parseStatus(opts.status) : undefined;
  if (opts.status) {
    if (!parsedStatus) {
      console.error("Bad status");
      process.exit(1);
    }
  }

  const result = await mutateContacts((contacts) => {
    let contact: Contact | undefined;
    if (opts.id) contact = contacts.find(({ id }) => id === opts.id);
    if (!contact && opts.email) contact = findContact(contacts, opts.email);
    if (!contact) return { changed: false, value: false };
    const idx = contacts.indexOf(contact);
    contacts[idx] = {
      ...contact,
      ...(parsedStatus ? { status: parsedStatus } : {}),
      ...(opts.next !== undefined
        ? { next_action_date: opts.next || null }
        : {}),
      ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
      updated_at: nowIso(),
    };
    return { changed: true, value: true };
  });
  if (!result.value) {
    console.error("Need --id or --email");
    process.exit(1);
  }
  console.log("ok");
}

async function cmdImportCsv(args: string[]) {
  const file = args[0];
  if (!file) {
    console.error("Need file");
    process.exit(1);
  }
  const mode = (getFlag(args, "mode") as ImportMergeMode) || "skip";
  const dry = args.includes("--dry-run");
  const apply = args.includes("--apply");
  if (!dry && !apply) {
    console.error("Specify --dry-run or --apply");
    process.exit(1);
  }
  const raw = await fs.readFile(path.resolve(file), "utf8");
  await runImport(raw, mode, dry, apply);
}

async function cmdImportPaste(args: string[]) {
  const mode = (getFlag(args, "mode") as ImportMergeMode) || "skip";
  const dry = args.includes("--dry-run");
  const apply = args.includes("--apply");
  if (!dry && !apply) {
    console.error("Specify --dry-run or --apply");
    process.exit(1);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  await runImport(raw, mode, dry, apply);
}

async function runImport(
  raw: string,
  mode: ImportMergeMode,
  dry: boolean,
  apply: boolean
) {
  const parsed = parseImportText(raw);
  const existing = await readContacts();
  const { preview } = buildImportPreview(existing, parsed, mode);
  for (const line of preview) {
    console.log(`${line.action}\t${line.email}\t${line.detail}`);
  }
  const counts = { create: 0, skip: 0, update: 0 };
  for (const line of preview) {
    if (line.action === "create") counts.create++;
    else if (line.action === "skip") counts.skip++;
    else counts.update++;
  }
  console.error(
    `# summary: +${counts.create} skip ${counts.skip} update ${counts.update}`
  );
  if (apply) {
    await mutateContacts((contacts) => {
      const current = buildImportPreview(contacts, parsed, mode).nextContacts;
      contacts.splice(0, contacts.length, ...current);
      return { changed: true, value: undefined };
    });
    console.error("Applied.");
  }
}

async function cmdExportCsv(args: string[]) {
  const out = args[0];
  const contacts = await readContacts();
  const csv = contactsToCsv(contacts);
  if (!out || out === "-") {
    console.log(csv);
  } else {
    await fs.writeFile(path.resolve(out), csv, "utf8");
    console.error(`Wrote ${out}`);
  }
}

async function cmdRender(template: string, contactQ: string) {
  const contacts = await readContacts();
  const c = findContact(contacts, contactQ);
  if (!c) {
    console.error("Contact not found");
    process.exit(1);
  }
  const dir = path.join(crmDataDir(), "templates");
  const file = path.join(dir, `${template}.md`);
  const body = await fs.readFile(file, "utf8");
  console.log(renderTemplate(body, c));
}

async function cmdDoctor() {
  const meta = await readMeta();
  const contacts = await readContacts();
  const touches = await readTouches();
  console.log(`data_dir\t${crmDataDir()}`);
  console.log(`contacts_file\t${contactsFilePath()}`);
  console.log(`schema_version\t${meta.schema_version}`);
  console.log(`updated_at\t${meta.updated_at ?? "null"}`);
  console.log(`contacts_count\t${contacts.length}`);
  console.log(`touches_count\t${touches.length}`);
}

function parseOpts(args: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2).replace(/-/g, "_");
      const val = args[i + 1] && !args[i + 1]!.startsWith("--") ? args[++i]! : "";
      o[key] = val;
    }
  }
  return o;
}

function getFlag(args: string[], name: string): string | undefined {
  const i = args.findIndex((a) => a === `--${name}`);
  if (i === -1) return undefined;
  return args[i + 1] && !args[i + 1]!.startsWith("-") ? args[i + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    usage();
    process.exit(0);
  }

  const [cmd, ...rest] = argv;

  try {
    switch (cmd) {
      case "queue":
        await cmdQueue();
        break;
      case "show":
        await cmdShow(rest[0] ?? "");
        break;
      case "add-contact":
        await cmdAddContact(rest);
        break;
      case "log-touch": {
        const q = rest[0] ?? "";
        const summary = rest.slice(1).join(" ");
        await cmdLogTouch(q, summary);
        break;
      }
      case "set":
        await cmdSet(rest);
        break;
      case "import": {
        const sub = rest[0];
        if (sub === "csv") await cmdImportCsv(rest.slice(1));
        else if (sub === "paste") await cmdImportPaste(rest.slice(1));
        else {
          console.error("import csv|paste");
          process.exit(1);
        }
        break;
      }
      case "export": {
        if (rest[0] === "csv") await cmdExportCsv(rest.slice(1));
        else {
          console.error("export csv");
          process.exit(1);
        }
        break;
      }
      case "render": {
        const template = rest[0] ?? "";
        const ci = rest.indexOf("--contact");
        const cq = ci >= 0 ? rest[ci + 1] ?? "" : "";
        await cmdRender(template, cq);
        break;
      }
      case "doctor":
        await cmdDoctor();
        break;
      default:
        usage();
        process.exit(1);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
