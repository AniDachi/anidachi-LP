export const MAX_PUBLIC_MEDIA_BYTES = 100 * 1024 * 1024;

const PUBLIC_MEDIA_CACHE_CONTROL = "public, max-age=86400";
const DATE_SEGMENT = /^\d{4}-\d{2}-\d{2}$/;
const UUID_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z0-9]+)$/i;

type Blob200 = {
  statusCode: 200;
  stream: ReadableStream<Uint8Array>;
  blob: {
    pathname: string;
    contentType: string;
    size: number;
    etag: string;
    cacheControl: string;
  };
};

type Blob304 = {
  statusCode: 304;
  stream: null;
  blob: {
    pathname: string;
    contentType: null;
    size: null;
    etag: string;
    cacheControl: string;
  };
};

export type PublicMediaBlobGet = (
  pathname: string,
  options: {
    access: "public";
    token: string;
    ifNoneMatch: string | undefined;
  },
) => Promise<Blob200 | Blob304 | null>;

type ParsedPublicMedia = {
  pathname: string;
  allowedContentTypes: ReadonlySet<string>;
};

const JPEG_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg"]);
const PNG_CONTENT_TYPES = new Set(["image/png"]);
const MP4_CONTENT_TYPES = new Set(["video/mp4", "video/quicktime"]);
const MOV_CONTENT_TYPES = new Set(["video/quicktime", "video/mp4"]);

function isCanonicalDate(value: string): boolean {
  if (!DATE_SEGMENT.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function contentTypesForExtension(extension: string): ReadonlySet<string> | null {
  switch (extension.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return JPEG_CONTENT_TYPES;
    case "png":
      return PNG_CONTENT_TYPES;
    case "mp4":
      return MP4_CONTENT_TYPES;
    case "mov":
      return MOV_CONTENT_TYPES;
    default:
      return null;
  }
}

function hasUnsafePathEncoding(path: readonly string[]): boolean {
  return path.some(
    (segment) =>
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      segment.includes("\\") ||
      segment.includes("%") ||
      segment.includes("\0"),
  );
}

export function parsePublicMediaPath(
  path: readonly string[],
): ParsedPublicMedia | null {
  if (hasUnsafePathEncoding(path)) return null;

  let date: string;
  let filename: string;
  let allowedExtensions: ReadonlySet<string>;

  if (path[0] === "blou" && path.length === 3) {
    [, date, filename] = path;
    allowedExtensions = new Set(["jpg", "jpeg", "png", "mp4", "mov"]);
  } else if (
    path[0] === "blou" &&
    (path[1] === "tiktok-916" || path[1] === "tiktok-jpg") &&
    path.length === 4
  ) {
    [, , date, filename] = path;
    allowedExtensions = new Set(["jpg"]);
  } else if (path[0] === "openclaw" && path.length === 3) {
    [, date, filename] = path;
    allowedExtensions = new Set(["jpg", "png"]);
  } else if (
    path[0] === "openclaw" &&
    path[1] === "tiktok-916" &&
    path.length === 4
  ) {
    [, , date, filename] = path;
    allowedExtensions = new Set(["jpg"]);
  } else if (
    path[0] === "openclaw" &&
    path[1] === "video" &&
    path.length === 4
  ) {
    [, , date, filename] = path;
    allowedExtensions = new Set(["mp4"]);
  } else {
    return null;
  }

  if (!isCanonicalDate(date)) return null;
  const match = UUID_FILE.exec(filename);
  if (!match) return null;
  const extension = match[2].toLowerCase();
  if (!allowedExtensions.has(extension)) return null;
  const allowedContentTypes = contentTypesForExtension(extension);
  if (!allowedContentTypes) return null;

  return {
    pathname: path.join("/"),
    allowedContentTypes,
  };
}

function jsonResponse(status: number, error: string): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function publicHeaders(etag: string): Headers {
  const headers = new Headers({
    "Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
  });
  if (etag) headers.set("ETag", etag);
  return headers;
}

async function discardStream(stream: ReadableStream<Uint8Array>): Promise<void> {
  await stream.cancel().catch(() => undefined);
}

export async function servePublicMedia(input: {
  request: Request;
  path: readonly string[];
  token: string | null | undefined;
  getBlob: PublicMediaBlobGet;
}): Promise<Response> {
  const media = parsePublicMediaPath(input.path);
  if (!media) return jsonResponse(404, "Not found");
  if (!input.token) return jsonResponse(503, "Blob storage not configured");

  try {
    const result = await input.getBlob(media.pathname, {
      access: "public",
      token: input.token,
      ifNoneMatch: input.request.headers.get("if-none-match") ?? undefined,
    });
    if (!result || result.blob.pathname !== media.pathname) {
      return jsonResponse(404, "Not found");
    }

    if (result.statusCode === 304) {
      return new Response(null, {
        status: 304,
        headers: publicHeaders(result.blob.etag),
      });
    }

    if (
      !Number.isSafeInteger(result.blob.size) ||
      result.blob.size <= 0 ||
      result.blob.size > MAX_PUBLIC_MEDIA_BYTES ||
      !media.allowedContentTypes.has(result.blob.contentType.toLowerCase())
    ) {
      await discardStream(result.stream);
      return jsonResponse(404, "Not found");
    }

    const headers = publicHeaders(result.blob.etag);
    headers.set("Content-Type", result.blob.contentType.toLowerCase());
    headers.set("Content-Length", result.blob.size.toString());
    return new Response(result.stream, { status: 200, headers });
  } catch {
    return jsonResponse(404, "Not found");
  }
}
