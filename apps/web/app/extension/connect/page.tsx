import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  createExtensionAuthCode,
  isSafeExtensionRedirectUri,
} from "@/lib/anidachi-auth/extension-codes";
import { getSession } from "@/lib/anidachi-auth/session";
import { isMobileUserAgent } from "@/lib/mobile-user-agent";
import { ExtensionConnectMobileConfirm } from "./extension-connect-mobile-confirm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{
    redirect_uri?: string;
    state?: string;
  }>;
};

export default async function ExtensionConnectPage({ searchParams }: Props) {
  const params = await searchParams;
  const redirectUri = params.redirect_uri ?? "";
  const state = params.state ?? "";

  if (!redirectUri || !state || !isSafeExtensionRedirectUri(redirectUri)) {
    redirect("/login?error=extension_invalid_redirect");
  }

  const session = await getSession();
  if (!session) {
    const next = `/extension/connect?redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${encodeURIComponent(state)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const code = await createExtensionAuthCode({
    userId: session.userId,
    redirectUri,
    state,
  });

  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", state);

  const userAgent = (await headers()).get("user-agent");
  if (isMobileUserAgent(userAgent)) {
    return <ExtensionConnectMobileConfirm callbackUrl={callback.toString()} />;
  }

  redirect(callback.toString());
}
