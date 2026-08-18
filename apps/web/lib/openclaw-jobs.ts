import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  hasPrivateIntegrationBlobConfiguration,
  readPrivateIntegrationBlobText,
  writePrivateIntegrationBlobText,
} from "@/lib/private-integration-blob";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountProgress {
  platform: "instagram" | "tiktok" | "youtube";
  accountId: string;   // igUserId, openId, or channelId
  username: string;
  childContainerIds: string[];  // Instagram carousel only
  childrenReady: number;        // Instagram carousel only
  parentContainerId?: string;   // Instagram carousel only
  reelContainerId?: string;     // Instagram video (Reel) only
  publishId?: string;           // TikTok only
  videoId?: string;             // YouTube only
  mediaId?: string;
  status:
    | "polling_children"
    | "creating_parent"
    | "polling_reel"
    | "publishing"
    | "uploading_to_youtube"
    | "sent_to_inbox"
    | "complete"
    | "failed";
  error?: string;
  step: string;
}

export interface CarouselJob {
  id: string;
  type?: "carousel" | "video";
  overallStatus:
    | "preparing"
    | "uploading"
    | "creating_children"
    | "processing"
    | "complete"
    | "failed";
  caption: string;
  blobUrls: string[];
  proxyUrls: string[];  // Domain-verified URLs for TikTok
  videoUrl?: string;       // Blob URL for video (video jobs only)
  videoProxyUrl?: string;  // Domain-verified video URL for TikTok (video jobs only)
  totalChildren: number;
  accounts: AccountProgress[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const JOB_TTL_MS = 30 * 60 * 1000;
export const OPENCLAW_JOB_BLOB_PREFIX = "openclaw/jobs";
const BLOB_PREFIX = OPENCLAW_JOB_BLOB_PREFIX;
const LOCAL_DIR = ".data/openclaw-jobs";

function blobPath(jobId: string): string {
  return `${BLOB_PREFIX}/${jobId}.json`;
}

function localPath(jobId: string): string {
  return join(process.cwd(), LOCAL_DIR, `${jobId}.json`);
}

// ---------------------------------------------------------------------------
// Blob helpers
// ---------------------------------------------------------------------------

async function readFromBlob(jobId: string): Promise<CarouselJob | undefined> {
  try {
    const text = await readPrivateIntegrationBlobText(blobPath(jobId));
    return text ? (JSON.parse(text) as CarouselJob) : undefined;
  } catch {
    return undefined;
  }
}

async function writeToBlob(job: CarouselJob): Promise<void> {
  await writePrivateIntegrationBlobText(blobPath(job.id), JSON.stringify(job));
}

// ---------------------------------------------------------------------------
// Local filesystem helpers (dev fallback)
// ---------------------------------------------------------------------------

async function readFromFile(jobId: string): Promise<CarouselJob | undefined> {
  try {
    const data = await readFile(localPath(jobId), "utf-8");
    return JSON.parse(data) as CarouselJob;
  } catch {
    return undefined;
  }
}

async function writeToFile(job: CarouselJob): Promise<void> {
  const dir = join(process.cwd(), LOCAL_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(localPath(job.id), JSON.stringify(job, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Create a new job, persist it, and return the job object. */
export async function createJob(
  caption: string,
  totalChildren: number,
  accounts: { platform: "instagram" | "tiktok" | "youtube"; accountId: string; username: string }[],
  type: "carousel" | "video" = "carousel",
): Promise<CarouselJob> {
  const id = crypto.randomUUID();

  const igInitialStatus: AccountProgress["status"] =
    type === "video" ? "polling_reel" : "polling_children";

  const job: CarouselJob = {
    id,
    type,
    overallStatus: "preparing",
    caption,
    blobUrls: [],
    proxyUrls: [],
    totalChildren,
    accounts: accounts.map((a) => ({
      platform: a.platform,
      accountId: a.accountId,
      username: a.username,
      childContainerIds: [],
      childrenReady: 0,
      status:
        a.platform === "instagram"
          ? igInitialStatus
          : a.platform === "youtube"
            ? "uploading_to_youtube"
            : "publishing",
      step: "Waiting",
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveJob(job);
  return job;
}

/** Load a job by ID. Returns undefined if not found or expired. */
export async function getJob(id: string): Promise<CarouselJob | undefined> {
  const useBlob = hasPrivateIntegrationBlobConfiguration();
  const job = useBlob ? await readFromBlob(id) : await readFromFile(id);
  if (!job) return undefined;

  if (Date.now() - job.createdAt > JOB_TTL_MS) return undefined;
  return job;
}

/** Persist the full job object (call once at end of request). */
export async function saveJob(job: CarouselJob): Promise<void> {
  job.updatedAt = Date.now();
  if (hasPrivateIntegrationBlobConfiguration()) {
    await writeToBlob(job);
  } else {
    await writeToFile(job);
  }
}

/** Derive overall job status from per-account statuses. */
export function deriveOverallStatus(job: CarouselJob): CarouselJob["overallStatus"] {
  const statuses = job.accounts.map((a) => a.status);
  const terminal = ["complete", "failed", "sent_to_inbox"];
  if (statuses.every((s) => terminal.includes(s))) {
    if (statuses.every((s) => s === "failed")) return "failed";
    return "complete";
  }
  return "processing";
}
