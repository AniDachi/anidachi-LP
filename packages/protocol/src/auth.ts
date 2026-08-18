import { z } from "zod";

export const EXTENSION_AUTH_REDIRECT_URI_MAX_CHARS = 256;
export const EXTENSION_AUTH_STATE_MAX_CHARS = 128;
export const EXTENSION_AUTH_CODE_MAX_CHARS = 128;

const Base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);

export const ExtensionAuthClientIdSchema = z.string().regex(/^[a-p]{32}$/);
export const ExtensionAuthRedirectUriSchema = z
  .string()
  .min(1)
  .max(EXTENSION_AUTH_REDIRECT_URI_MAX_CHARS);
export const ExtensionAuthStateSchema = Base64UrlSchema.min(32).max(
  EXTENSION_AUTH_STATE_MAX_CHARS,
);
export const ExtensionAuthCodeSchema = Base64UrlSchema.min(32).max(
  EXTENSION_AUTH_CODE_MAX_CHARS,
);
export const ExtensionPkceChallengeSchema = Base64UrlSchema.length(43);
export const ExtensionPkceVerifierSchema = z
  .string()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9._~-]+$/);
export const ExtensionPkceMethodSchema = z.literal("S256");

export const ExtensionAuthInitiationSchema = z
  .strictObject({
    clientId: ExtensionAuthClientIdSchema,
    redirectUri: ExtensionAuthRedirectUriSchema,
    state: ExtensionAuthStateSchema,
    codeChallenge: ExtensionPkceChallengeSchema,
    codeChallengeMethod: ExtensionPkceMethodSchema,
  })
  .superRefine((value, context) => {
    const expected = `https://${value.clientId}.chromiumapp.org/auth`;
    if (value.redirectUri !== expected) {
      context.addIssue({
        code: "custom",
        path: ["redirectUri"],
        message: "Redirect URI must exactly match the extension client auth callback",
      });
    }
  });

export const ExtensionAuthInitiationQuerySchema = z.strictObject({
  client_id: ExtensionAuthClientIdSchema,
  redirect_uri: ExtensionAuthRedirectUriSchema,
  state: ExtensionAuthStateSchema,
  code_challenge: ExtensionPkceChallengeSchema,
  code_challenge_method: ExtensionPkceMethodSchema,
});

export const ExtensionAuthExchangeRequestSchema = z
  .strictObject({
    clientId: ExtensionAuthClientIdSchema,
    redirectUri: ExtensionAuthRedirectUriSchema,
    state: ExtensionAuthStateSchema,
    code: ExtensionAuthCodeSchema,
    codeVerifier: ExtensionPkceVerifierSchema,
  })
  .superRefine((value, context) => {
    const expected = `https://${value.clientId}.chromiumapp.org/auth`;
    if (value.redirectUri !== expected) {
      context.addIssue({
        code: "custom",
        path: ["redirectUri"],
        message: "Redirect URI must exactly match the extension client auth callback",
      });
    }
  });

export const ExtensionAuthErrorCodeSchema = z.enum([
  "invalid_request",
  "invalid_client",
  "invalid_redirect_uri",
  "invalid_grant",
  "server_error",
]);

export const ExtensionAuthErrorSchema = z.strictObject({
  error: ExtensionAuthErrorCodeSchema,
});

export type ExtensionAuthInitiation = z.infer<typeof ExtensionAuthInitiationSchema>;
export type ExtensionAuthExchangeRequest = z.infer<
  typeof ExtensionAuthExchangeRequestSchema
>;
export type ExtensionAuthError = z.infer<typeof ExtensionAuthErrorSchema>;
