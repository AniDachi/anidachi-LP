"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Instagram, Loader2, Music2 } from "lucide-react";
import {
  MAX_INSTAGRAM_ACCOUNTS,
  MAX_TIKTOK_ACCOUNTS,
} from "@/lib/social-account-limits";

interface IgAccount {
  igUserId: string;
  username: string;
  connected: boolean;
}

interface TtAccount {
  openId: string;
  username: string;
  avatarUrl?: string;
  connected: boolean;
}

interface IgStatus {
  connected: boolean;
  accounts: IgAccount[];
}

interface TtStatus {
  connected: boolean;
  accounts: TtAccount[];
}

const MAX_IG_ACCOUNTS = MAX_INSTAGRAM_ACCOUNTS;
const MAX_TT_ACCOUNTS = MAX_TIKTOK_ACCOUNTS;

const ERROR_MESSAGES: Record<string, string> = {
  no_pages: "No Facebook Page found. Link a Page to your account.",
  no_instagram_account: "No Instagram Business account linked to your Page.",
  config: "Server configuration error (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET).",
  tiktok_config: "Server configuration error (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET).",
  missing_code: "OAuth callback missing code.",
  missing_or_invalid_state: "OAuth session expired or was tampered with. Please try again.",
  tiktok_invalid_state: "TikTok OAuth session expired. Please try again.",
  max_instagram_accounts: `Maximum of ${MAX_IG_ACCOUNTS} Instagram accounts can be connected. Disconnect one to add another.`,
  max_tiktok_accounts: `Maximum of ${MAX_TT_ACCOUNTS} TikTok accounts can be connected. Disconnect one to add another.`,
  server_error: "Server error. Try again.",
};

export function ConnectClient() {
  const searchParams = useSearchParams();
  const [igStatus, setIgStatus] = useState<IgStatus | null>(null);
  const [ttStatus, setTtStatus] = useState<TtStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingIg, setConnectingIg] = useState(false);
  const [connectingTt, setConnectingTt] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const urlError = searchParams.get("error");

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setSuccessMessage("Instagram account connected.");
    } else if (searchParams.get("tiktok_connected") === "1") {
      setSuccessMessage("TikTok account connected.");
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/instagram/status")
        .then((r) => r.json())
        .then((d: IgStatus) => setIgStatus(d))
        .catch(() => setIgStatus({ connected: false, accounts: [] })),
      fetch("/api/auth/tiktok/status")
        .then((r) => r.json())
        .then((d: TtStatus) => setTtStatus(d))
        .catch(() => setTtStatus({ connected: false, accounts: [] })),
    ]).finally(() => setLoading(false));
  }, []);

  const startIgConnect = async (switchAccount: boolean) => {
    setConnectingIg(true);
    setError(null);
    setSuccessMessage(null);
    const connectUrl = switchAccount
      ? "/api/auth/instagram/connect?switch_account=1"
      : "/api/auth/instagram/connect";
    try {
      const res = await fetch(connectUrl);
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setError(data.error || "Could not get OAuth URL");
    } catch { setError("Network error"); }
    finally { setConnectingIg(false); }
  };

  const startTtConnect = async (switchAccount: boolean) => {
    setConnectingTt(true);
    setError(null);
    setSuccessMessage(null);
    const connectUrl = switchAccount
      ? "/api/auth/tiktok/connect?switch_account=1"
      : "/api/auth/tiktok/connect";
    try {
      const res = await fetch(connectUrl);
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setError(data.error || "Could not get OAuth URL");
    } catch { setError("Network error"); }
    finally { setConnectingTt(false); }
  };

  const handleDisconnectIg = async (igUserId: string) => {
    setDisconnectingId(igUserId);
    setError(null);
    try {
      await fetch("/api/auth/instagram/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igUserId }),
      });
      setIgStatus((prev) => {
        if (!prev) return prev;
        const accounts = prev.accounts.filter((a) => a.igUserId !== igUserId);
        return { connected: accounts.length > 0, accounts };
      });
    } catch { setError("Failed to disconnect"); }
    finally { setDisconnectingId(null); }
  };

  const handleDisconnectTt = async (openId: string) => {
    setDisconnectingId(openId);
    setError(null);
    try {
      await fetch("/api/auth/tiktok/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openId }),
      });
      setTtStatus((prev) => {
        if (!prev) return prev;
        const accounts = prev.accounts.filter((a) => a.openId !== openId);
        return { connected: accounts.length > 0, accounts };
      });
    } catch { setError("Failed to disconnect"); }
    finally { setDisconnectingId(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const igAccounts = igStatus?.accounts ?? [];
  const ttAccounts = ttStatus?.accounts ?? [];
  const canAddIg = igAccounts.length < MAX_IG_ACCOUNTS;
  const canAddTt = ttAccounts.length < MAX_TT_ACCOUNTS;
  const hasAnyAccount = igAccounts.length > 0 || ttAccounts.length > 0;

  return (
    <div className="max-w-md mx-auto space-y-6">
      {successMessage && (
        <p className="text-sm text-teal-800 bg-teal-50 p-3 rounded-lg border border-teal-100">
          {successMessage}
        </p>
      )}

      {(urlError || error) && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {error ?? (urlError ? (ERROR_MESSAGES[urlError] ?? urlError.replace(/_/g, " ")) : "Connection failed.")}
        </p>
      )}

      {/* Instagram Card */}
      <Card className="border-teal-100 bg-background shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-teal-800">
            <Instagram className="h-5 w-5" />
            Instagram
          </CardTitle>
          <CardDescription>
            Connect up to {MAX_IG_ACCOUNTS} Instagram Business accounts.
            Posts publish directly to all connected accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {igAccounts.length > 0 && (
            <div className="space-y-3">
              {igAccounts.map((account) => (
                <div
                  key={account.igUserId}
                  className="flex items-center justify-between p-3 rounded-lg bg-teal-50/50 border border-teal-100"
                >
                  <p className="text-sm text-stone-600">
                    <strong className="text-teal-700">@{account.username}</strong>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                    onClick={() => handleDisconnectIg(account.igUserId)}
                    disabled={disconnectingId === account.igUserId}
                  >
                    {disconnectingId === account.igUserId ? "Disconnecting\u2026" : "Disconnect"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {canAddIg && (
            <>
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700"
                onClick={() => startIgConnect(false)}
                disabled={connectingIg}
              >
                {connectingIg ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Connecting&hellip;</>
                ) : (
                  <><Instagram className="h-4 w-4" /> {igAccounts.length === 0 ? "Connect Instagram" : "Connect Another"}</>
                )}
              </Button>
              {igAccounts.length > 0 && (
                <p className="text-xs text-stone-500">
                  Uses the Instagram account you&apos;re already signed into in this browser — no need to log out.
                  Already connected accounts here stay linked.
                </p>
              )}
              {igAccounts.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-teal-700 underline underline-offset-2 hover:text-teal-800 disabled:opacity-50"
                  onClick={() => startIgConnect(true)}
                  disabled={connectingIg}
                >
                  Sign in with a different Instagram account
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* TikTok Card */}
      <Card className="border-teal-100 bg-background shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-teal-800">
            <Music2 className="h-5 w-5" />
            TikTok
          </CardTitle>
          <CardDescription>
            Connect up to {MAX_TT_ACCOUNTS} TikTok accounts.
            Content is sent to your TikTok inbox as a draft for you to review and publish.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ttAccounts.length > 0 && (
            <div className="space-y-3">
              {ttAccounts.map((account) => (
                <div
                  key={account.openId}
                  className="flex items-center justify-between p-3 rounded-lg bg-teal-50/50 border border-teal-100"
                >
                  <div className="flex items-center gap-2">
                    {account.avatarUrl && (
                      <Image
                        src={account.avatarUrl}
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full"
                      />
                    )}
                    <p className="text-sm text-stone-600">
                      <strong className="text-teal-700">@{account.username}</strong>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                    onClick={() => handleDisconnectTt(account.openId)}
                    disabled={disconnectingId === account.openId}
                  >
                    {disconnectingId === account.openId ? "Disconnecting\u2026" : "Disconnect"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {canAddTt && (
            <>
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700"
                onClick={() => startTtConnect(false)}
                disabled={connectingTt}
              >
                {connectingTt ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Connecting&hellip;</>
                ) : (
                  <><Music2 className="h-4 w-4" /> {ttAccounts.length === 0 ? "Connect TikTok" : "Connect Another"}</>
                )}
              </Button>
              {ttAccounts.length > 0 && (
                <p className="text-xs text-stone-500">
                  Uses the TikTok account you&apos;re already signed into in this browser — no need to log out.
                  Already connected accounts here stay linked.
                </p>
              )}
              {ttAccounts.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-teal-700 underline underline-offset-2 hover:text-teal-800 disabled:opacity-50"
                  onClick={() => startTtConnect(true)}
                  disabled={connectingTt}
                >
                  Sign in with a different TikTok account
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {hasAnyAccount && (
        <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
          <Link href="/blou/manager/publish">Go to Publish</Link>
        </Button>
      )}
    </div>
  );
}
