export type ExtensionArtifact = {
  available: boolean;
  version: string;
  sha256: string | null;
  bytes: number | null;
  filename: string;
  /** Public HTTPS artifact URL. Omitted from page metadata, visible in the download redirect. */
  sourceUrl: string | null;
};

const DEFAULT_VERSION = "0.1.0";

function parsePositiveInt(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

function parseVersion(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length > 80) return null;
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/.test(trimmed)
    ? trimmed
    : null;
}

function parseSourceUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!/^https:\/\//i.test(trimmed) || /[\u0000-\u0020\u007f\\]/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}

function parseSha256(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(trimmed)) return null;
  return trimmed;
}

export function getExtensionArtifact(): ExtensionArtifact {
  const configuredVersion = parseVersion(process.env.EXTENSION_ZIP_VERSION);
  const version = configuredVersion ?? DEFAULT_VERSION;
  const sourceUrl = parseSourceUrl(process.env.EXTENSION_ZIP_URL);
  const sha256 = parseSha256(process.env.EXTENSION_ZIP_SHA256);
  const bytes = parsePositiveInt(process.env.EXTENSION_ZIP_BYTES);
  const filename = `anidachi-chrome-extension-${version}.zip`;

  return {
    // Configuration readiness only. Release acceptance verifies the hosted bytes;
    // rendering a page must not download or hash the archive on every request.
    available: Boolean(sourceUrl && configuredVersion && sha256 && bytes),
    version,
    sha256,
    bytes,
    filename,
    sourceUrl,
  };
}

export function formatZipBytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type PublicExtensionArtifact = Omit<
  ExtensionArtifact,
  "sourceUrl"
>;

export function toPublicExtensionArtifact(
  artifact: ExtensionArtifact,
): PublicExtensionArtifact {
  const { sourceUrl: _sourceUrl, ...rest } = artifact;
  return rest;
}
