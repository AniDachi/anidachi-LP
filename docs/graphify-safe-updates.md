# Safe incremental Graphify updates

Use `pnpm graph:update:code` for structural code changes. The repository adapter
uses the Python environment belonging to the installed `graphify` executable;
it does not install packages or invoke an LLM. It updates fresh AST sources,
preserves existing semantic records, regenerates the report, and stamps only
the successfully extracted AST sources.

For documentation, keep using `$graphify . --update` in Codex. Follow the skill's
detect/cache/subagent extraction steps, then use the repository adapter for
merging and publishing the extracted fragments:

```sh
node scripts/graphify-code-update.mjs --semantic /absolute/path/to/fragment.json
```

The fragment contains `nodes`, `edges`, `hyperedges`, and `source_hashes` mapping
every completely extracted repository-relative source path to its SHA-256 at
read time. Every record carries its actual source file. Missing semantic output,
foreign source ownership, conflicting IDs, stale hashes, dangling endpoints and
concurrent artifact changes fail before publication. Never stamp a whole file
after reading only its changed header. Failed/omitted files stay pending.

This intentionally replaces the skill's standard `build_merge`/`build_from_json`
round-trip for both historical and fresh records. In Graphify 0.9.64, a no-op round-trip of
our curated graph removed a documented migration concept, collapsed parallel
links and changed unrelated labels/provenance. `--no-dedup` also refused the
unexplained node loss. Even a fresh `DiGraph` collapses multiple relations for
the same directed pair. `extract()` already resolves cross-file AST imports;
the adapter retains that raw output and attributed external import stubs.
Semantic fragments use stable source-grounded IDs. The raw JSON merge retains
unchanged records, directed endpoints, parallel facts and historical metadata.
If a legacy bundle has both top-level and nested hyperedges, the top-level list
(Graphify's read precedence) is authoritative; the nested copy is synchronized.

Each re-extracted source replaces only its own AST or semantic layer. A same-file
ID used by both layers retains the historical record and gives the incoming
layer an explicit `_ast` or `_semantic` ID; only that layer's fresh edges follow
the alias. Removed symbols legitimately retire incoming edges and hyperedges
that depended on their IDs. Unknown new endpoints fail rather than creating
unattributed nodes. AST updates do not refresh potentially stale semantic
interpretations of code; those remain separate extraction work.

The report uses a simple undirected analysis projection and retained communities;
it is not a fresh global clustering. Its edge count can be lower than the raw
stored relationship count. The report explains both counts. Graphify remains a
navigation aid, not evidence overriding current source, tests or deployment.

Graph/report/manifest are prepared before replacement. A local exclusive lock
serializes adapter runs; source and artifact hashes are checked before writing.
The staged manifest hashes must match the bytes read before extraction. Sources
are checked again after staging, immediately before publication; a concurrent
edit cannot receive a manifest stamp for an older extraction.
A recoverable `.backup-*` bundle is kept under ignored `graphify-out/`, and
ordinary write failures restore already-replaced artifacts. A process or machine
crash during replacement can still require restoring that bundle. Do not run a
second raw Graphify writer concurrently. Only `graph.json`, `GRAPH_REPORT.md` and
`manifest.json` are committed; no backups/cache/lock files.

Verification:

```sh
"$(cat graphify-out/.graphify_python)" -m unittest discover -s scripts -p 'graphify_*test.py'
node --test scripts/graphify-code-update.test.mjs
```

The integration test uses a disposable corpus and proves document-concept
preservation, parallel relationships, normalized imports, no-op stability,
unextracted semantic hashes, and stale-fragment rejection before publication.
Python regressions also exercise fresh parallel facts, source edits during
manifest creation, nested hyperedge cleanup, tier aliases and source deletions.

For an explicit repair of previously stamped code, pass `--ast-sources` with a
JSON array of repository-relative code paths. The adapter accepts only files in
the detected code corpus, re-extracts them and includes normal pending changes.
It never erases manifest rows to pretend the previous extraction did not happen.
