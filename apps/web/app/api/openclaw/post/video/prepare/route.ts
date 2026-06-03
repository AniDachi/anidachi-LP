/**
 * POST /api/openclaw/post/video/prepare
 *
 * Accepts multipart/form-data with:
 *   - caption            (required)  Post caption text
 *   - video              (required)  Single MP4 video file
 *   - platform           (optional)  "instagram" | "tiktok" — restrict to one platform
 *   - platforms[]         (optional)  Repeat for multiple platforms
 *   - instagramAccountIds (optional)  Restrict to specific IG accounts (igUserId values)
 *   - tiktokAccountIds    (optional)  Restrict to specific TT accounts (openId values)
 *
 * Account IDs are available from GET /api/openclaw/health (accountId field).
 *
 * Examples:
 *   # Post video to all Instagram accounts
 *   curl -X POST "$BASE/api/openclaw/post/video/prepare" \
 *     -H "x-openclaw-secret: $SECRET" \
 *     -F "platform=instagram" \
 *     -F "caption=Hello" \
 *     -F "video=@reel_final.mp4"
 *
 *   # Post video to all TikTok accounts
 *   curl -X POST "$BASE/api/openclaw/post/video/prepare" \
 *     -H "x-openclaw-secret: $SECRET" \
 *     -F "platform=tiktok" \
 *     -F "caption=Hello" \
 *     -F "video=@reel_final.mp4"
 *
 *   # Post video to all connected accounts (default)
 *   curl -X POST "$BASE/api/openclaw/post/video/prepare" \
 *     -H "x-openclaw-secret: $SECRET" \
 *     -F "caption=Hello" \
 *     -F "video=@reel_final.mp4"
 */
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  validateOpenClawSecret,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";
import { createJob, saveJob } from "@/lib/openclaw-jobs";
import { createReelContainer } from "@/lib/instagram/graph";
import type { InstagramCredentials } from "@/lib/instagram/graph";
import {
  ensureAllCredentials as ensureAllTt,
  initInboxVideoPost,
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

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(request: NextRequest) {
  if (!validateOpenClawSecret(request)) {
    return unauthorizedResponse();
  }

  let igCreds: InstagramCredentials[] = [];
  let ttCreds: TikTokCredentials[] = [];
  const ttCredsConnected: TikTokCredentials[] = [];

  try { igCreds = await getAllIgCredentials(); } catch { /* none connected */ }
  try { ttCreds = await getAllTtCredentials(); } catch { /* none connected */ }
  ttCredsConnected.push(...ttCreds);

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

  const video = formData.get("video") as File | null;
  if (!video || !(video instanceof File)) {
    return NextResponse.json(
      { success: false, error: "A single video file is required (field: video)", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  if (!ALLOWED_VIDEO_TYPES.includes(video.type) && !video.name.endsWith(".mp4")) {
    return NextResponse.json(
      { success: false, error: `Invalid video type: ${video.type || "unknown"}. Use MP4.`, code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  if (video.size > MAX_VIDEO_SIZE) {
    return NextResponse.json(
      { success: false, error: `Video too large (${(video.size / 1024 / 1024).toFixed(1)}MB). Max 100MB.`, code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  // --- Platform filtering ---
  type Platform = "instagram" | "tiktok";
  const requestedPlatforms = new Set<Platform>();
  const hasPlatformField = formData.has("platform") || formData.has("platforms[]");

  const addPlatformValue = (value: FormDataEntryValue) => {
    if (typeof value !== "string") return;
    const v = value.trim().toLowerCase();
    if (v === "instagram" || v === "ig") requestedPlatforms.add("instagram");
    else if (v === "tiktok" || v === "tt") requestedPlatforms.add("tiktok");
  };

  const singlePlatform = formData.get("platform");
  if (singlePlatform !== null) addPlatformValue(singlePlatform);
  for (const value of formData.getAll("platforms[]")) addPlatformValue(value);

  if (hasPlatformField && requestedPlatforms.size === 0) {
    return NextResponse.json(
      { success: false, error: "Invalid platform value. Use 'instagram' or 'tiktok'.", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  if (requestedPlatforms.size > 0) {
    if (!requestedPlatforms.has("instagram")) igCreds = [];
    if (!requestedPlatforms.has("tiktok")) ttCreds = [];
  }

  if (requestedPlatforms.size > 0 && igCreds.length === 0 && ttCreds.length === 0) {
    return NextResponse.json(
      { success: false, error: "No accounts connected for requested platform(s)", code: "RECONNECT" },
      { status: 401 },
    );
  }

  // --- Per-account filtering ---
  const accountFilter = parseAccountFilterFromFormData(formData);
  if (accountFilter.hasAccountFilter) {
    const filteredIg = filterIgCredentials(igCreds, accountFilter.instagramAccountIds);
    const filteredTt = filterTtCredentials(ttCreds, accountFilter.tiktokAccountIds);

    const unknownIg = validateFilteredIds(accountFilter.instagramAccountIds, filteredIg.map((c) => c.igUserId));
    const unknownTt = validateFilteredIds(accountFilter.tiktokAccountIds, filteredTt.map((c) => c.openId));
    if (unknownIg.length > 0 || unknownTt.length > 0) {
      return NextResponse.json(
        { success: false, error: `Unknown account IDs: ${[...unknownIg, ...unknownTt].join(", ")}`, code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    if (filteredIg.length === 0 && filteredTt.length === 0) {
      return NextResponse.json(
        { success: false, error: "No accounts selected", code: "INVALID_INPUT" },
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

    const job = await createJob(caption.trim(), 0, allAccounts, "video");

    // Upload video to Vercel Blob
    const date = new Date().toISOString().slice(0, 10);
    const pathname = `openclaw/video/${date}/${crypto.randomUUID()}.mp4`;
    const blob = await put(pathname, video, {
      access: "public",
      addRandomSuffix: false,
      contentType: video.type || "video/mp4",
    });

    const origin = request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl.origin;

    const proxyUrl = `${origin}/api/media/${pathname}`;

    job.videoUrl = blob.url;
    job.videoProxyUrl = proxyUrl;

    // Instagram: create Reel container for each account
    await Promise.all(
      igCreds.map(async (creds) => {
        try {
          const acct = job.accounts.find(
            (a) => a.platform === "instagram" && a.accountId === creds.igUserId,
          )!;
          const containerId = await createReelContainer(creds, blob.url, caption.trim());
          acct.reelContainerId = containerId;
          acct.status = "polling_reel";
          acct.step = "Reel container created, waiting for processing";
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

    // TikTok: init inbox video upload for each account
    const trimmedCaption = caption.trim();
    const ttCaption = adaptCaptionForTikTok(trimmedCaption);
    const ttCaptionSummary = summarizeTikTokCaptionTransform(trimmedCaption);
    const isSuspiciouslyShort =
      ttCaptionSummary.captionLengthIn >= 60 &&
      ttCaptionSummary.captionLengthOut < 20;
    const isOnlyHashtag = /^#[\p{L}\p{N}_]{2,}$/u.test(trimmedCaption);

    if (ttCreds.length > 0 && (isSuspiciouslyShort || isOnlyHashtag)) {
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

    await Promise.all(
      ttCreds.map(async (creds) => {
        try {
          const publishId = await initInboxVideoPost(
            creds,
            proxyUrl,
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
    console.error("OpenClaw video prepare error:", e);
    if (e.status === 401) {
      return NextResponse.json(
        { success: false, error: "Token expired — reconnect accounts", code: "RECONNECT" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to prepare video post", code: "PREPARE_FAILED" },
      { status: 500 },
    );
  }
}
