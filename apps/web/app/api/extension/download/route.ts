import { after, type NextRequest, NextResponse } from "next/server";
import {
  amplitudeDeviceIdFromCookieHeader,
  clientIpFromRequest,
  trackAmplitudeServerEvent,
} from "@/lib/amplitude-server";
import { getExtensionArtifact } from "@/lib/extension-artifact";
import { INSTALL_HUB_PATH } from "@/lib/install-cta";

export const dynamic = "force-dynamic";

function scheduleZipDownloadEvent(
  request: NextRequest,
  artifact: ReturnType<typeof getExtensionArtifact>,
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
        via: "url",
        bytes: artifact.bytes,
      },
    }),
  );
}

export async function GET(request: NextRequest) {
  const artifact = getExtensionArtifact();

  if (!artifact.available || !artifact.sourceUrl) {
    console.warn("[extension-download] Zip is not configured");
    return NextResponse.json(
      { error: "The extension zip is not published yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  console.info("[extension-download]", {
    version: artifact.version,
    filename: artifact.filename,
    via: "url",
    ua: request.headers.get("user-agent")?.slice(0, 180) ?? null,
    referer: request.headers.get("referer") ?? null,
  });

  if (request.method === "GET") {
    scheduleZipDownloadEvent(request, artifact);
  }
  const response = NextResponse.redirect(artifact.sourceUrl, 302);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
