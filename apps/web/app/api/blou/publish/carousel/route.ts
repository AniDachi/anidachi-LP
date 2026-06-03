import { NextRequest, NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";
import sharp from "sharp";
import { put } from "@vercel/blob";
import {
  ensureAllCredentials as ensureAllIg,
  createCarouselChildImage,
  createCarouselChildVideo,
  createCarouselParent,
  pollContainerUntilFinished,
  publishContainer,
} from "@/lib/instagram/graph";
import type { InstagramCredentials } from "@/lib/instagram/graph";
import { getAllCredentials as getAllTtCredentials } from "@/lib/tiktok/storage";
import {
  initInboxPhotoPost,
  refreshIfNeeded,
  fetchPublishStatus,
} from "@/lib/tiktok/api";
import type { TikTokCredentials } from "@/lib/tiktok/api";
import {
  adaptCaptionForTikTok,
  summarizeTikTokCaptionTransform,
} from "@/lib/tiktok/caption";
import {
  parseAccountFilterFromJson,
  filterIgCredentials,
  filterTtCredentials,
  validateFilteredIds,
} from "@/lib/account-selection";

const MIN_ITEMS = 2;
const MAX_ITEMS = 10;
const TT_POLL_INTERVAL_MS = 3000;
const TT_POLL_TIMEOUT_MS = 2 * 60 * 1000;

async function prepareTikTokImages(blobUrls: string[]): Promise<string[]> {
  const result: string[] = [];
  for (const url of blobUrls) {
    const res = await fetch(url);
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
    const date = new Date().toISOString().slice(0, 10);
    const pathname = `blou/tiktok-916/${date}/${crypto.randomUUID()}.jpg`;
    const blob = await put(pathname, jpegBuffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/jpeg",
    });
    result.push(blob.url);
  }
  return result;
}

interface AccountResult {
  platform: "instagram" | "tiktok";
  accountId: string;
  username: string;
  success: boolean;
  mediaId?: string;
  status?: string;
  error?: string;
  needsReconnect?: boolean;
}

async function publishToIgAccount(
  creds: InstagramCredentials,
  mediaUrls: { url: string; type: "image" | "video" }[],
  caption: string,
): Promise<AccountResult> {
  try {
    const childIds: string[] = [];
    for (const item of mediaUrls) {
      const id =
        item.type === "image"
          ? await createCarouselChildImage(creds, item.url)
          : await createCarouselChildVideo(creds, item.url);
      childIds.push(id);
    }

    for (const id of childIds) {
      await pollContainerUntilFinished(creds, id);
    }

    const parentId = await createCarouselParent(creds, childIds, caption);
    await pollContainerUntilFinished(creds, parentId);
    const result = await publishContainer(creds, parentId);
    return {
      platform: "instagram",
      accountId: creds.igUserId,
      username: creds.igUsername,
      success: true,
      mediaId: result.id,
      status: "published",
    };
  } catch (err) {
    const e = err as Error & { status?: number };
    return {
      platform: "instagram",
      accountId: creds.igUserId,
      username: creds.igUsername,
      success: false,
      error: e.message || "Failed to publish carousel",
      needsReconnect: e.status === 401,
    };
  }
}

async function publishToTtAccount(
  creds: TikTokCredentials,
  proxyUrls: string[],
  caption: string,
): Promise<AccountResult> {
  try {
    const fresh = await refreshIfNeeded(creds);
    const { title, description } = adaptCaptionForTikTok(caption);
    const publishId = await initInboxPhotoPost(fresh, proxyUrls, title, description);

    const start = Date.now();
    while (Date.now() - start < TT_POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, TT_POLL_INTERVAL_MS));
      const { status, failReason } = await fetchPublishStatus(fresh, publishId);

      if (status === "SEND_TO_USER_INBOX") {
        return {
          platform: "tiktok",
          accountId: creds.openId,
          username: creds.username,
          success: true,
          status: "sent_to_inbox",
        };
      }
      if (status === "PUBLISH_COMPLETE") {
        return {
          platform: "tiktok",
          accountId: creds.openId,
          username: creds.username,
          success: true,
          status: "published",
        };
      }
      if (status === "FAILED") {
        return {
          platform: "tiktok",
          accountId: creds.openId,
          username: creds.username,
          success: false,
          error: failReason || "TikTok upload failed",
        };
      }
    }

    return {
      platform: "tiktok",
      accountId: creds.openId,
      username: creds.username,
      success: false,
      error: "TikTok processing timed out",
    };
  } catch (err) {
    const e = err as Error & { status?: number };
    return {
      platform: "tiktok",
      accountId: creds.openId,
      username: creds.username,
      success: false,
      error: e.message || "Failed to send to TikTok",
      needsReconnect: e.status === 401,
    };
  }
}

function blobUrlToProxyUrl(blobUrl: string, origin: string): string {
  try {
    const parsed = new URL(blobUrl);
    const blobPath = parsed.pathname.slice(1);
    return `${origin}/api/media/${blobPath}`;
  } catch {
    return blobUrl;
  }
}

export async function POST(request: NextRequest) {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  let igCreds: InstagramCredentials[] = [];
  let ttCreds: TikTokCredentials[] = [];
  const ttCredsConnected: TikTokCredentials[] = [];

  try { igCreds = await ensureAllIg(); } catch { /* none */ }
  try { ttCreds = await getAllTtCredentials(); } catch { /* none */ }
  ttCredsConnected.push(...ttCreds);

  if (igCreds.length === 0 && ttCreds.length === 0) {
    return NextResponse.json(
      { error: "No accounts connected", code: "RECONNECT" },
      { status: 401 },
    );
  }

  let body: {
    mediaUrls: { url: string; type: "image" | "video" }[];
    caption: string;
    instagramAccountIds?: string[];
    tiktokAccountIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { mediaUrls, caption } = body;
  const trimmedCaption = typeof caption === "string" ? caption.trim() : "";

  const accountFilter = parseAccountFilterFromJson(body);
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
        { error: `Unknown account IDs: ${[...unknownIg, ...unknownTt].join(", ")}`, code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    if (filteredIg.length === 0 && filteredTt.length === 0) {
      return NextResponse.json(
        { error: "No accounts selected", code: "INVALID_INPUT" },
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
    console.warn("Blou TikTok account filter reduced connected accounts", {
      requested_tiktok_open_ids: accountFilter.tiktokAccountIds,
      connected_tiktok_open_ids: ttCredsConnected.map((c) => c.openId),
      selected_tiktok_open_ids: ttCreds.map((c) => c.openId),
      connected_tiktok_usernames: ttCredsConnected.map((c) => c.username),
      selected_tiktok_usernames: ttCreds.map((c) => c.username),
    });
  }

  if (ttCreds.length > 0) {
    const summary = summarizeTikTokCaptionTransform(trimmedCaption);
    const isSuspiciouslyShort = summary.captionLengthIn >= 60 && summary.captionLengthOut < 20;
    const isOnlyHashtag = /^#[\p{L}\p{N}_]{2,}$/u.test(trimmedCaption);

    console.info("Blou TikTok caption transform", {
      platform: "tiktok",
      caption_length_in: summary.captionLengthIn,
      first_120_chars_in: summary.first120In,
      caption_length_out: summary.captionLengthOut,
      first_120_chars_out: summary.first120Out,
      has_non_ascii: summary.hasNonAscii,
      hashtags_before: summary.hashtagsIn,
      hashtags_after: summary.hashtagsOut,
    });

    if (isSuspiciouslyShort || isOnlyHashtag) {
      return NextResponse.json(
        {
          error:
            "Caption looks invalid for TikTok (too short / only hashtag). Send the full generated caption text.",
          code: "INVALID_INPUT",
        },
        { status: 400 },
      );
    }
  }
  if (!Array.isArray(mediaUrls) || mediaUrls.length < MIN_ITEMS || mediaUrls.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `Between ${MIN_ITEMS} and ${MAX_ITEMS} items required` },
      { status: 400 }
    );
  }

  for (const item of mediaUrls) {
    if (!item.url || (item.type !== "image" && item.type !== "video")) {
      return NextResponse.json(
        { error: "Each item must have url and type (image or video)" },
        { status: 400 }
      );
    }
  }

  const origin = request.headers.get("x-forwarded-host")
    ? `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host")}`
    : request.nextUrl.origin;

  const imageOnlyUrls = mediaUrls.filter((m) => m.type === "image").map((m) => m.url);

  // TikTok only accepts JPEG/WebP — convert any PNGs to JPEG
  const ttImageUrls = ttCreds.length > 0
    ? await prepareTikTokImages(imageOnlyUrls)
    : imageOnlyUrls;
  const proxyUrls = ttImageUrls.map((url) => blobUrlToProxyUrl(url, origin));

  const allResults = await Promise.all([
    ...igCreds.map((creds) => publishToIgAccount(creds, mediaUrls, trimmedCaption)),
    ...ttCreds.map((creds) =>
      proxyUrls.length >= 1
        ? publishToTtAccount(creds, proxyUrls, trimmedCaption)
        : Promise.resolve<AccountResult>({
            platform: "tiktok",
            accountId: creds.openId,
            username: creds.username,
            success: false,
            error: "TikTok photo carousels require at least 1 image",
          }),
    ),
  ]);

  const allFailed = allResults.every((r) => !r.success);
  const anyNeedsReconnect = allResults.some((r) => r.needsReconnect);

  if (allFailed && anyNeedsReconnect) {
    return NextResponse.json(
      { error: "Reconnect accounts", code: "RECONNECT", results: allResults },
      { status: 401 },
    );
  }

  if (allFailed) {
    return NextResponse.json(
      { error: "Failed to publish to all accounts", results: allResults },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    results: allResults,
    mediaId: allResults.find((r) => r.success && r.mediaId)?.mediaId,
  });
}
