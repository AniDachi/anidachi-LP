# @anidachi/web

Next.js website for Anidachi: marketing pages, auth, rooms, extension auth, billing,
SEO content, and Supabase migrations.

Run from the monorepo root:

```bash
pnpm --filter @anidachi/web dev
pnpm --filter @anidachi/web build
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
```

Local environment:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Production and staging environment rules are documented in
`docs/development-environments.md`.
