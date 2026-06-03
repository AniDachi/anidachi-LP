/**
 * POST /api/openclaw/post/prepare
 *
 * Accepts multipart/form-data with:
 *   - caption            (required)  Post caption text
 *   - photos[]           (required)  2-10 PNG/JPEG images
 *   - platform           (optional)  "instagram" | "tiktok" — restrict to one platform
 *   - platforms[]         (optional)  Repeat for multiple platforms
 *   - instagramAccountIds[]  (optional)  Restrict to specific IG accounts (igUserId values)
 *   - tiktokAccountIds[]     (optional)  Restrict to specific TT accounts (openId values)
 *   Also accepts plain instagramAccountIds / tiktokAccountIds (no brackets), including repeated
 *   fields — some clients omit "[]" and the server must accept both.
 *
 * Account IDs are available from GET /api/openclaw/health (accountId field).
 *
 * Examples:
 *   # Post to one Instagram account only
 *   curl -X POST "$BASE/api/openclaw/post/prepare" \
 *     -H "x-openclaw-secret: $SECRET" \
 *     -F "platform=instagram" \
 *     -F "instagramAccountIds[]=17841400123456789" \
 *     -F "caption=Hello" \
 *     -F "photos[]=@slide1.jpg" -F "photos[]=@slide2.jpg"
 *
 *   # Post to all TikTok accounts
 *   curl -X POST "$BASE/api/openclaw/post/prepare" \
 *     -H "x-openclaw-secret: $SECRET" \
 *     -F "platform=tiktok" \
 *     -F "caption=Hello" \
 *     -F "photos[]=@slide1.jpg" -F "photos[]=@slide2.jpg"
 *
 *   # Post to all connected accounts (default)
 *   curl -X POST "$BASE/api/openclaw/post/prepare" \
 *     -H "x-openclaw-secret: $SECRET" \
 *     -F "caption=Hello" \
 *     -F "photos[]=@slide1.jpg" -F "photos[]=@slide2.jpg"
 */
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { put } from "@vercel/blob";
import {
  validateOpenClawSecret,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";
import { createJob, saveJob } from "@/lib/openclaw-jobs";
import { createCarouselChildImage } from "@/lib/instagram/graph";
import type { InstagramCredentials } from "@/lib/instagram/graph";
import {
  ensureAllCredentials as ensureAllTt,
  initInboxPhotoPost,
} from "@/lib/tiktok/api";
import type { TikTokCredentials } from "@/lib/tiktok/api";
import { getAllCredentials as getAllIgCredentials } from "@/lib/instagram/storage";
import { getAllCredentials as getAllTtCredentials } from "@/lib/tiktok/storage";
import {
  adaptCaptionForTikTok,
  summarizeTikTokCaptionTransform,
} from "@/lib/tiktok/caption";
import {
  parseAccountFilterFromFormData,
  filterIgCredentials,
  filterTtCredentials,
  validateFilteredIds,
} from "@/lib/account-selection";

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 10;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

export async function POST(request: NextRequest) {
  if (!validateOpenClawSecret(request)) {
    return unauthorizedResponse();
  }

  // Gather all connected accounts across platforms
  let igCreds: InstagramCredentials[] = [];
  let ttCreds: TikTokCredentials[] = [];
  const ttCredsConnected: TikTokCredentials[] = [];

  try { igCreds = await getAllIgCredentials(); } catch { /* none connected */ }
  try { ttCreds = await getAllTtCredentials(); } catch { /* none connected */ }
  ttCredsConnected.push(...ttCreds);

  // Auto-refresh TikTok tokens
  if (ttCreds.length > 0) {
    try { ttCreds = await ensureAllTt(); } catch { ttCreds = []; }
  }

  if (igCreds.length === 0 && ttCreds.length === 0) {
    return NextResponse.json(
      { success: false, error: "No accounts connected", code: "RECONNECT" },
      { status: 401 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid multipart body", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const caption = formData.get("caption");
  if (!caption || typeof caption !== "string" || !caption.trim()) {
    return NextResponse.json(
      { success: false, error: "Caption is required", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const photos = formData.getAll("photos[]") as File[];
  if (photos.length < MIN_PHOTOS || photos.length > MAX_PHOTOS) {
    return NextResponse.json(
      {
        success: false,
        error: `Expected ${MIN_PHOTOS}-${MAX_PHOTOS} photos, got ${photos.length}`,
        code: "INVALID_INPUT",
      },
      { status: 400 },
    );
  }

  for (const photo of photos) {
    if (!(photo instanceof File) || !ALLOWED_TYPES.includes(photo.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type: ${photo.type || "unknown"}. Use PNG or JPEG.`,
          code: "INVALID_INPUT",
        },
        { status: 400 },
      );
    }
  }

  // Optional platform filtering (platform / platforms[])
  type Platform = "instagram" | "tiktok";
  const requestedPlatforms = new Set<Platform>();
  const hasPlatformField =
    formData.has("platform") || formData.has("platforms[]");

  const addPlatformValue = (value: FormDataEntryValue) => {
    if (typeof value !== "string") return;
    const v = value.trim().toLowerCase();
    if (!v) return;
    if (v === "instagram" || v === "ig") {
      requestedPlatforms.add("instagram");
    } else if (v === "tiktok" || v === "tt") {
      requestedPlatforms.add("tiktok");
    }
  };

  const singlePlatform = formData.get("platform");
  if (singlePlatform !== null) {
    addPlatformValue(singlePlatform);
  }

  const multiPlatforms = formData.getAll("platforms[]");
  for (const value of multiPlatforms) {
    addPlatformValue(value);
  }

  if (hasPlatformField && requestedPlatforms.size === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid platform value. Use 'instagram' or 'tiktok'.",
        code: "INVALID_INPUT",
      },
      { status: 400 },
    );
  }

  if (requestedPlatforms.size > 0) {
    if (!requestedPlatforms.has("instagram")) {
      igCreds = [];
    }
    if (!requestedPlatforms.has("tiktok")) {
      ttCreds = [];
    }
  }

  if (requestedPlatforms.size > 0 && igCreds.length === 0 && ttCreds.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "No accounts connected for requested platform(s)",
        code: "RECONNECT",
      },
      { status: 401 },
    );
  }

  // Per-account filtering (instagramAccountIds[] / tiktokAccountIds[])
  const accountFilter = parseAccountFilterFromFormData(formData);
  if (accountFilter.hasAccountFilter) {
    const filteredIg = filterIgCredentials(igCreds, accountFilter.instagramAccountIds);
    const filteredTt = filterTtCredentials(ttCreds, accountFilter.tiktokAccountIds);

    const unknownIg = validateFilteredIds(
      accountFilter.instagramAccountIds,
      filteredIg.map((c) => c.igUserId),
    );
    const unknownTt = validateFilteredIds(
      accountFilter.tiktokAccountIds,
      filteredTt.map((c) => c.openId),
    );
    if (unknownIg.length > 0 || unknownTt.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown account IDs: ${[...unknownIg, ...unknownTt].join(", ")}`,
          code: "INVALID_INPUT",
        },
        { status: 400 },
      );
    }

    if (filteredIg.length === 0 && filteredTt.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No accounts selected",
          code: "INVALID_INPUT",
        },
        { status: 400 },
      );
    }

    igCreds = filteredIg;
    ttCreds = filteredTt;
  }

  if (
    accountFilter.tiktokAccountIds &&
    ttCredsConnected.length > 0 &&
    ttCreds.length < ttCredsConnected.length
  ) {
    console.warn("OpenClaw TikTok account filter reduced connected accounts", {
      requested_tiktok_open_ids: accountFilter.tiktokAccountIds,
      connected_tiktok_open_ids: ttCredsConnected.map((c) => c.openId),
      selected_tiktok_open_ids: ttCreds.map((c) => c.openId),
      connected_tiktok_usernames: ttCredsConnected.map((c) => c.username),
      selected_tiktok_usernames: ttCreds.map((c) => c.username),
    });
  }

  try {
    const allAccounts = [
      ...igCreds.map((c) => ({ platform: "instagram" as const, accountId: c.igUserId, username: c.igUsername })),
      ...ttCreds.map((c) => ({ platform: "tiktok" as const, accountId: c.openId, username: c.username })),
    ];

    const job = await createJob(caption.trim(), photos.length, allAccounts);

    // Upload to Vercel Blob (shared across all platforms)
    const date = new Date().toISOString().slice(0, 10);
    const blobUrls: string[] = [];
    const blobPaths: string[] = [];

    for (const photo of photos) {
      const ext = photo.type === "image/png" ? "png" : "jpg";
      const pathname = `openclaw/${date}/${crypto.randomUUID()}.${ext}`;
      const blob = await put(pathname, photo, {
        access: "public",
        addRandomSuffix: false,
        contentType: photo.type,
      });
      blobUrls.push(blob.url);
      blobPaths.push(pathname);
    }

    // Build proxy URLs for TikTok (domain-verified)
    const origin = request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl.origin;

    // TikTok: pad images to 9:16 (1080x1920) with dark background and convert to JPEG
    const ttBlobPaths: string[] = [];
    if (ttCreds.length > 0) {
      for (let i = 0; i < blobUrls.length; i++) {
        const res = await fetch(blobUrls[i]);
        const buffer = Buffer.from(await res.arrayBuffer());
        const metadata = await sharp(buffer).metadata();
        const targetWidth = metadata.width || 1080;
        const targetHeight = Math.round(targetWidth * (16 / 9));
        const jpegBuffer = await sharp(buffer)
          .resize(targetWidth, targetHeight, {
            fit: "contain",
            background: { r: 18, g: 28, b: 26, alpha: 1 },
          })
          .jpeg({ quality: 92 })
          .toBuffer();
        const jpegPath = `openclaw/tiktok-916/${date}/${crypto.randomUUID()}.jpg`;
        await put(jpegPath, jpegBuffer, {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/jpeg",
        });
        ttBlobPaths.push(jpegPath);
      }
    }
    const proxyUrls = (ttCreds.length > 0 ? ttBlobPaths : blobPaths).map(
      (p) => `${origin}/api/media/${p}`,
    );

    job.overallStatus = "creating_children";
    job.blobUrls = blobUrls;
    job.proxyUrls = proxyUrls;

    // Instagram: create child containers for each account
    await Promise.all(
      igCreds.map(async (creds) => {
        try {
          const acct = job.accounts.find(
            (a) => a.platform === "instagram" && a.accountId === creds.igUserId,
          )!;
          const childIds: string[] = [];
          for (const url of blobUrls) {
            const containerId = await createCarouselChildImage(creds, url);
            childIds.push(containerId);
          }
          acct.childContainerIds = childIds;
          acct.status = "polling_children";
          acct.step = `0/${photos.length} children ready`;
        } catch (err) {
          const e = err as Error & { status?: number };
          const acct = job.accounts.find(
            (a) => a.platform === "instagram" && a.accountId === creds.igUserId,
          )!;
          acct.status = "failed";
          acct.error = e.status === 401 ? "Token expired" : e.message;
          acct.step = "Failed";
        }
      }),
    );

    // TikTok: init inbox photo upload for each account
    const trimmedCaption = caption.trim();
    let ttCaption = { title: "", description: "" };
    if (ttCreds.length > 0) {
      const ttCaptionSummary = summarizeTikTokCaptionTransform(trimmedCaption);
      const isSuspiciouslyShort =
        ttCaptionSummary.captionLengthIn >= 60 &&
        ttCaptionSummary.captionLengthOut < 20;
      const isOnlyHashtag = /^#[\p{L}\p{N}_]{2,}$/u.test(trimmedCaption);

      if (isSuspiciouslyShort || isOnlyHashtag) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Caption looks invalid for TikTok (too short / only hashtag). Send the full generated caption text.",
            code: "INVALID_INPUT",
          },
          { status: 400 },
        );
      }

      ttCaption = adaptCaptionForTikTok(trimmedCaption);

      console.info("OpenClaw TikTok caption transform", {
        jobId: job.id,
        platform: "tiktok",
        caption_length_in: ttCaptionSummary.captionLengthIn,
        first_120_chars_in: ttCaptionSummary.first120In,
        title_extracted: ttCaption.title,
        caption_length_out: ttCaptionSummary.captionLengthOut,
        first_120_chars_out: ttCaptionSummary.first120Out,
        has_non_ascii: ttCaptionSummary.hasNonAscii,
        hashtags_before: ttCaptionSummary.hashtagsIn,
        hashtags_after: ttCaptionSummary.hashtagsOut,
      });

      if (isSuspiciouslyShort) {
        console.warn("OpenClaw TikTok caption transform suspiciously short", {
          jobId: job.id,
          caption_length_in: ttCaptionSummary.captionLengthIn,
          caption_length_out: ttCaptionSummary.captionLengthOut,
        });
      }
    }

    await Promise.all(
      ttCreds.map(async (creds) => {
        try {
          const publishId = await initInboxPhotoPost(
            creds,
            proxyUrls,
            ttCaption.title,
            ttCaption.description,
          );
          const acct = job.accounts.find(
            (a) => a.platform === "tiktok" && a.accountId === creds.openId,
          )!;
          acct.publishId = publishId;
          acct.status = "publishing";
          acct.step = "Uploading to TikTok inbox";
        } catch (err) {
          const e = err as Error & { status?: number };
          const acct = job.accounts.find(
            (a) => a.platform === "tiktok" && a.accountId === creds.openId,
          )!;
          acct.status = "failed";
          acct.error = e.status === 401 ? "Token expired" : e.message;
          acct.step = "Failed";
        }
      }),
    );

    job.overallStatus = "processing";
    await saveJob(job);

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: "processing",
        accounts: job.accounts.map((a) => ({
          platform: a.platform,
          accountId: a.accountId,
          username: a.username,
          status: a.status,
          step: a.step,
        })),
      },
      { status: 202 },
    );
  } catch (err) {
    const e = err as Error & { status?: number };
    console.error("OpenClaw post prepare error:", e);
    if (e.status === 401) {
      return NextResponse.json(
        { success: false, error: "Token expired — reconnect accounts", code: "RECONNECT" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to prepare post", code: "PREPARE_FAILED" },
      { status: 500 },
    );
  }
}
