# OpenClaw: YouTube Shorts posting

Instructions for automated agents (OpenClaw) posting short-form video to YouTube via the AniDachi web API.

## Overview

YouTube Shorts are posted through the same OpenClaw **video** pipeline as Instagram Reels and TikTok videos:

- **Endpoint:** `POST /api/openclaw/post/video/prepare`
- **Unlike TikTok** (inbox draft), YouTube uploads are **published directly as public videos** on the connected channel.
- **Unlike Instagram**, YouTube upload completes **synchronously during prepare** (no long async poll loop for YouTube-only jobs).

OpenClaw **cannot connect** YouTube accounts. A human must connect channels once in **Blou manager** (`/blou/manager`) via Google OAuth. After that, OpenClaw uses stored refresh tokens on the server (Vercel Blob: `youtube/credentials.json`).

## Prerequisites

1. **Server env vars** (Vercel / deployment):
   - `OPENCLAW_API_SECRET` — shared secret for `x-openclaw-secret` header
   - `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` — Google OAuth client with YouTube Data API v3 enabled
   - `BLOB_READ_WRITE_TOKEN` — media + credential storage
2. **At least one YouTube channel** connected in Blou manager (max 5 channels per deployment).
3. **Video constraints:**
   - Format: MP4 or MOV
   - Max size: 100 MB
   - Max duration: 90 seconds (Shorts / reel format)
4. **YouTube API quota:** each `videos.insert` costs ~1600 quota units (~6 uploads/day on default GCP quota unless increased).

## Authentication

Every OpenClaw request requires:

```http
x-openclaw-secret: <OPENCLAW_API_SECRET>
```

Missing or wrong secret → `401` with `code: "AUTH_FAILED"`.

## Step 1 — Check connected accounts

```http
GET {BASE_URL}/api/openclaw/health
x-openclaw-secret: {SECRET}
```

Example response (YouTube section):

```json
{
  "healthy": true,
  "instagram": [],
  "tiktok": [],
  "youtube": [
    {
      "accountId": "UCxxxxxxxx",
      "username": "My Channel Name",
      "healthy": true
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `accountId` | YouTube **channel ID** — use for `youtubeChannelIds` when targeting one channel |
| `username` | Channel display title |
| `healthy` | `false` → reconnect in Blou manager (`token_expired_or_invalid`) |

If `youtube` is empty, stop and ask a human to connect a channel at `/blou/manager`.

## Step 2 — Prepare video post

```http
POST {BASE_URL}/api/openclaw/post/video/prepare
x-openclaw-secret: {SECRET}
Content-Type: multipart/form-data
```

### Form fields

| Field | Required | Description |
|-------|----------|-------------|
| `caption` | Yes | Full caption text (see [Caption rules](#caption-rules-youtube)) |
| `video` | Yes | Single MP4/MOV file |
| `platform` | No | `youtube` or `yt` — post **only** to YouTube |
| `platforms[]` | No | Repeat for multiple platforms, e.g. `platforms[]=youtube` |
| `youtubeChannelIds` | No | Restrict to specific channel IDs (from health) |
| `youtubeChannelIds[]` | No | Same; curl `-F` array style |

Omit `platform` / `platforms[]` to fan out to **all** connected accounts on **all** platforms (Instagram + TikTok + YouTube).

### Examples

**YouTube only — all connected channels:**

```bash
BASE="https://www.anidachi.app"
SECRET="your-openclaw-secret"

curl -X POST "$BASE/api/openclaw/post/video/prepare" \
  -H "x-openclaw-secret: $SECRET" \
  -F "platform=youtube" \
  -F "caption=Hook line here

Full body text and hashtags #example" \
  -F "video=@reel_final.mp4"
```

**YouTube only — one channel:**

```bash
curl -X POST "$BASE/api/openclaw/post/video/prepare" \
  -H "x-openclaw-secret: $SECRET" \
  -F "platform=youtube" \
  -F "youtubeChannelIds=UCxxxxxxxx" \
  -F "caption=First line is the title

Rest becomes description." \
  -F "video=@reel_final.mp4"
```

**All platforms (IG + TikTok + YouTube):**

```bash
curl -X POST "$BASE/api/openclaw/post/video/prepare" \
  -H "x-openclaw-secret: $SECRET" \
  -F "caption=..." \
  -F "video=@reel_final.mp4"
```

### Prepare response

```json
{
  "success": true,
  "jobId": "uuid",
  "status": "complete",
  "accounts": [
    {
      "platform": "youtube",
      "accountId": "UCxxxxxxxx",
      "username": "My Channel Name",
      "status": "complete",
      "step": "Published on YouTube"
    }
  ]
}
```

- YouTube-only jobs often return `status: "complete"` immediately.
- Mixed-platform jobs may return `status: "processing"` while Instagram/TikTok finish asynchronously.

## Step 3 — Poll job status (if needed)

```http
GET {BASE_URL}/api/openclaw/post/video/status?jobId={jobId}
x-openclaw-secret: {SECRET}
```

Poll until `status` is `complete` or `failed` (job TTL ~30 minutes; hard timeout 10 minutes for in-flight work).

**YouTube success per account:**

```json
{
  "platform": "youtube",
  "accountId": "UCxxxxxxxx",
  "username": "My Channel Name",
  "status": "complete",
  "step": "Published on YouTube",
  "videoId": "abc123xyz",
  "mediaId": "abc123xyz"
}
```

**Public Short URL:** `https://youtube.com/shorts/{videoId}`

For YouTube-only jobs, you can often skip polling if prepare already returned `complete` with `videoId` in the status response (check per-account fields on the job via status endpoint).

## Server-side flow (YouTube)

1. Video uploaded to Vercel Blob (`openclaw/video/{date}/{uuid}.mp4`).
2. Caption transformed (see below).
3. Per selected channel:
   - Refresh Google OAuth access token if expired.
   - Stream video from Blob → YouTube Data API `videos.insert` (resumable upload).
   - `privacyStatus`: **public**
   - `categoryId`: **22** (People & Blogs)
4. On success: `videoId` stored on job account progress; status `complete`.
5. On token failure: status `failed`, error suggests reconnect in Blou.

Large uploads may take several minutes (route `maxDuration` = 300s; requires Vercel Pro for long runs).

## Caption rules (YouTube)

| Input | YouTube field |
|-------|----------------|
| First line | Video **title** (max 100 characters) |
| Following lines | Video **description** |
| Missing `#Shorts` | Appended automatically to description (or title if no description) |

Example:

```
Quit smoking tip #3

Here's what helped me stay smoke-free for 30 days.
#quitsmoking #health
```

→ Title: `Quit smoking tip #3`  
→ Description: body lines + `#Shorts` if not present.

TikTok caption validation (too short / hashtag-only) applies only when TikTok accounts are in the same request, not for YouTube-only posts.

## Platform comparison (same video endpoint)

| Platform | Publish behavior | OpenClaw async behavior |
|----------|------------------|-------------------------|
| Instagram | Direct Reel publish | Poll container → publish via `/video/status` |
| TikTok | Creator inbox (draft) | Poll until `sent_to_inbox` |
| YouTube | Direct public Short | **Completes in prepare**; `videoId` on success |

## Error codes

| Code | Meaning | Action |
|------|---------|--------|
| `AUTH_FAILED` | Bad/missing `x-openclaw-secret` | Fix secret header |
| `RECONNECT` | No YouTube channels or expired token | Human reconnects at `/blou/manager` |
| `INVALID_INPUT` | Missing caption/video, bad platform, unknown channel ID | Fix request |
| `PREPARE_FAILED` | Server or upload error | Check logs; retry |
| `JOB_NOT_FOUND` | Invalid or expired `jobId` | Start new prepare |

## Human setup (one-time, not via OpenClaw)

1. In Google Cloud: enable **YouTube Data API v3**, create OAuth client, add redirect URI `{origin}/api/auth/youtube/callback`.
2. Set `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` on the deployment.
3. Log in to Blou (`/blou/login`) → **Connect** → connect YouTube channel(s).
4. Confirm `GET /api/openclaw/health` shows `youtube[].healthy: true`.

## Operational notes

- Default YouTube API quota is low for heavy automation; request a quota increase in GCP if posting daily.
- Disconnect and reconnect in Blou if uploads fail with token / `invalid_grant` errors.
- Carousel posts (`POST /api/openclaw/post/prepare`) do **not** support YouTube; use the **video** endpoint only for Shorts.

## Related code

- Health: `apps/web/app/api/openclaw/health/route.ts`
- Video prepare: `apps/web/app/api/openclaw/post/video/prepare/route.ts`
- Video status: `apps/web/app/api/openclaw/post/video/status/route.ts`
- YouTube API client: `apps/web/lib/youtube/api.ts`
- Caption transform: `apps/web/lib/youtube/caption.ts`
