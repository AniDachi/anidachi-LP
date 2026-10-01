import copy
import unittest

from graphify_safe_merge import merge_graph


def node(id, source, origin="ast", **attrs):
    return {"id": id, "label": id, "source_file": source, "_origin": origin, **attrs}


def edge(source, target, owner, relation="calls", **attrs):
    return {"source": source, "target": target, "source_file": owner,
            "relation": relation, **attrs}


class SafeMergeTests(unittest.TestCase):
    def setUp(self):
        self.base = {
            "directed": False, "multigraph": False, "graph": {"custom": True},
            "semantic_updates": [{"evidence": "keep historical evidence"}],
            "nodes": [node("a", "a.ts"), node("b", "b.ts"),
                      node("migration", "plan.md", "semantic", label="a.ts")],
            "links": [edge("a", "b", "a.ts"), edge("b", "a", "b.ts"),
                      edge("a", "b", "plan.md", "references", source_location="L7"),
                      edge("migration", "a", "plan.md", "explains")],
            "hyperedges": [{"id": "flow", "source_file": "plan.md",
                            "nodes": ["a", "b", "migration"]}],
        }

    def test_noop_preserves_every_record_and_parallel_edge(self):
        original = copy.deepcopy(self.base)
        self.assertEqual(merge_graph(self.base, {}, set(), set()), self.base)
        self.assertEqual(self.base, original)

    def test_code_refresh_replaces_only_its_own_records(self):
        fresh = {"nodes": [node("a", "a.ts", label="New A")],
                 "edges": [edge("a", "b", "a.ts", "imports")]}
        result = merge_graph(self.base, fresh, {"a.ts"}, set())
        self.assertEqual(result["nodes"][1:], self.base["nodes"][1:])
        self.assertIn(fresh["edges"][0], result["links"])
        for e in self.base["links"][1:]:
            self.assertIn(e, result["links"])
        self.assertEqual(result["hyperedges"], self.base["hyperedges"])
        self.assertEqual(result["semantic_updates"], self.base["semantic_updates"])

    def test_semantic_refresh_keeps_ast_layer_and_removes_stale_concepts(self):
        self.base["nodes"].append(node("heading", "plan.md"))
        fresh = {"nodes": [node("new_plan", "plan.md", "semantic")],
                 "edges": [edge("new_plan", "a", "plan.md", "explains")]}
        result = merge_graph(self.base, fresh, set(), {"plan.md"})
        ids = {n["id"] for n in result["nodes"]}
        self.assertNotIn("migration", ids)
        self.assertIn("heading", ids)
        self.assertIn("new_plan", ids)
        self.assertEqual(result["hyperedges"], [])

    def test_removed_symbol_drops_incoming_edge_but_not_unrelated_nodes(self):
        fresh = {"nodes": [node("replacement", "a.ts")]}
        result = merge_graph(self.base, fresh, {"a.ts"}, set())
        self.assertEqual({n["id"] for n in result["nodes"]}, {"replacement", "b", "migration"})
        self.assertEqual(result["links"], [])
        self.assertEqual(result["hyperedges"], [])

    def test_empty_code_file_can_remove_all_its_symbols(self):
        result = merge_graph(self.base, {}, {"a.ts"}, set())
        self.assertNotIn("a", {n["id"] for n in result["nodes"]})

    def test_unextracted_semantic_source_cannot_be_marked_done(self):
        with self.assertRaisesRegex(ValueError, "semantic output"):
            merge_graph(self.base, {}, set(), {"plan.md"})

    def test_deletion_removes_both_layers_only_for_deleted_source(self):
        result = merge_graph(self.base, {}, set(), set(), deleted={"plan.md"})
        self.assertEqual([n["id"] for n in result["nodes"]], ["a", "b"])
        self.assertEqual(result["links"], self.base["links"][:2])

    def test_nested_hyperedges_follow_canonical_top_level_after_deletion(self):
        self.base["graph"]["hyperedges"] = copy.deepcopy(self.base["hyperedges"])
        result = merge_graph(self.base, {}, set(), set(), deleted={"plan.md"})
        self.assertEqual(result["graph"]["hyperedges"], [])
        self.assertTrue(result["graph"]["custom"])

    def test_legacy_nested_hyperedge_copy_is_reconciled_to_top_level(self):
        self.base["graph"]["hyperedges"] = [{"id": "old", "nodes": ["missing"]}]
        result = merge_graph(self.base, {}, set(), set())
        self.assertEqual(result["graph"]["hyperedges"], self.base["hyperedges"])

    def test_dangling_fresh_edge_and_foreign_source_collision_fail_closed(self):
        for fresh in [
            {"nodes": [node("a", "a.ts")], "edges": [edge("a", "unknown", "a.ts")]},
            {"nodes": [node("b", "a.ts")]},
        ]:
            with self.assertRaises(ValueError):
                merge_graph(self.base, fresh, {"a.ts"}, set())

    def test_foreign_records_cannot_be_injected_by_a_fragment(self):
        with self.assertRaises(ValueError):
            merge_graph(self.base, {"nodes": [node("foreign", "foreign.ts")]}, {"a.ts"}, set())

    def test_same_id_for_two_tiers_keeps_both_and_rewires_only_fresh_edges(self):
        self.base["nodes"].append(node("sql", "migration.sql", "semantic", rationale="Historical decision"))
        fresh = {"nodes": [node("sql", "migration.sql")],
                 "edges": [edge("sql", "a", "migration.sql")]}
        result = merge_graph(self.base, fresh, {"migration.sql"}, set())
        self.assertIn(self.base["nodes"][-1], result["nodes"])
        self.assertIn(node("sql_ast", "migration.sql", label="sql"), result["nodes"])
        self.assertIn(edge("sql_ast", "a", "migration.sql"), result["links"])

        fresh["nodes"].append(node("new_doc", "new.md", "semantic"))
        fresh["edges"].append(edge("new_doc", "sql", "new.md", "references"))
        result = merge_graph(self.base, fresh, {"migration.sql"}, {"new.md"})
        self.assertIn(edge("new_doc", "sql", "new.md", "references"), result["links"])


if __name__ == "__main__":
    unittest.main()
