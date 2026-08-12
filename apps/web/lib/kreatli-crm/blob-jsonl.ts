import { get as blobGet, list as blobList, put as blobPut } from "@vercel/blob";

/**
 * Append one JSONL line to a public Vercel Blob path without wiping prior
 * lines when a read fails. Missing blob => start fresh; read errors throw.
 */
export async function appendPublicBlobJsonlLine(
  blobPath: string,
  line: string,
  token: string,
): Promise<void> {
  const existing = await readPublicBlobJsonlText(blobPath, token);
  const next = existing
    ? existing.endsWith("\n")
      ? `${existing}${line}\n`
      : `${existing}\n${line}\n`
    : `${line}\n`;
  await blobPut(blobPath, next, {
    access: "public",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/** Read public Blob JSONL text. Missing blob => "". Throws if blob exists but unreadable. */
export async function readPublicBlobJsonlText(
  blobPath: string,
  token: string,
): Promise<string> {
  const result = await blobGet(blobPath, { access: "public", token });
  if (!result) {
    const listed = await blobList({ prefix: blobPath, token });
    const exists = listed.blobs.some((b) => b.pathname === blobPath);
    if (exists) {
      throw new Error(
        `Blob ${blobPath} exists but get() returned null — refusing overwrite`,
      );
    }
    return "";
  }
  return await new Response(result.stream).text();
}
