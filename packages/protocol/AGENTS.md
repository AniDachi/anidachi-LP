# packages/protocol Agent Instructions

`packages/protocol` owns shared Zod schemas, TypeScript types, room event
contracts, snapshots, sync math, and compatibility boundaries between web,
Worker, and extension runtimes.

## Source Of Truth

- Start with root `AGENTS.md`, `docs/project-operating-manual.md`, and active
  room/P2P plans before changing protocol behavior.
- Use actual consumers in `apps/api`, `apps/extension`, and `apps/web` to verify
  how a schema is used before changing it.

## Rules

- Treat protocol changes as cross-plane changes by default.
- Prefer additive, backward-compatible changes unless a deliberate migration is
  documented and all consumers update together.
- Keep event names, generation/sequence semantics, and snapshot shapes explicit.
  Do not rely on ad hoc untyped payload fields.
- Update protocol tests and affected consumers in the same change when schema
  behavior changes.
- Do not bypass this package when changing room event shapes or shared room
  contracts.

## Verification

- Run `pnpm --filter @anidachi/protocol check` and
  `pnpm --filter @anidachi/protocol test`.
- Also run checks/tests for affected consumers: API, extension, and web.
- Run `pnpm harness:rooms` for room event, snapshot, generation, or signaling
  contract changes.
