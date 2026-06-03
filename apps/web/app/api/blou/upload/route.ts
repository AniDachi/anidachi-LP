import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"]; // MOV
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file

function getExtension(mime: string, filename?: string): string {
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext && ["jpg", "jpeg", "png", "webp", "mp4", "mov"].includes(ext)) return ext;
  }
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/mp4") return "mp4";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
}

export async function POST(request: NextRequest) {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Upload not configured (BLOB_READ_WRITE_TOKEN)" },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("file") as File[];
    if (!files.length) {
      const single = formData.get("file") as File | null;
      const fileList = single ? [single] : [];
      if (!fileList.length) {
        return NextResponse.json(
          { error: "No file(s) provided" },
          { status: 400 }
        );
      }
      return await uploadFiles(fileList);
    }
    return await uploadFiles(files);
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Upload failed: ${err.message}`
            : "Upload failed",
      },
      { status: 500 }
    );
  }
}

async function uploadFiles(files: File[]) {
  const date = new Date().toISOString().slice(0, 10);
  const results: { url: string }[] = [];

  for (const file of files) {
    const mime = file.type;
    const allowed =
      ALLOWED_IMAGE_TYPES.includes(mime) || ALLOWED_VIDEO_TYPES.includes(mime);
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.name}. Use JPEG/PNG for images or MP4/MOV for video.`,
        },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large: ${file.name} (max 100 MB)` },
        { status: 400 }
      );
    }

    const ext = getExtension(mime, file.name);
    const pathname = `blou/${date}/${crypto.randomUUID()}.${ext}`;

    try {
      const blob = await put(pathname, file, {
        access: "public",
        addRandomSuffix: false,
        contentType: mime,
      });
      results.push({ url: blob.url });
    } catch (err) {
      console.error("Blob put() error:", err);
      throw err;
    }
  }

  if (results.length === 1) {
    return NextResponse.json({ url: results[0].url });
  }
  return NextResponse.json({ urls: results.map((r) => r.url) });
}
