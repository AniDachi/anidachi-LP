import {
  BlobNotFoundError,
  del as vercelBlobDel,
  get as vercelBlobGet,
  head as vercelBlobHead,
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

type PrivateGetOptions = { access: "private"; useCache: false } & PrivateAuth;
type LegacyGetOptions = { access: "public"; token: string };
type WriteOptions = {
  addRandomSuffix: false;
  allowOverwrite: true;
  cacheControlMaxAge: 60;
  contentType: "application/json" | "application/x-ndjson";
};
type PrivateWriteOptions = PrivateAuth & WriteOptions & { access: "private" };
type LegacyWriteOptions = WriteOptions & { access: "public"; token: string };

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

type BlobHeadResult = {
  pathname: string;
  url: string;
  etag: string;
} | null;

export type PrivateIntegrationBlobSdk = {
  head: (pathname: string, options: PrivateAuth) => Promise<BlobHeadResult>;
  get: (
    pathname: string,
    options: PrivateGetOptions | LegacyGetOptions,
  ) => Promise<BlobReadResult>;
  put: (
    pathname: string,
    body: string | ReadableStream<Uint8Array>,
    options: PrivateWriteOptions | LegacyWriteOptions,
  ) => Promise<{ pathname: string }>;
  del: (pathname: string, options: PrivateAuth) => Promise<unknown>;
};

const DEFAULT_SDK: PrivateIntegrationBlobSdk = {
  head: async (pathname, options) => {
    try {
      return await vercelBlobHead(pathname, options);
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  },
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
  return { access: "private", ...auth, useCache: false };
}

function contentTypeFor(pathname: string): WriteOptions["contentType"] {
  return pathname.endsWith(".jsonl")
    ? "application/x-ndjson"
    : "application/json";
}

function normalizedEtag(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^W\//i, "")
    .replace(/^"|"$/g, "");
}

function phaseALegacyReadUrl(params: {
  pathname: string;
  metadata: Exclude<BlobHeadResult, null>;
}): { url: string; etag: string } {
  const { pathname, metadata } = params;
  const url = new URL(metadata.url);
  const etag = normalizedEtag(metadata.etag);
  if (
    metadata.pathname !== pathname ||
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".public.blob.vercel-storage.com") ||
    url.pathname.slice(1) !== pathname ||
    !etag
  ) {
    throw new Error(`Legacy Blob metadata was invalid for ${pathname}`);
  }
  url.search = "";
  url.searchParams.set("v", etag);
  return { url: url.toString(), etag };
}

export function createPrivateIntegrationBlobClient(input: {
  privateAuth: PrivateAuth;
  phaseALegacyAuthority?: { enabled: boolean; token?: string | null };
  sdk?: PrivateIntegrationBlobSdk;
}) {
  const sdk = input.sdk ?? DEFAULT_SDK;

  function phaseALegacyToken(): string | null {
    if (!input.phaseALegacyAuthority?.enabled) return null;
    const token = input.phaseALegacyAuthority.token?.trim();
    if (!token) {
      throw new Error("Phase-A legacy Blob authority is not configured");
    }
    return token;
  }

  async function readResult(
    requestTarget: string,
    expectedPathname: string,
    options: PrivateGetOptions | LegacyGetOptions,
    label: "Private" | "Legacy",
    expectedEtag?: string,
  ): Promise<string | null> {
    const result = await sdk.get(requestTarget, options);
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    if (result.blob.pathname !== expectedPathname) {
      await result.stream.cancel().catch(() => undefined);
      throw new Error(
        `${label} Blob returned an unexpected pathname for ${expectedPathname}`,
      );
    }
    if (
      expectedEtag &&
      normalizedEtag(result.blob.etag) !== normalizedEtag(expectedEtag)
    ) {
      await result.stream.cancel().catch(() => undefined);
      throw new Error(
        `Legacy Blob changed during the phase-A read for ${expectedPathname}`,
      );
    }
    return new Response(result.stream).text();
  }

  async function writeResult(
    pathname: string,
    text: string,
    options: PrivateWriteOptions | LegacyWriteOptions,
    label: "Private" | "Legacy",
  ): Promise<void> {
    const result = await sdk.put(pathname, text, options);
    if (result.pathname !== pathname) {
      throw new Error(
        `${label} Blob wrote an unexpected pathname for ${pathname}`,
      );
    }
  }

  return {
    async readText(pathname: string): Promise<string | null> {
      assertPrivatePath(pathname);

      const legacyToken = phaseALegacyToken();
      if (legacyToken) {
        const metadata = await sdk.head(pathname, { token: legacyToken });
        if (!metadata) return null;
        const fresh = phaseALegacyReadUrl({ pathname, metadata });
        return readResult(
          fresh.url,
          pathname,
          { access: "public", token: legacyToken },
          "Legacy",
          fresh.etag,
        );
      }

      return readResult(
        pathname,
        pathname,
        privateOptions(input.privateAuth),
        "Private",
      );
    },

    async writeText(pathname: string, text: string): Promise<void> {
      assertPrivatePath(pathname);

      const commonOptions: WriteOptions = {
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: contentTypeFor(pathname),
      };
      const legacyToken = phaseALegacyToken();
      if (legacyToken) {
        await writeResult(
          pathname,
          text,
          { access: "public", token: legacyToken, ...commonOptions },
          "Legacy",
        );
      }

      await writeResult(
        pathname,
        text,
        {
          access: "private",
          ...input.privateAuth,
          ...commonOptions,
        },
        "Private",
      );
    },

    async delete(pathname: string): Promise<void> {
      assertPrivatePath(pathname);
      const legacyToken = phaseALegacyToken();
      await sdk.del(pathname, input.privateAuth);
      if (legacyToken) await sdk.del(pathname, { token: legacyToken });
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
    phaseALegacyAuthority: {
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
