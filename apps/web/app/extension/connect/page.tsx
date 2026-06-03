import { redirect } from "next/navigation";
import {
  createExtensionAuthCode,
  isSafeExtensionRedirectUri,
} from "@/lib/anidachi-auth/extension-codes";
import { getSession } from "@/lib/anidachi-auth/session";

export const dynamic = "force-dynamic";

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
  redirect(callback.toString());
}
