import {
  BlobPreconditionFailedError,
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

type PrivateGetOptions = { access: "private"; useCache: false } & PrivateAuth;
type WriteOptions = {
  addRandomSuffix: false;
  allowOverwrite: boolean;
  cacheControlMaxAge: 60;
  contentType: "application/json" | "application/x-ndjson";
};
type PrivateWriteOptions = PrivateAuth & WriteOptions & {
  access: "private";
  ifMatch?: string;
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
    options: PrivateGetOptions,
  ) => Promise<BlobReadResult>;
  put: (
    pathname: string,
    body: string | ReadableStream<Uint8Array>,
    options: PrivateWriteOptions,
  ) => Promise<{ pathname: string }>;
  del: (pathname: string, options: PrivateAuth) => Promise<unknown>;
};

export type PrivateBlobSnapshot = {
  pathname: string;
  text: string;
  etag: string;
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
  return { access: "private", ...auth, useCache: false };
}

function contentTypeFor(pathname: string): WriteOptions["contentType"] {
  return pathname.endsWith(".jsonl")
    ? "application/x-ndjson"
    : "application/json";
}

export function createPrivateIntegrationBlobClient(input: {
  privateAuth: PrivateAuth;
  sdk?: PrivateIntegrationBlobSdk;
}) {
  const sdk = input.sdk ?? DEFAULT_SDK;

  async function readResult(
    pathname: string,
    options: PrivateGetOptions,
  ): Promise<PrivateBlobSnapshot | null> {
    const result = await sdk.get(pathname, options);
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    if (result.blob.pathname !== pathname) {
      await result.stream.cancel().catch(() => undefined);
      throw new Error(
        `Private Blob returned an unexpected pathname for ${pathname}`,
      );
    }
    const etag = result.blob.etag?.trim();
    if (!etag) {
      await result.stream.cancel().catch(() => undefined);
      throw new Error(`Private Blob returned no ETag for ${pathname}`);
    }
    return {
      pathname,
      text: await new Response(result.stream).text(),
      etag,
    };
  }

  async function writeResult(
    pathname: string,
    text: string,
    options: PrivateWriteOptions,
  ): Promise<void> {
    const result = await sdk.put(pathname, text, options);
    if (result.pathname !== pathname) {
      throw new Error(
        `Private Blob wrote an unexpected pathname for ${pathname}`,
      );
    }
  }

  return {
    async readSnapshot(
      pathname: string,
    ): Promise<PrivateBlobSnapshot | null> {
      assertPrivatePath(pathname);
      return readResult(pathname, privateOptions(input.privateAuth));
    },

    async readText(pathname: string): Promise<string | null> {
      assertPrivatePath(pathname);
      const snapshot = await readResult(
        pathname,
        privateOptions(input.privateAuth),
      );
      return snapshot?.text ?? null;
    },

    async writeText(pathname: string, text: string): Promise<void> {
      assertPrivatePath(pathname);

      const commonOptions: WriteOptions = {
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: contentTypeFor(pathname),
      };
      await writeResult(
        pathname,
        text,
        {
          access: "private",
          ...input.privateAuth,
          ...commonOptions,
        },
      );
    },

    async updateText(
      pathname: string,
      mutate: (current: string | null) => string | Promise<string>,
    ): Promise<string> {
      assertPrivatePath(pathname);
      const maxAttempts = 4;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const snapshot = await readResult(
          pathname,
          privateOptions(input.privateAuth),
        );
        const next = await mutate(snapshot?.text ?? null);
        const commonOptions: WriteOptions = {
          addRandomSuffix: false,
          allowOverwrite: snapshot !== null,
          cacheControlMaxAge: 60,
          contentType: contentTypeFor(pathname),
        };

        try {
          await writeResult(pathname, next, {
            access: "private",
            ...input.privateAuth,
            ...commonOptions,
            ...(snapshot ? { ifMatch: snapshot.etag } : {}),
          });
          return next;
        } catch (error) {
          if (
            !(error instanceof BlobPreconditionFailedError) ||
            attempt === maxAttempts
          ) {
            throw error;
          }
        }
      }

      throw new Error(`Private Blob update attempts exhausted for ${pathname}`);
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

function runtimeKreatliCrmAuth(): PrivateAuth | null {
  const token = process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { token };

  const storeId = process.env.KREATLI_CRM_BLOB_STORE_ID?.trim();
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
  });
}

function runtimeKreatliCrmClient() {
  const privateAuth = runtimeKreatliCrmAuth();
  if (!privateAuth) {
    throw new Error("Kreatli CRM Blob storage is not configured");
  }
  return createPrivateIntegrationBlobClient({ privateAuth });
}

export function hasPrivateIntegrationBlobConfiguration(): boolean {
  return runtimePrivateAuth() !== null;
}

export function hasKreatliCrmBlobConfiguration(): boolean {
  return runtimeKreatliCrmAuth() !== null;
}

export async function readKreatliCrmBlobText(
  pathname: string,
): Promise<string | null> {
  return runtimeKreatliCrmClient().readText(pathname);
}

export async function writeKreatliCrmBlobText(
  pathname: string,
  text: string,
): Promise<void> {
  await runtimeKreatliCrmClient().writeText(pathname, text);
}

export async function updateKreatliCrmBlobText(
  pathname: string,
  mutate: (current: string | null) => string | Promise<string>,
): Promise<string> {
  return runtimeKreatliCrmClient().updateText(pathname, mutate);
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
