export type ExtensionArtifact = {
  available: boolean;
  version: string;
  sha256: string | null;
  bytes: number | null;
  filename: string;
  /** Private blob/CDN URL. Never send this to the browser; download via /api/extension/download. */
  sourceUrl: string | null;
  /** Server-only filesystem path from env. Never send this to the browser. */
  zipPath: string | null;
};

const DEFAULT_VERSION = "0.1.0";

function parsePositiveInt(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseSha256(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(trimmed)) return null;
  return trimmed;
}

export function getExtensionArtifact(): ExtensionArtifact {
  const version =
    process.env.EXTENSION_ZIP_VERSION?.trim() || DEFAULT_VERSION;
  const sourceUrl = process.env.EXTENSION_ZIP_URL?.trim() || null;
  const zipPath = process.env.EXTENSION_ZIP_PATH?.trim() || null;
  const sha256 = parseSha256(process.env.EXTENSION_ZIP_SHA256);
  const bytes = parsePositiveInt(process.env.EXTENSION_ZIP_BYTES);
  const filename = `anidachi-chrome-extension-${version}.zip`;

  return {
    available: Boolean(sourceUrl || zipPath),
    version,
    sha256,
    bytes,
    filename,
    sourceUrl,
    zipPath,
  };
}

export function formatZipBytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type PublicExtensionArtifact = Omit<
  ExtensionArtifact,
  "sourceUrl" | "zipPath"
>;

export function toPublicExtensionArtifact(
  artifact: ExtensionArtifact,
): PublicExtensionArtifact {
  const { sourceUrl: _sourceUrl, zipPath: _zipPath, ...rest } = artifact;
  return rest;
}
