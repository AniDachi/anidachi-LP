import {
  del as vercelBlobDel,
  get as vercelBlobGet,
  put as vercelBlobPut,
} from "@vercel/blob";

const EXACT_PRIVATE_PATHS = new Set([
  "instagram/credentials.json",
  "tiktok/credentials.json",
  "youtube/credentials.json",
  "google-ads/tokens.json",
  "kreatli-crm/gmail-tokens.json",
  "kreatli-crm/contacts.json",
  "kreatli-crm/touches.jsonl",
  "kreatli-crm/meta.json",
  "kreatli-crm/contact-messages.jsonl",
  "kreatli-crm/feature-requests.jsonl",
]);

const OPENCLAW_JOB_PATH =
  /^openclaw\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;

type PrivateAuth =
  | { token: string }
  | { storeId: string; oidcToken?: string };

type PrivateGetOptions = { access: "private" } & PrivateAuth;
type LegacyGetOptions = { access: "public"; token: string };
type PrivateWriteOptions = PrivateAuth & {
  access: "private";
  addRandomSuffix: false;
  allowOverwrite: true;
  cacheControlMaxAge: 60;
  contentType: "application/json" | "application/x-ndjson";
};

type BlobReadResult = {
  statusCode: number;
  stream: ReadableStream<Uint8Array> | null;
  blob: {
    pathname: string;
    contentType?: string | null;
    size?: number | null;
    etag?: string;
    cacheControl?: string;
  };
} | null;

export type PrivateIntegrationBlobSdk = {
  get: (
    pathname: string,
    options: PrivateGetOptions | LegacyGetOptions,
  ) => Promise<BlobReadResult>;
  put: (
    pathname: string,
    body: string | ReadableStream<Uint8Array>,
    options: PrivateWriteOptions,
  ) => Promise<{ pathname: string }>;
  del: (pathname: string, options: PrivateAuth) => Promise<unknown>;
};

const DEFAULT_SDK: PrivateIntegrationBlobSdk = {
  get: vercelBlobGet as PrivateIntegrationBlobSdk["get"],
  put: vercelBlobPut as PrivateIntegrationBlobSdk["put"],
  del: vercelBlobDel as PrivateIntegrationBlobSdk["del"],
};

export function isPrivateIntegrationBlobPath(pathname: string): boolean {
  return (
    EXACT_PRIVATE_PATHS.has(pathname) || OPENCLAW_JOB_PATH.test(pathname)
  );
}

function assertPrivatePath(pathname: string): void {
  if (!isPrivateIntegrationBlobPath(pathname)) {
    throw new Error(`${pathname} is not an allowed private integration Blob path`);
  }
}

function privateOptions(auth: PrivateAuth): PrivateGetOptions {
  return { access: "private", ...auth };
}

function contentTypeFor(pathname: string): PrivateWriteOptions["contentType"] {
  return pathname.endsWith(".jsonl")
    ? "application/x-ndjson"
    : "application/json";
}

export function createPrivateIntegrationBlobClient(input: {
  privateAuth: PrivateAuth;
  legacyRead?: { enabled: boolean; token?: string | null };
  sdk?: PrivateIntegrationBlobSdk;
}) {
  const sdk = input.sdk ?? DEFAULT_SDK;

  return {
    async readText(pathname: string): Promise<string | null> {
      assertPrivatePath(pathname);

      const privateResult = await sdk.get(
        pathname,
        privateOptions(input.privateAuth),
      );
      if (privateResult?.statusCode === 200 && privateResult.stream) {
        if (privateResult.blob.pathname !== pathname) {
          await privateResult.stream.cancel().catch(() => undefined);
          throw new Error(`Private Blob returned an unexpected pathname for ${pathname}`);
        }
        return new Response(privateResult.stream).text();
      }

      const legacyToken = input.legacyRead?.token?.trim();
      if (!input.legacyRead?.enabled || !legacyToken) return null;

      const legacyResult = await sdk.get(pathname, {
        access: "public",
        token: legacyToken,
      });
      if (
        !legacyResult ||
        legacyResult.statusCode !== 200 ||
        !legacyResult.stream
      ) {
        return null;
      }
      if (legacyResult.blob.pathname !== pathname) {
        await legacyResult.stream.cancel().catch(() => undefined);
        throw new Error(`Legacy Blob returned an unexpected pathname for ${pathname}`);
      }
      return new Response(legacyResult.stream).text();
    },

    async writeText(pathname: string, text: string): Promise<void> {
      assertPrivatePath(pathname);
      const result = await sdk.put(pathname, text, {
        access: "private",
        ...input.privateAuth,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: contentTypeFor(pathname),
      });
      if (result.pathname !== pathname) {
        throw new Error(`Private Blob wrote an unexpected pathname for ${pathname}`);
      }
    },

    async delete(pathname: string): Promise<void> {
      assertPrivatePath(pathname);
      await sdk.del(pathname, input.privateAuth);
    },
  };
}

function runtimePrivateAuth(): PrivateAuth | null {
  const token = process.env.PRIVATE_INTEGRATION_BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { token };

  const storeId = process.env.PRIVATE_INTEGRATION_BLOB_STORE_ID?.trim();
  if (!storeId) return null;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  return oidcToken ? { storeId, oidcToken } : { storeId };
}

function runtimeClient() {
  const privateAuth = runtimePrivateAuth();
  if (!privateAuth) {
    throw new Error("Private integration Blob storage is not configured");
  }
  return createPrivateIntegrationBlobClient({
    privateAuth,
    legacyRead: {
      enabled:
        process.env.PRIVATE_INTEGRATION_BLOB_LEGACY_READS_ENABLED === "true",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    },
  });
}

export function hasPrivateIntegrationBlobConfiguration(): boolean {
  return runtimePrivateAuth() !== null;
}

export async function readPrivateIntegrationBlobText(
  pathname: string,
): Promise<string | null> {
  return runtimeClient().readText(pathname);
}

export async function writePrivateIntegrationBlobText(
  pathname: string,
  text: string,
): Promise<void> {
  await runtimeClient().writeText(pathname, text);
}

export async function deletePrivateIntegrationBlob(
  pathname: string,
): Promise<void> {
  await runtimeClient().delete(pathname);
}
