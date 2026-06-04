interface ImportMetaEnv {
  readonly WXT_API_HTTP_BASE?: string;
  readonly WXT_API_WS_BASE?: string;
  readonly WXT_BUILD_ID?: string;
  readonly WXT_BROAD_HOST_PERMISSIONS?: string;
  readonly WXT_EXTENSION_CHANNEL?: string;
  readonly WXT_EXPERIMENT_HOLD_FIRE_SUPER_REACTION?: string;
  readonly WXT_MEDIA_TRANSPORT?: string;
  readonly WXT_WEB_HTTP_BASE?: string;
  readonly WXT_P2P_ENABLE_OPEN_RELAY_TURN?: string;
  readonly WXT_P2P_FORCE_RELAY?: string;
  readonly WXT_P2P_ICE_SERVERS_JSON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
