import {
  readKreatliCrmBlobText,
  updateKreatliCrmBlobText,
} from "@/lib/private-integration-blob";

export async function appendPrivateBlobJsonlLine(
  blobPath: string,
  line: string,
): Promise<void> {
  await updateKreatliCrmBlobText(blobPath, (current) => {
    const existing = current ?? "";
    return existing
      ? existing.endsWith("\n")
        ? `${existing}${line}\n`
        : `${existing}\n${line}\n`
      : `${line}\n`;
  });
}

export async function readPrivateBlobJsonlText(
  blobPath: string,
): Promise<string> {
  return (await readKreatliCrmBlobText(blobPath)) ?? "";
}
