from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import local_catalog
import model_manager
import server


class ModelManagerTests(unittest.TestCase):
    def _make_gguf(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as handle:
            handle.write(b"GGUF")
            handle.seek(10_000_000 - 1)
            handle.write(b"\0")

    def test_select_installed_asset_materializes_without_second_download(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            library = root / "models" / "library"
            active = root / "models" / "model.gguf"
            selection = root / "models" / "selected-model.json"
            self._make_gguf(library / "qwen-3b.gguf")
            with (
                patch.object(local_catalog, "LIBRARY_DIR", library),
                patch.object(model_manager, "ACTIVE_MODEL", active),
                patch.object(model_manager, "MODELS_DIR", root / "models"),
                patch.object(model_manager, "SELECTION_FILE", selection),
            ):
                result = model_manager.select_installed_asset("qwen-3b")
                self.assertTrue(result["selected"])
                applied = model_manager.apply_selected_model()
                self.assertTrue(applied["applied"])
                self.assertTrue(active.samefile(library / "qwen-3b.gguf"))
                self.assertEqual(model_manager.selected_asset_id(), "qwen-3b")

    def test_selection_refuses_a_model_that_is_not_installed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            library = root / "models" / "library"
            with (
                patch.object(local_catalog, "LIBRARY_DIR", library),
                patch.object(model_manager, "ACTIVE_MODEL", root / "models" / "model.gguf"),
                patch.object(model_manager, "SELECTION_FILE", root / "models" / "selected-model.json"),
            ):
                with self.assertRaises(ValueError):
                    model_manager.select_installed_asset("qwen-3b")

    def test_mutating_api_routes_require_explicit_confirmation(self) -> None:
        client = TestClient(server.app)
        download = client.post("/v1/local-models/download", json={"asset_id": "qwen-3b"})
        select = client.post("/v1/local-models/select", json={"asset_id": "qwen-3b"})
        self.assertEqual(download.status_code, 400)
        self.assertEqual(download.json()["error"], "confirmation_required")
        self.assertEqual(select.status_code, 400)
        self.assertEqual(select.json()["error"], "confirmation_required")


if __name__ == "__main__":
    unittest.main()
