import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import graphify_update as updater


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        cwd = Path.cwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, cwd)
        out = self.root / "graphify-out"
        out.mkdir()
        (out / "graph.json").write_text(json.dumps({"nodes": [], "links": []}))
        (out / "manifest.json").write_text("{}")
        (out / "GRAPH_REPORT.md").write_text("Original report")
        self.before = {p: p.read_bytes() for p in out.iterdir()}

    def test_fresh_parallel_relations_and_provenance_survive_publication(self):
        for name in ("a.ts", "b.ts"):
            (self.root / name).write_text("export const value = 1;\n")
        ast = {
            "nodes": [{"id": id, "label": id, "source_file": id + ".ts", "file_type": "code", "_origin": "ast"} for id in ("a", "b")],
            "edges": [{"source": "a", "target": "b", "relation": relation, "source_file": "a.ts", "source_location": location, "_origin": "ast"}
                      for relation, location in [("calls", "L2"), ("references", "L3"), ("calls", "L4")]],
            "failed_sources": [],
            "extracted_sources": [str(self.root / name) for name in ("a.ts", "b.ts")],
        }
        with patch.object(updater, "extract", return_value=ast):
            updater.update(self.root)
        graph = json.loads((self.root / "graphify-out/graph.json").read_text())
        self.assertEqual({(e["relation"], e["source_location"]) for e in graph["links"]},
                         {("calls", "L2"), ("references", "L3"), ("calls", "L4")})

    def test_source_changed_during_manifest_staging_cannot_be_certified(self):
        source = self.root / "a.ts"
        source.write_text("export const original = 1;\n")
        save = updater.save_manifest

        def edit_then_save(*args, **kwargs):
            source.write_text("export const changed = 2;\n")
            return save(*args, **kwargs)

        with patch.object(updater, "save_manifest", side_effect=edit_then_save):
            with self.assertRaisesRegex(ValueError, "changed|hash|stale"):
                updater.update(self.root)
        for p, contents in self.before.items():
            self.assertEqual(p.read_bytes(), contents)

    def test_explicit_repair_scope_reextracts_unchanged_code_and_rejects_foreign_files(self):
        (self.root / "a.ts").write_text("export const value = 1;\n")
        updater.update(self.root)
        scope = self.root / "scope.json"
        scope.write_text('["a.ts"]')
        with patch.object(updater, "extract", wraps=updater.extract) as extract:
            updater.update(self.root, ast_sources_path=scope)
            self.assertIn(self.root / "a.ts", extract.call_args.args[0])
        scope.write_text('["../outside.ts"]')
        with self.assertRaises(ValueError):
            updater.update(self.root, ast_sources_path=scope)


if __name__ == "__main__":
    unittest.main()
