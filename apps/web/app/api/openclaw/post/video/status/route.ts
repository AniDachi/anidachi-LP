import { NextRequest, NextResponse } from "next/server";
import {
  validateOpenClawSecret,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";
import {
  getJob,
  saveJob,
  deriveOverallStatus,
} from "@/lib/openclaw-jobs";
import type { AccountProgress } from "@/lib/openclaw-jobs";
import {
  getContainerStatus,
  publishContainer,
} from "@/lib/instagram/graph";
import type { InstagramCredentials } from "@/lib/instagram/graph";
import { getCredentialsById as getIgCredsById } from "@/lib/instagram/storage";
import { getCredentialsById as getTtCredsById } from "@/lib/tiktok/storage";
import { fetchPublishStatus, refreshIfNeeded } from "@/lib/tiktok/api";
import type { TikTokCredentials } from "@/lib/tiktok/api";

const JOB_TIMEOUT_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  if (!validateOpenClawSecret(request)) {
    return unauthorizedResponse();
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json(
      { success: false, error: "jobId query parameter required", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { success: false, error: "Job not found", code: "JOB_NOT_FOUND" },
      { status: 404 },
    );
  }

  const formatResponse = () => ({
    success: true,
    jobId: job.id,
    status: job.overallStatus,
    accounts: job.accounts.map((a) => ({
      platform: a.platform,
      accountId: a.accountId,
      username: a.username,
      status: a.status,
      step: a.step,
      mediaId: a.mediaId,
      error: a.error,
    })),
  });

  if (job.overallStatus === "complete" || job.overallStatus === "failed") {
    return NextResponse.json(formatResponse());
  }

  if (Date.now() - job.createdAt > JOB_TIMEOUT_MS) {
    for (const acct of job.accounts) {
      if (!["complete", "failed", "sent_to_inbox"].includes(acct.status)) {
        acct.status = "failed";
        acct.error = "Job timed out after 10 minutes";
        acct.step = "Timed out";
      }
    }
    job.overallStatus = "failed";
    await saveJob(job);
    return NextResponse.json(formatResponse());
  }

  const activeAccounts = job.accounts.filter(
    (a) => !["complete", "failed", "sent_to_inbox"].includes(a.status),
  );

  await Promise.all(
    activeAccounts.map(async (acct) => {
      try {
        if (acct.platform === "instagram") {
          await processInstagramReel(acct);
        } else if (acct.platform === "tiktok") {
          await processTikTokVideo(acct);
        }
      } catch (err) {
        const e = err as Error & { status?: number };
        console.error(`OpenClaw video status error for @${acct.username} (${acct.platform}):`, e);
        acct.status = "failed";
        acct.error = e.status === 401 ? "Token expired" : (e.message || "Processing failed");
        acct.step = "Failed";
      }
    }),
  );

  job.overallStatus = deriveOverallStatus(job);
  await saveJob(job);

  return NextResponse.json(formatResponse());
}

// ---------------------------------------------------------------------------
// Instagram Reel processing (simpler than carousel — single container)
// ---------------------------------------------------------------------------

async function processInstagramReel(acct: AccountProgress) {
  const creds = await getIgCredsById(acct.accountId) as InstagramCredentials | null;
  if (!creds) {
    acct.status = "failed";
    acct.error = "Account disconnected";
    acct.step = "Account disconnected";
    return;
  }

  if (acct.status === "polling_reel" && acct.reelContainerId) {
    const { status_code, error_message } = await getContainerStatus(creds, acct.reelContainerId);

    if (status_code === "FINISHED" || status_code === "PUBLISHED") {
      acct.status = "publishing";
      acct.step = "Publishing Reel";
      const result = await publishContainer(creds, acct.reelContainerId);
      acct.status = "complete";
      acct.mediaId = result.id;
      acct.step = "Published";
      return;
    }

    if (status_code === "ERROR") {
      acct.status = "failed";
      acct.error = error_message || "Reel container processing failed";
      acct.step = "Reel processing failed";
      return;
    }

    acct.step = `Reel processing (${status_code.toLowerCase().replace(/_/g, " ")})`;
  }
}

// ---------------------------------------------------------------------------
// TikTok video processing (identical to carousel TikTok flow)
// ---------------------------------------------------------------------------

async function processTikTokVideo(acct: AccountProgress) {
  if (!acct.publishId) {
    acct.status = "failed";
    acct.error = "No publish ID";
    acct.step = "Failed";
    return;
  }

  const rawCreds = await getTtCredsById(acct.accountId) as TikTokCredentials | null;
  if (!rawCreds) {
    acct.status = "failed";
    acct.error = "Account disconnected";
    acct.step = "Account disconnected";
    return;
  }

  const creds = await refreshIfNeeded(rawCreds);
  const { status, failReason } = await fetchPublishStatus(creds, acct.publishId);

  if (status === "SEND_TO_USER_INBOX") {
    acct.status = "sent_to_inbox";
    acct.step = "Sent to TikTok inbox — open TikTok to review and publish";
    return;
  }

  if (status === "PUBLISH_COMPLETE") {
    acct.status = "complete";
    acct.step = "Published on TikTok";
    return;
  }

  if (status === "FAILED") {
    acct.status = "failed";
    acct.error = failReason || "TikTok upload failed";
    acct.step = "TikTok upload failed";
    return;
  }

  acct.step = `TikTok processing (${status.toLowerCase().replace(/_/g, " ")})`;
}
