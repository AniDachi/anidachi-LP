# Production sideload signing key

The production public `key` in `wxt.config.ts` keeps the unpacked Chrome
extension ID stable across Load unpacked installs.

Keep the matching private PEM at:

```txt
apps/extension/.keys/production-sideload-private.pem
```

Rules:

- Never commit `*.pem` files.
- Never rotate this key without migrating Google/Discord `chromiumapp.org`
  redirect URIs and telling sideload users to reinstall.
- Staging and local builds must not include this `key`.
- The public zip users download must be `pnpm build:extension:public` +
  `pnpm validate:extension:production`. Never ship `build:extension:staging:broad`.

Recover the public key from the private PEM:

```bash
openssl rsa -in apps/extension/.keys/production-sideload-private.pem -pubout -outform DER | openssl base64 -A
```
