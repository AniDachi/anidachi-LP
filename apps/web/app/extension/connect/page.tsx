import { ExtensionAuthInitiationQuerySchema } from "@anidachi/protocol";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  createExtensionAuthCode,
  isSafeExtensionRedirectUri,
  readApprovedExtensionClientId,
} from "@/lib/anidachi-auth/extension-codes";
import { getSession } from "@/lib/anidachi-auth/session";
import { isMobileUserAgent } from "@/lib/mobile-user-agent";
import { ExtensionConnectMobileConfirm } from "./extension-connect-mobile-confirm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExtensionConnectPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = ExtensionAuthInitiationQuerySchema.safeParse(params);

  if (!parsed.success) {
    redirect("/login?error=extension_invalid_redirect");
  }

  const clientId = parsed.data.client_id;
  const redirectUri = parsed.data.redirect_uri;
  const state = parsed.data.state;
  if (
    clientId !== readApprovedExtensionClientId() ||
    !isSafeExtensionRedirectUri(redirectUri, "/auth", clientId)
  ) {
    redirect("/login?error=extension_invalid_redirect");
  }

  const session = await getSession();
  if (!session) {
    const nextParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: parsed.data.code_challenge,
      code_challenge_method: parsed.data.code_challenge_method,
    });
    const next = `/extension/connect?${nextParams.toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const code = await createExtensionAuthCode({
    userId: session.userId,
    clientId,
    redirectUri,
    state,
    codeChallenge: parsed.data.code_challenge,
    codeChallengeMethod: parsed.data.code_challenge_method,
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
