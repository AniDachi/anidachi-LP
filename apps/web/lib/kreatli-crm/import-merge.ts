import { randomUUID } from "crypto";
import type { Contact } from "./types";
import { isValidEmail, normalizeEmail } from "./validation";

export type ImportMergeMode = "skip" | "upsert";

export type ParsedImportRow = {
  email: string;
  company: string;
  first_name: string;
  segments: string[];
  notes: string;
};

export type ImportPreviewLine = {
  email: string;
  action: "create" | "skip" | "update";
  detail: string;
  company?: string;
  first_name?: string;
};

function parseDelimitedLine(line: string, delimiter: string): string[] {
  if (delimiter === "\t") {
    return line.split("\t").map((c) => c.trim().replace(/^"|"$/g, ""));
  }
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === delimiter) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs >= commas ? "\t" : ",";
}

function mapHeaderToField(h: string): keyof ParsedImportRow | null {
  const n = h.trim().toLowerCase().replace(/\s+/g, "_");
  if (n.includes("email") || n === "e-mail") return "email";
  if (n.includes("company") || n.includes("org") || n.includes("business"))
    return "company";
  if (
    n.includes("first") ||
    n === "name" ||
    n.includes("first_name") ||
    n.includes("firstname")
  )
    return "first_name";
  if (n.includes("segment") || n.includes("tag") || n.includes("vertical"))
    return "segments";
  if (n.includes("note")) return "notes";
  return null;
}

function guessEmailColumn(matrix: string[][]): number {
  const cols = Math.max(0, ...matrix.map((r) => r.length));
  let best = 0;
  let bestScore = -1;
  for (let col = 0; col < cols; col++) {
    let hits = 0;
    let total = 0;
    for (const row of matrix) {
      const cell = row[col]?.trim() ?? "";
      if (!cell) continue;
      total++;
      if (isValidEmail(cell)) hits++;
    }
    const score = total ? hits / total : 0;
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return best;
}

function rowLooksLikeHeader(row: string[]): boolean {
  const joined = row.join(" ").toLowerCase();
  if (/\bemail\b/i.test(joined)) return true;
  if (row.some((c) => mapHeaderToField(c) !== null)) return true;
  return false;
}

/** Parse pasted CSV/TSV into import rows. */
export function parseImportText(text: string): ParsedImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]!);
  const matrix = lines.map((line) => parseDelimitedLine(line, delimiter));
  const out: ParsedImportRow[] = [];

  let dataMatrix = matrix;
  let colMap: Partial<Record<keyof ParsedImportRow, number>> | null = null;

  if (matrix.length > 0 && rowLooksLikeHeader(matrix[0]!)) {
    const header = matrix[0]!;
    colMap = {};
    header.forEach((h, i) => {
      const f = mapHeaderToField(h);
      if (f && colMap![f] === undefined) colMap![f] = i;
    });
    dataMatrix = matrix.slice(1);
  }

  if (colMap && colMap.email !== undefined) {
    for (const row of dataMatrix) {
      const emailRaw = row[colMap.email!] ?? "";
      const email = normalizeEmail(emailRaw);
      if (!isValidEmail(email)) continue;

      const company =
        colMap.company !== undefined ? row[colMap.company] ?? "" : "";
      const first_name =
        colMap.first_name !== undefined ? row[colMap.first_name] ?? "" : "";
      const segRaw =
        colMap.segments !== undefined ? row[colMap.segments] ?? "" : "";
      const segments = segRaw
        ? segRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
        : [];
      const notes = colMap.notes !== undefined ? row[colMap.notes] ?? "" : "";

      out.push({ email, company, first_name, segments, notes });
    }
    return out;
  }

  const emailCol = guessEmailColumn(dataMatrix);
  for (const row of dataMatrix) {
    const email = normalizeEmail(row[emailCol] ?? "");
    if (!isValidEmail(email)) continue;
    const rest = row.filter((_, i) => i !== emailCol);
    out.push({
      email,
      company: rest[0] ?? "",
      first_name: rest[1] ?? "",
      segments: [],
      notes: rest.slice(2).join(" ").trim(),
    });
  }
  return out;
}

function mergeSegments(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

export function buildImportPreview(
  existing: Contact[],
  parsed: ParsedImportRow[],
  mode: ImportMergeMode
): { preview: ImportPreviewLine[]; nextContacts: Contact[] } {
  const next = existing.map((c) => ({ ...c }));
  const idxByEmail = new Map(next.map((c, i) => [c.email, i]));
  const preview: ImportPreviewLine[] = [];
  const now = new Date().toISOString();

  for (const row of parsed) {
    if (!row.email || !isValidEmail(row.email)) {
      preview.push({
        email: row.email || "(empty)",
        action: "skip",
        detail: "Invalid email",
      });
      continue;
    }

    const idx = idxByEmail.get(row.email);
    if (idx === undefined) {
      const contact: Contact = {
        id: randomUUID(),
        email: row.email,
        company: row.company,
        first_name: row.first_name,
        segments: row.segments,
        notes: row.notes,
        status: "active",
        next_action_date: null,
        created_at: now,
        updated_at: now,
      };
      next.push(contact);
      idxByEmail.set(row.email, next.length - 1);
      preview.push({
        email: row.email,
        action: "create",
        detail: "New contact",
        company: row.company,
        first_name: row.first_name,
      });
      continue;
    }

    if (mode === "skip") {
      preview.push({
        email: row.email,
        action: "skip",
        detail: "Already exists",
      });
      continue;
    }

    const cur = next[idx]!;
    const merged: Contact = {
      ...cur,
      company: cur.company.trim() ? cur.company : row.company || cur.company,
      first_name: cur.first_name.trim()
        ? cur.first_name
        : row.first_name || cur.first_name,
      notes: cur.notes.trim() ? cur.notes : row.notes || cur.notes,
      segments: mergeSegments(cur.segments, row.segments),
      updated_at: now,
    };
    next[idx] = merged;
    preview.push({
      email: row.email,
      action: "update",
      detail: "Filled empty fields; merged segments",
      company: merged.company,
      first_name: merged.first_name,
    });
  }

  return { preview, nextContacts: next };
}

export function contactsToCsv(contacts: Contact[]): string {
  const header = [
    "email",
    "company",
    "first_name",
    "segments",
    "notes",
    "status",
    "next_action_date",
    "id",
  ];
  const esc = (s: string) => {
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const c of contacts) {
    lines.push(
      [
        esc(c.email),
        esc(c.company),
        esc(c.first_name),
        esc(c.segments.join(";")),
        esc(c.notes),
        esc(c.status),
        esc(c.next_action_date ?? ""),
        esc(c.id),
      ].join(",")
    );
  }
  return lines.join("\n");
}
