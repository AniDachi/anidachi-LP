import { createReadStream, existsSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { Readable } from "node:stream";
import { after, type NextRequest, NextResponse } from "next/server";
import {
  amplitudeDeviceIdFromCookieHeader,
  clientIpFromRequest,
  trackAmplitudeServerEvent,
} from "@/lib/amplitude-server";
import { getExtensionArtifact } from "@/lib/extension-artifact";
import { INSTALL_HUB_PATH } from "@/lib/install-cta";

export const dynamic = "force-dynamic";

function findRepoRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, join(cwd, ".."), join(cwd, "../..")];
  for (const dir of candidates) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
  }
  return cwd;
}

function existingFile(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  return existsSync(path.trim()) ? path.trim() : null;
}

function scheduleZipDownloadEvent(
  request: NextRequest,
  artifact: ReturnType<typeof getExtensionArtifact>,
  via: "local" | "url",
) {
  let pagePath = INSTALL_HUB_PATH;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      pagePath = new URL(referer).pathname || INSTALL_HUB_PATH;
    } catch {
      pagePath = INSTALL_HUB_PATH;
    }
  }

  after(() =>
    trackAmplitudeServerEvent({
      eventType: "extension_zip_download",
      insertId: request.nextUrl.searchParams.get("iid"),
      deviceId: amplitudeDeviceIdFromCookieHeader(
        request.headers.get("cookie"),
      ),
      ip: clientIpFromRequest(request.headers),
      userAgent: request.headers.get("user-agent"),
      properties: {
        page_path: pagePath,
        page_template: "install",
        placement: "download_api",
        cta_variant: "zip_button",
        extension_version: artifact.version,
        filename: artifact.filename,
        via,
        bytes: artifact.bytes,
      },
    }),
  );
}

function resolveZipFile(filename: string, zipPath: string | null): string | null {
  if (zipPath) {
    const candidate = isAbsolute(zipPath) ? zipPath : join(process.cwd(), zipPath);
    const found = existingFile(candidate);
    if (found) return found;
    console.warn("[extension-download] EXTENSION_ZIP_PATH does not exist", {
      path: candidate,
    });
  }

  const repoRoot = findRepoRoot();
  return (
    existingFile(join(repoRoot, "artifacts", filename)) ??
    existingFile(join(process.cwd(), "artifacts", filename)) ??
    existingFile(join(process.cwd(), "private/extension", filename))
  );
}

export async function GET(request: NextRequest) {
  const artifact = getExtensionArtifact();
  const localFile = resolveZipFile(artifact.filename, artifact.zipPath);

  if (!artifact.available && !localFile) {
    console.warn("[extension-download] Zip is not configured");
    return NextResponse.json(
      { error: "The extension zip is not published yet." },
      { status: 503 },
    );
  }

  console.info("[extension-download]", {
    version: artifact.version,
    filename: artifact.filename,
    via: localFile ? "local" : "url",
    ua: request.headers.get("user-agent")?.slice(0, 180) ?? null,
    referer: request.headers.get("referer") ?? null,
  });

  if (localFile) {
    if (request.method === "GET") {
      scheduleZipDownloadEvent(request, artifact, "local");
    }
    const size = statSync(localFile).size;
    const stream = createReadStream(localFile);
    const headers = new Headers({
      "Content-Type": "application/zip",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${artifact.filename}"`,
      "Cache-Control": "no-store",
    });
    if (artifact.sha256) {
      headers.set("X-Checksum-SHA256", artifact.sha256);
    }
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers,
    });
  }

  if (!artifact.sourceUrl) {
    console.warn("[extension-download] Zip URL is not configured");
    return NextResponse.json(
      { error: "The extension zip is not published yet." },
      { status: 503 },
    );
  }

  if (request.method === "GET") {
    scheduleZipDownloadEvent(request, artifact, "url");
  }
  const response = NextResponse.redirect(artifact.sourceUrl, 302);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
