import { NextRequest, NextResponse } from "next/server";
import { get as blobGet } from "@vercel/blob";

const BLOB_ACCESS = (process.env.BLOB_ACCESS ?? "private") as "public" | "private";

/**
 * Media proxy: serves Vercel Blob files through our own domain so that
 * TikTok's PULL_FROM_URL can access them from a verified domain.
 *
 * GET /api/media/openclaw/2026-03-04/uuid.png
 *   -> streams the Blob file at that path
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const blobPath = path.join("/");

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Blob storage not configured" },
      { status: 503 },
    );
  }

  try {
    const result = await blobGet(blobPath, { access: BLOB_ACCESS, token });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contentType =
      blobPath.endsWith(".png") ? "image/png"
      : blobPath.endsWith(".jpg") || blobPath.endsWith(".jpeg") ? "image/jpeg"
      : blobPath.endsWith(".mp4") ? "video/mp4"
      : blobPath.endsWith(".mov") ? "video/quicktime"
      : blobPath.endsWith(".webp") ? "image/webp"
      : "application/octet-stream";

    return new NextResponse(result.stream as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("Media proxy error:", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
