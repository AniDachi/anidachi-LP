import { ExtensionAuthInitiationQuerySchema } from "@anidachi/protocol";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  createExtensionAuthCode,
  isSafeExtensionRedirectUri,
  readApprovedExtensionClientId,
} from "@/lib/anidachi-auth/extension-codes";
import {
  createExtensionAuthLoginRedirect,
  extensionAuthLoginRedirectForEnvelope,
  openExtensionAuthHandoff,
} from "@/lib/anidachi-auth/extension-auth-handoff";
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
  const direct = ExtensionAuthInitiationQuerySchema.safeParse(params);
  const handoffEnvelope =
    !direct.success &&
    Object.keys(params).length === 1 &&
    typeof params.handoff === "string"
      ? params.handoff
      : null;
  const request = direct.success
    ? direct.data
    : handoffEnvelope
      ? await openExtensionAuthHandoff(handoffEnvelope)
      : null;

  if (!request) {
    redirect("/login?error=extension_invalid_redirect");
  }

  const clientId = request.client_id;
  const redirectUri = request.redirect_uri;
  const state = request.state;
  if (
    clientId !== readApprovedExtensionClientId() ||
    !isSafeExtensionRedirectUri(redirectUri, "/auth", clientId)
  ) {
    redirect("/login?error=extension_invalid_redirect");
  }

  const session = await getSession();
  if (!session) {
    let loginRedirect: string;
    try {
      loginRedirect = handoffEnvelope
        ? extensionAuthLoginRedirectForEnvelope(handoffEnvelope)
        : await createExtensionAuthLoginRedirect(request);
    } catch {
      redirect("/login?error=extension_invalid_redirect");
    }
    redirect(loginRedirect);
  }

  const code = await createExtensionAuthCode({
    userId: session.userId,
    clientId,
    redirectUri,
    state,
    codeChallenge: request.code_challenge,
    codeChallengeMethod: request.code_challenge_method,
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
