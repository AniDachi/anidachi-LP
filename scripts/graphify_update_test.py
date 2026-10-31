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

    def test_dynamic_package_imports_publish_without_claiming_package_names_are_files(self):
        (self.root / "a.ts").write_text(
            'export async function load() { return import("@anidachi/protocol"); }\n'
        )
        (self.root / "b.ts").write_text(
            'export async function load() { await import("@anidachi/protocol"); return import("wxt"); }\n'
        )
        updater.update(self.root)
        out = self.root / "graphify-out"
        graph = json.loads((out / "graph.json").read_text())
        modules = {n.get("module_specifier"): n for n in graph["nodes"] if n.get("type") == "module"}
        self.assertEqual(set(modules), {"@anidachi/protocol", "wxt"})
        for specifier, node in modules.items():
            self.assertEqual(node["label"], specifier)
            self.assertEqual(node["source_file"], "")
        protocol_importers = {e["source_file"] for e in graph["links"]
                              if e["target"] == modules["@anidachi/protocol"]["id"]}
        self.assertEqual(protocol_importers, {"a.ts", "b.ts"})
        manifest = json.loads((out / "manifest.json").read_text())
        self.assertEqual(set(manifest), {"a.ts", "b.ts"})
        first = {p: p.read_bytes() for p in self.before}
        updater.update(self.root)
        for p, contents in first.items():
            self.assertEqual(p.read_bytes(), contents)
        (self.root / "c.ts").write_text('export const load = () => import("@anidachi/protocol");\n')
        updater.update(self.root)
        refreshed = json.loads((out / "graph.json").read_text())
        self.assertEqual(sum(n.get("module_specifier") == "@anidachi/protocol" for n in refreshed["nodes"]), 1)
        self.assertEqual({e["source_file"] for e in refreshed["links"]
                          if e["target"] == modules["@anidachi/protocol"]["id"]},
                         {"a.ts", "b.ts", "c.ts"})

    def test_incremental_packages_with_colliding_ids_cannot_reuse_another_module(self):
        (self.root / "a.ts").write_text('export const load = () => import("foo-bar");\n')
        updater.update(self.root)
        before = {p: p.read_bytes() for p in self.before}
        (self.root / "b.ts").write_text('export const load = () => import("foo_bar");\n')
        with self.assertRaisesRegex(ValueError, "Module identity collision"):
            updater.update(self.root)
        for p, contents in before.items():
            self.assertEqual(p.read_bytes(), contents)

    def test_imported_package_cannot_replace_deleted_file_and_rebind_its_old_edges(self):
        (self.root / "foo-bar.ts").write_text("export const value = 1;\n")
        (self.root / "a.ts").write_text('import { value } from "./foo-bar";\nexport const copy = value;\n')
        updater.update(self.root)
        before = {p: p.read_bytes() for p in self.before}
        (self.root / "foo-bar.ts").unlink()
        (self.root / "b.ts").write_text('export const load = () => import("foo-bar");\n')
        with self.assertRaisesRegex(ValueError, "Module identity collision"):
            updater.update(self.root)
        for p, contents in before.items():
            self.assertEqual(p.read_bytes(), contents)

    def test_import_module_marker_cannot_claim_an_unchanged_real_source(self):
        (self.root / "a.ts").write_text("export const a = 1;\n")
        (self.root / "b.ts").write_text("export const b = 1;\n")
        updater.update(self.root)
        before = {p: p.read_bytes() for p in self.before}
        (self.root / "a.ts").write_text("export const a = 2;\n")
        ast = {
            "nodes": [
                {"id": "a", "label": "a.ts", "source_file": "a.ts", "file_type": "code"},
                {"id": "foreign", "label": "b.ts", "source_file": "b.ts", "file_type": "code", "type": "module"},
            ],
            "edges": [{"source": "a", "target": "foreign", "relation": "dynamic_import", "source_file": "a.ts"}],
        }
        with patch.object(updater, "extract", return_value=ast):
            with self.assertRaisesRegex(ValueError, "Unresolved cross-source AST node"):
                updater.update(self.root)
        for p, contents in before.items():
            self.assertEqual(p.read_bytes(), contents)

    def test_unattributed_module_without_an_import_still_blocks_publication(self):
        (self.root / "a.ts").write_text("export const a = 1;\n")
        ast = {
            "nodes": [
                {"id": "a", "label": "a.ts", "source_file": "a.ts", "file_type": "code"},
                {"id": "foreign", "label": "other", "source_file": "other", "file_type": "code", "type": "module"},
            ],
            "edges": [{"source": "a", "target": "foreign", "relation": "calls", "source_file": "a.ts"}],
        }
        with patch.object(updater, "extract", return_value=ast):
            with self.assertRaisesRegex(ValueError, "Unresolved cross-source AST node"):
                updater.update(self.root)
        for p, contents in self.before.items():
            self.assertEqual(p.read_bytes(), contents)


if __name__ == "__main__":
    unittest.main()
