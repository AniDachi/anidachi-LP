import { NextRequest } from "next/server";
import { get as blobGet } from "@vercel/blob";
import { servePublicMedia } from "@/lib/public-media-blob";

/**
 * Media proxy: serves Vercel Blob files through our own domain so that
 * TikTok's PULL_FROM_URL can access them from a verified domain.
 *
 * GET /api/media/openclaw/2026-03-04/uuid.png
 *   -> streams the Blob file at that path
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return servePublicMedia({
    request,
    path,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    getBlob: blobGet,
  });
}
