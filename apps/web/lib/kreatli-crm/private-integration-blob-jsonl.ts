import {
  readPrivateIntegrationBlobText,
  writePrivateIntegrationBlobText,
} from "@/lib/private-integration-blob";

export async function appendPrivateBlobJsonlLine(
  blobPath: string,
  line: string,
): Promise<void> {
  const existing = await readPrivateBlobJsonlText(blobPath);
  const next = existing
    ? existing.endsWith("\n")
      ? `${existing}${line}\n`
      : `${existing}\n${line}\n`
    : `${line}\n`;
  await writePrivateIntegrationBlobText(blobPath, next);
}

export async function readPrivateBlobJsonlText(
  blobPath: string,
): Promise<string> {
  return (await readPrivateIntegrationBlobText(blobPath)) ?? "";
}
