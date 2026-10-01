"""Lossless per-source graph updates; never rebuild the historical JSON in NetworkX."""
from collections import defaultdict, deque
from copy import deepcopy
from pathlib import PurePosixPath


def tier(item):
    if item.get("_origin"):
        return item["_origin"]
    # Older manually extracted semantic edges can have L-prefixed locations.
    # A line number alone does not make a document relationship an AST record.
    if PurePosixPath(item.get("source_file") or "").suffix in {".md", ".txt", ".pdf", ".yml"}:
        return "semantic"
    return "ast"


def validate(graph):
    ids = [n["id"] for n in graph["nodes"]]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate node ID")
    known = set(ids)
    for e in graph["links"]:
        if e.get("source") not in known or e.get("target") not in known:
            raise ValueError(f"Dangling edge: {e.get('source')} -> {e.get('target')}")
    for h in graph.get("hyperedges", []):
        if not set(h.get("nodes", [])).issubset(known):
            raise ValueError(f"Dangling hyperedge: {h.get('id')}")


def merge_graph(base, fresh, ast_sources, semantic_sources, *, deleted=frozenset()):
    """Inputs must use canonical, repository-relative source paths.

    Unchanged records, metadata, directions and parallel relationships survive
    byte-for-byte at the JSON-value level. Removed endpoints legitimately retire
    their incoming edges/hyperedges; unknown fresh endpoints are errors.
    """
    base = deepcopy(base)
    # Graphify reads the top-level list first. Older bundles also keep a nested
    # copy; reconcile it instead of leaving retired members hidden in metadata.
    nested = base.get("graph", {})
    if "hyperedges" in nested:
        base.setdefault("hyperedges", deepcopy(nested["hyperedges"]))
        nested["hyperedges"] = deepcopy(base["hyperedges"])
    validate(base)
    fresh = deepcopy(fresh)
    scopes = {"ast": set(ast_sources), "semantic": set(semantic_sources)}
    deleted = set(deleted) - scopes["ast"] - scopes["semantic"]
    semantic_output = {n.get("source_file") for n in fresh.get("nodes", []) if tier(n) == "semantic"}
    if scopes["semantic"] - semantic_output:
        raise ValueError("Missing semantic output for a requested source")

    def changed(item):
        source = item.get("source_file")
        return source in deleted or source in scopes.get(tier(item), set())

    for group in ("nodes", "edges", "hyperedges"):
        for item in fresh.get(group, []):
            if item.get("source_file") and not changed(item):
                raise ValueError(f"Fragment exceeds its source scope: {item['source_file']}")

    # A historical semantic summary may intentionally use the file's AST ID.
    # Preserve both layers rather than overwriting the curated explanation.
    previous = {n["id"]: n for n in base["nodes"]}
    remap = {}
    fresh_ids = {n["id"] for n in fresh.get("nodes", [])}
    for n in fresh.get("nodes", []):
        old = previous.get(n["id"])
        if old and not changed(old) and old.get("source_file") == n.get("source_file") and tier(old) != tier(n):
            id = n["id"] + "_" + tier(n)
            if id in fresh_ids or (id in previous and not changed(previous[id])):
                raise ValueError(f"Tier alias collision: {id}")
            remap[(tier(n), n["id"])] = id
            n["id"] = id
    for e in fresh.get("edges", []):
        e["source"] = remap.get((tier(e), e["source"]), e["source"])
        e["target"] = remap.get((tier(e), e["target"]), e["target"])
    for h in fresh.get("hyperedges", []):
        h["nodes"] = [remap.get((tier(h), id), id) for id in h["nodes"]]

    def stable_fields(old, replacement):
        return {**{k: replacement[k] for k in old if k in replacement},
                **{k: v for k, v in replacement.items() if k not in old}}

    incoming = {}
    for n in fresh.get("nodes", []):
        if n["id"] in incoming and incoming[n["id"]] != n:
            raise ValueError(f"Conflicting fresh node: {n['id']}")
        incoming[n["id"]] = n
    nodes = []
    for n in base["nodes"]:
        replacement = incoming.pop(n["id"], None)
        if not changed(n):
            if replacement is not None and replacement != n:
                # Structural extractors may reference an existing external node.
                if replacement.get("source_file"):
                    raise ValueError(f"Foreign node collision: {n['id']}")
            nodes.append(deepcopy(n))
        elif replacement is not None:
            # Keep stable community placement; report is recalculated separately.
            for key in ("community", "community_name"):
                if key in n and key not in replacement:
                    replacement[key] = n[key]
            if n.get("label") == replacement.get("label") and "norm_label" in n:
                replacement.setdefault("norm_label", n["norm_label"])
            nodes.append(stable_fields(n, replacement))
    nodes.extend(incoming.values())
    known = {n["id"] for n in nodes}
    removed = {n["id"] for n in base["nodes"]} - known
    def edge_key(e):
        return (e["source"], e["target"], e.get("relation"), e.get("source_file"), tier(e))
    pending = defaultdict(deque)
    for e in fresh.get("edges", []):
        if e not in pending[edge_key(e)]:
            pending[edge_key(e)].append(e)
    edges = []
    for e in base["links"]:
        if e["source"] in removed or e["target"] in removed:
            continue
        if not changed(e):
            edges.append(deepcopy(e))
        elif pending[edge_key(e)]:
            edges.append(stable_fields(e, pending[edge_key(e)].popleft()))
    # Deduplicate only identical new facts. Pair-based dedup loses provenance,
    # opposite directions and distinct relations between the same two nodes.
    for group in pending.values():
        for e in group:
            if e not in edges:
                edges.append(e)
    hyperedges = [deepcopy(h) for h in base.get("hyperedges", []) if not changed(h)
                  and not (set(h.get("nodes", [])) & removed)]
    for h in fresh.get("hyperedges", []):
        if h not in hyperedges:
            hyperedges.append(h)
    result = {**deepcopy(base), "nodes": nodes, "links": edges}
    if "hyperedges" in base or hyperedges:
        result["hyperedges"] = hyperedges
    if "hyperedges" in result.get("graph", {}):
        result["graph"]["hyperedges"] = deepcopy(hyperedges)
    validate(result)
    return result
