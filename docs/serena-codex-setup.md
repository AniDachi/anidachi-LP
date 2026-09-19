# Serena with Codex

Serena is an optional local code-navigation tool. It does not run in the website,
Worker, or extension, and does not change the release process. Verified baseline:
Serena 1.7.0, TypeScript 6.0.3, typescript-language-server 5.1.3.

## Host setup

Install the pinned `serena-agent==1.7.0` package in a dedicated Python 3.13
environment outside the repository. Preserve any existing Serena installation.
Use the full executable path in a single user-level `[mcp_servers.serena]` entry
in the host's Codex `config.toml`; do not also register a project-local duplicate.

Configure stdio with `start-mcp-server --context codex --project-from-cwd`.
Do not put an AniDachi checkout path in the global `cwd` or `--project` arguments.
Ensure Node 22.23.1 is on the server's PATH even when the desktop app does not load
the shell profile. Allow 90 seconds for startup and 120 seconds for tool calls;
keep the server optional so unavailable navigation does not block Codex.

Give this installation a dedicated `SERENA_HOME` and set
`SERENA_USAGE_REPORTING=false`. Disable the web dashboard and automatic browser
opening. Use only these tools, both in Serena's `fixed_tools` and Codex's
`enabled_tools`:

```text
activate_project
get_current_config
initial_instructions
get_symbols_overview
find_symbol
find_referencing_symbols
```

Set Serena's `base_modes: []` and `default_modes: [no-memories, no-onboarding]`.
Do not add editing, shell, onboarding, memory-writing tools, lifecycle hooks, or
automatic command approvals. These tool limits are not an OS filesystem sandbox.
Codex can still make owner-approved edits through its ordinary editing tools.

The host's `trusted_project_path_patterns` must cover only the intended AniDachi
clone/worktree paths for its project-specific TypeScript settings to apply.
Do not trust the whole home directory or all projects with `**`. Keep
`activation_command: null`. Retain `$projectDir/.serena` for project state, so
different worktrees do not share symbol caches. Do not centralize caches using
only `$projectFolderName`: linked worktrees have the same folder name.

## Each task and worktree

1. Resolve the actual checkout with `git rev-parse --show-toplevel`.
2. Read `initial_instructions`, activate that **absolute path**, and inspect
   `get_current_config`. Project names alone are ambiguous across worktrees.
3. Use `.serena/project.yml` from this checkout. The TypeScript subprojects in
   `ls_additional_workspace_folders` must all load for cross-package references.
4. If this is a fresh development checkout, prepare its locked dependencies and
   generated WXT types before relying on references:

   ```sh
   fnm exec --using="$(cat .node-version)" pnpm install --frozen-lockfile --ignore-scripts
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec wxt prepare
   ```

   These commands install dependencies and generate ignored local types; they
   do not build or publish an extension ZIP. Respect a read-only task boundary:
   if setup has not been authorized, report the missing prerequisites and use
   source/text search instead of silently installing dependencies.

5. Verify a definition and its references before relying on the index. Recheck
   activation after any worktree handoff. Never attach a task to the pilot copy.

Use stdio instances for different worktrees, not a shared HTTP server with a
mutable active project. After changing MCP configuration, reload the connection
or restart the desktop app if tools are not available in an existing task. An
entry in `config.toml` alone does not establish that the live task has connected.

New worktrees inherit the tracked project settings and `AGENTS.md` from their
starting commit. Older worktrees need the reviewed tooling commit before these
instructions are present. Existing active tasks may need an explicit reminder
to activate their current checkout after the MCP connection refreshes.

## Verification and limits

Use `resolveRoomMediaDefaults` in `apps/extension/src/room-media-defaults.ts`,
`RoomPeopleSection` in `apps/extension/src/overlay-room-media-controls.tsx`, and
`getPlanPolicy` in `packages/protocol/src/commercial-policy.ts` as smoke examples.
The component has consumers in the extension and website; the plan function has
consumers in protocol, API tests, and website code. Verify against current source,
not a frozen expected count after future changes.

The initial pilot omitted cross-package references until all four TypeScript
subprojects were activated. An empty result, indexing timeout, or missing package
dependency is therefore not proof that a symbol is unused. Confirm important
results with source/text search and tests. No token-saving percentage is promised.

## Git and rollback

Track only `.serena/project.yml`, these instructions, and the short `AGENTS.md`
rule. `.serena` caches, logs, memories, and `project.local.yml` stay ignored.
Host paths, host configuration backups, and verification receipts stay outside Git.

To disable Serena, set its MCP `enabled = false` and refresh the connection.
Remove only this server's entry if uninstalling the integration; preserve other
MCP settings. Reverting the tooling commit removes the shared instructions without
changing product behavior. Do not restore a whole stale host config over later
unrelated changes. No production deployment or ZIP replacement is required.

## Sources

- [Codex MCP configuration](https://developers.openai.com/codex/mcp/)
- [Serena Codex integration](https://oraios.github.io/serena/02-usage/030_clients.html#codex-cli-and-app)
- [Serena project workflow](https://oraios.github.io/serena/02-usage/040_workflow.html)
- [Serena 1.7.0 project template](https://github.com/oraios/serena/blob/v1.7.0/src/serena/resources/project.template.yml)
