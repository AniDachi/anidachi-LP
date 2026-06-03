"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Film,
  Images,
  Loader2,
  GripVertical,
  X,
  Upload,
  Instagram,
  Music2,
  CheckCircle2,
  XCircle,
  Inbox,
} from "lucide-react";

type PublishStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "success"
  | "partial"
  | "error";

type TabType = "reel" | "carousel";

interface AccountResult {
  platform: "instagram" | "tiktok";
  accountId: string;
  username: string;
  success: boolean;
  mediaId?: string;
  status?: string;
  error?: string;
}

interface IgAccount {
  igUserId: string;
  username: string;
}

interface TtAccount {
  openId: string;
  username: string;
}

const REEL_MAX_DURATION_SEC = 90;
const CAROUSEL_VIDEO_MAX_SEC = 60;
const CAROUSEL_MIN_ITEMS = 2;
const CAROUSEL_MAX_ITEMS = 10;
const IMAGE_MIN_WIDTH = 600;

export function PublishClient() {
  const [tab, setTab] = useState<TabType>("reel");
  const [igAccounts, setIgAccounts] = useState<IgAccount[]>([]);
  const [ttAccounts, setTtAccounts] = useState<TtAccount[]>([]);
  const [selectedIg, setSelectedIg] = useState<Set<string>>(new Set());
  const [selectedTt, setSelectedTt] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reelFile, setReelFile] = useState<File | null>(null);
  const [reelDuration, setReelDuration] = useState<number | null>(null);
  const [reelError, setReelError] = useState<string | null>(null);
  const [carouselFiles, setCarouselFiles] = useState<{ file: File; type: "image" | "video"; duration?: number; width?: number }[]>([]);
  const [carouselError, setCarouselError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<PublishStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [accountResults, setAccountResults] = useState<AccountResult[]>([]);
  const reelInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/instagram/status")
        .then((r) => r.json())
        .then((d: { accounts?: IgAccount[] }) => {
          const accts = d.accounts ?? [];
          setIgAccounts(accts);
          setSelectedIg(new Set(accts.map((a) => a.igUserId)));
        })
        .catch(() => setIgAccounts([])),
      fetch("/api/auth/tiktok/status")
        .then((r) => r.json())
        .then((d: { accounts?: TtAccount[] }) => {
          const accts = d.accounts ?? [];
          setTtAccounts(accts);
          setSelectedTt(new Set(accts.map((a) => a.openId)));
        })
        .catch(() => setTtAccounts([])),
    ]).finally(() => setLoading(false));
  }, []);

  const toggleIg = (id: string) => {
    setSelectedIg((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTt = (id: string) => {
    setSelectedTt((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const buildAccountPayload = (): Record<string, string[]> => {
    const payload: Record<string, string[]> = {};
    if (selectedIg.size < igAccounts.length || selectedTt.size < ttAccounts.length) {
      payload.instagramAccountIds = Array.from(selectedIg);
      payload.tiktokAccountIds = Array.from(selectedTt);
    }
    return payload;
  };

  const checkReelVideo = (file: File): Promise<{ duration: number; error?: string }> => {
    return new Promise((resolve) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "mp4" && ext !== "mov") {
        resolve({ duration: 0, error: "Use MP4 or MOV format." });
        return;
      }
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        if (duration > REEL_MAX_DURATION_SEC) {
          resolve({ duration, error: `Video must be ${REEL_MAX_DURATION_SEC} seconds or less.` });
        } else {
          resolve({ duration });
        }
      };
      video.onerror = () => resolve({ duration: 0, error: "Could not read video." });
      video.src = URL.createObjectURL(file);
    });
  };

  const handleReelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setReelError(null);
    setReelDuration(null);
    setReelFile(null);
    if (!file) return;
    const { duration, error } = await checkReelVideo(file);
    if (error) {
      setReelError(error);
      return;
    }
    setReelDuration(duration);
    setReelFile(file);
  };

  const handleCarouselFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setCarouselError(null);
    const newItems: { file: File; type: "image" | "video"; duration?: number; width?: number }[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) continue;
      if (isImage) {
        const width = await new Promise<number>((res) => {
          const img = new Image();
          img.onload = () => {
            res(img.naturalWidth);
            URL.revokeObjectURL(img.src);
          };
          img.onerror = () => res(0);
          img.src = URL.createObjectURL(file);
        });
        if (width > 0 && width < IMAGE_MIN_WIDTH) {
          setCarouselError(`Image "${file.name}" must be at least ${IMAGE_MIN_WIDTH}px wide.`);
          return;
        }
        newItems.push({ file, type: "image", width });
      } else {
        const duration = await new Promise<number>((res) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () => {
            res(video.duration);
            URL.revokeObjectURL(video.src);
          };
          video.onerror = () => res(0);
          video.src = URL.createObjectURL(file);
        });
        if (duration > CAROUSEL_VIDEO_MAX_SEC) {
          setCarouselError(`Video "${file.name}" must be ${CAROUSEL_VIDEO_MAX_SEC} seconds or less.`);
          return;
        }
        newItems.push({ file, type: "video", duration });
      }
    }
    const total = carouselFiles.length + newItems.length;
    if (total > CAROUSEL_MAX_ITEMS) {
      setCarouselError(`Maximum ${CAROUSEL_MAX_ITEMS} items.`);
      return;
    }
    setCarouselFiles((prev) => [...prev, ...newItems].slice(0, CAROUSEL_MAX_ITEMS));
    if (e.target) e.target.value = "";
  };

  const removeCarouselItem = (index: number) => {
    setCarouselFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const moveCarouselItem = (from: number, to: number) => {
    if (to < 0 || to >= carouselFiles.length) return;
    setCarouselFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  };

  const handleResults = (data: { success?: boolean; results?: AccountResult[] }) => {
    const results = data.results ?? [];
    setAccountResults(results);

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (succeeded.length === results.length) {
      setStatus("success");
      const inboxCount = succeeded.filter((r) => r.status === "sent_to_inbox").length;
      const publishedCount = succeeded.filter((r) => r.status !== "sent_to_inbox").length;
      const parts: string[] = [];
      if (publishedCount > 0) parts.push(`Published to ${publishedCount} account${publishedCount > 1 ? "s" : ""}`);
      if (inboxCount > 0) parts.push(`Sent to ${inboxCount} TikTok inbox${inboxCount > 1 ? "es" : ""}`);
      setStatusMessage(parts.join(". ") + ".");
    } else if (succeeded.length > 0) {
      setStatus("partial");
      setStatusMessage(`${succeeded.length} succeeded, ${failed.length} failed.`);
    } else {
      setStatus("error");
      setStatusMessage(failed[0]?.error || "Failed to publish.");
    }
  };

  const publishReel = async () => {
    if (!reelFile) return;
    setStatus("uploading");
    setStatusMessage("Uploading video…");
    setReelError(null);
    setAccountResults([]);
    try {
      const form = new FormData();
      form.append("file", reelFile);
      const uploadRes = await fetch("/api/blou/upload", {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setStatus("error");
        setStatusMessage(uploadData.error || "Upload failed");
        return;
      }
      const videoUrl = uploadData.url;
      setStatus("processing");
      setStatusMessage(`Publishing to ${selectedIg.size + selectedTt.size} account(s)…`);
      const publishRes = await fetch("/api/blou/publish/reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, caption, ...buildAccountPayload() }),
      });
      const publishData = await publishRes.json();
      if (!publishRes.ok && !publishData.results) {
        if (publishRes.status === 401) {
          setStatusMessage("Reconnect accounts from the Connect page.");
        } else {
          setStatusMessage(publishData.error || "Publish failed");
        }
        setStatus("error");
        return;
      }
      handleResults(publishData);
      if (status !== "error") {
        setReelFile(null);
        setReelDuration(null);
        setCaption("");
      }
    } catch {
      setStatus("error");
      setStatusMessage("Network error. Try again.");
    }
  };

  const publishCarousel = async () => {
    if (carouselFiles.length < CAROUSEL_MIN_ITEMS) {
      setCarouselError(`Add at least ${CAROUSEL_MIN_ITEMS} items.`);
      return;
    }
    setStatus("uploading");
    setStatusMessage("Uploading files…");
    setCarouselError(null);
    setAccountResults([]);
    try {
      const urls: { url: string; type: "image" | "video" }[] = [];
      for (const item of carouselFiles) {
        const form = new FormData();
        form.append("file", item.file);
        const uploadRes = await fetch("/api/blou/upload", {
          method: "POST",
          body: form,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setStatus("error");
          setStatusMessage(uploadData.error || "Upload failed");
          return;
        }
        urls.push({ url: uploadData.url, type: item.type });
      }
      setStatus("processing");
      setStatusMessage(`Publishing to ${selectedIg.size + selectedTt.size} account(s)…`);
      const publishRes = await fetch("/api/blou/publish/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrls: urls, caption, ...buildAccountPayload() }),
      });
      const publishData = await publishRes.json();
      if (!publishRes.ok && !publishData.results) {
        if (publishRes.status === 401) {
          setStatusMessage("Reconnect accounts from the Connect page.");
        } else {
          setStatusMessage(publishData.error || "Publish failed");
        }
        setStatus("error");
        return;
      }
      handleResults(publishData);
      if (status !== "error") {
        setCarouselFiles([]);
        setCaption("");
      }
    } catch {
      setStatus("error");
      setStatusMessage("Network error. Try again.");
    }
  };

  const selectedCount = selectedIg.size + selectedTt.size;
  const canPublish =
    (status === "idle" ||
    status === "success" ||
    status === "partial" ||
    status === "error") &&
    selectedCount > 0;
  const isReelValid = reelFile && !reelError;
  const isCarouselValid =
    carouselFiles.length >= CAROUSEL_MIN_ITEMS &&
    carouselFiles.length <= CAROUSEL_MAX_ITEMS &&
    !carouselError;

  const igCount = igAccounts.length;
  const ttCount = ttAccounts.length;
  const totalAccounts = igCount + ttCount;

  if (loading) {
    return (
      <Card className="border-teal-100 bg-white shadow-sm">
        <CardContent className="pt-6 flex items-center gap-2 text-stone-600">
          <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
          <span>Checking connections…</span>
        </CardContent>
      </Card>
    );
  }

  if (totalAccounts === 0) {
    return (
      <Card className="border-teal-100 bg-white shadow-sm">
        <CardContent className="pt-6">
          <p className="text-stone-600 mb-4">
            Connect at least one Instagram or TikTok account to publish content.
          </p>
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <Link href="/blou/manager">Connect Accounts</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Account selection */}
      <div className="mb-6 space-y-3">
        <p className="text-sm font-medium text-stone-700">
          Publish to ({selectedCount} of {totalAccounts} selected)
        </p>

        {igAccounts.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Instagram</span>
            {igAccounts.map((a) => (
              <label
                key={a.igUserId}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 hover:bg-teal-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIg.has(a.igUserId)}
                  onChange={() => toggleIg(a.igUserId)}
                  className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                />
                <Instagram className="h-3.5 w-3.5 text-stone-500" />
                <span className="text-sm text-stone-700">@{a.username}</span>
              </label>
            ))}
          </div>
        )}

        {ttAccounts.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">TikTok</span>
            {ttAccounts.map((a) => (
              <label
                key={a.openId}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 hover:bg-teal-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedTt.has(a.openId)}
                  onChange={() => toggleTt(a.openId)}
                  className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                />
                <Music2 className="h-3.5 w-3.5 text-stone-500" />
                <span className="text-sm text-stone-700">@{a.username}</span>
              </label>
            ))}
          </div>
        )}

        {selectedCount === 0 && (
          <p className="text-xs text-amber-600">Select at least one account to publish.</p>
        )}
      </div>

      <div className="flex gap-2 border-b border-teal-200 mb-6">
        <button
          type="button"
          onClick={() => setTab("reel")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === "reel"
              ? "bg-teal-100 text-teal-800 border border-b-0 border-teal-200 -mb-px"
              : "text-stone-600 hover:text-teal-600"
          }`}
        >
          <Film className="inline h-4 w-4 mr-2" />
          Reel / Video
        </button>
        <button
          type="button"
          onClick={() => setTab("carousel")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === "carousel"
              ? "bg-teal-100 text-teal-800 border border-b-0 border-teal-200 -mb-px"
              : "text-stone-600 hover:text-teal-600"
          }`}
        >
          <Images className="inline h-4 w-4 mr-2" />
          Carousel
        </button>
      </div>

      <Card className="border-teal-100 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-teal-800">
            {tab === "reel" ? "Publish a Reel / Video" : "Publish a Carousel"}
          </CardTitle>
          <CardDescription>
            {tab === "reel"
              ? "Upload a video (MP4/MOV, max 90 sec). Posts as Instagram Reel and TikTok video (draft)."
              : `Upload 2–10 images or videos. Posts as Instagram Carousel and TikTok photo post (draft).`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status === "uploading" || status === "processing") && (
            <p className="text-sm text-teal-700 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {statusMessage}
            </p>
          )}

          {(status === "error" || status === "success" || status === "partial") && statusMessage && (
            <div
              className={`text-sm p-3 rounded-lg ${
                status === "success"
                  ? "text-teal-800 bg-teal-50"
                  : status === "partial"
                  ? "text-amber-800 bg-amber-50"
                  : "text-red-600 bg-red-50"
              }`}
            >
              <p className="font-medium">{statusMessage}</p>

              {accountResults.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {accountResults.map((r) => (
                    <li key={`${r.platform}-${r.accountId}`} className="flex items-center gap-2">
                      {r.platform === "instagram" ? (
                        <Instagram className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Music2 className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="font-medium">@{r.username}</span>
                      {r.success ? (
                        r.status === "sent_to_inbox" ? (
                          <span className="flex items-center gap-1 text-teal-600">
                            <Inbox className="h-3.5 w-3.5" /> Sent to inbox
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-teal-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Published
                          </span>
                        )
                      ) : (
                        <span className="flex items-center gap-1 text-red-500">
                          <XCircle className="h-3.5 w-3.5" /> {r.error}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(status === "success" || status === "partial") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setStatus("idle"); setAccountResults([]); }}
              className="border-teal-200"
            >
              Publish another
            </Button>
          )}

          {tab === "reel" && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Video
              </label>
              <input
                ref={reelInputRef}
                type="file"
                accept="video/mp4,video/quicktime,.mp4,.mov"
                onChange={handleReelFileChange}
                className="block w-full text-sm text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700"
              />
              {reelFile && (
                <p className="mt-1 text-sm text-stone-500">
                  {reelFile.name}
                  {reelDuration != null && ` · ${reelDuration.toFixed(1)}s`}
                </p>
              )}
              {reelError && (
                <p className="mt-1 text-sm text-red-600">{reelError}</p>
              )}
            </div>
          )}

          {tab === "carousel" && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Items (2–10)
              </label>
              <input
                ref={carouselInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,video/mp4,video/quicktime"
                multiple
                onChange={handleCarouselFilesChange}
                className="block w-full text-sm text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700"
              />
              {carouselError && (
                <p className="mt-1 text-sm text-red-600">{carouselError}</p>
              )}
              <ul className="mt-2 space-y-2">
                {carouselFiles.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg"
                  >
                    <button
                      type="button"
                      className="text-stone-400 hover:text-stone-600"
                      onClick={() => moveCarouselItem(i, i - 1)}
                      disabled={i === 0}
                      aria-label="Move up"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <span className="flex-1 truncate text-sm text-stone-700">
                      {item.file.name}
                      {item.type === "video" && item.duration != null && (
                        <span className="text-stone-500"> · {item.duration.toFixed(0)}s</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="text-stone-400 hover:text-red-600"
                      onClick={() => removeCarouselItem(i)}
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {carouselFiles.length > 0 && (
                <p className="text-xs text-stone-500 mt-1">
                  First item sets aspect ratio. Drag to reorder.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Write a caption…"
            />
            {selectedTt.size > 0 && (
              <p className="text-xs text-stone-400 mt-1">
                TikTok title uses the first 90 characters. You can edit the caption in TikTok before posting from drafts.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            {tab === "reel" && (
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                disabled={!canPublish || !isReelValid}
                onClick={publishReel}
              >
                {status === "uploading" || status === "processing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Publish Reel / Video
                  </>
                )}
              </Button>
            )}
            {tab === "carousel" && (
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                disabled={!canPublish || !isCarouselValid}
                onClick={publishCarousel}
              >
                {status === "uploading" || status === "processing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Publish Carousel
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" asChild className="border-teal-200">
              <Link href="/blou/manager">Back to Connect</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
