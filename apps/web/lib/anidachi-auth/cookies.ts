import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./token-policy";

export const ACCESS_TOKEN_COOKIE = "anidachi_access_token";
export const REFRESH_TOKEN_COOKIE = "anidachi_refresh_token";

export const ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS = ACCESS_TOKEN_TTL_SECONDS;
export const REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS = REFRESH_TOKEN_TTL_SECONDS;
