from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from local_catalog import CATALOG, catalog_payload, get_asset, inspect_gguf


class LocalCatalogTests(unittest.TestCase):
    def test_catalog_is_local_only_and_contains_hardware_recommendation(self) -> None:
        ids = {asset.id for asset in CATALOG}
        self.assertEqual(ids, {"qwen-1.5b", "qwen-3b", "qwen-7b", "qwen-coder-7b", "sea-lion-7b"})
        self.assertIn("huggingface.co", get_asset("qwen-3b").download_url)
        self.assertEqual(get_asset("qwen-3b").recommended_ram_gb, 10)
        self.assertEqual(get_asset("sea-lion-7b").languages[0], "Khmer")

    def test_invalid_file_is_never_reported_as_a_gguf(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "untrusted.bin"
            path.write_bytes(b"not a model")
            result = inspect_gguf(path)
            self.assertTrue(result["exists"])
            self.assertFalse(result["valid_gguf"])
            self.assertIsNone(result["sha256"])

    def test_gguf_magic_and_minimum_size_are_required(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.gguf"
            path.write_bytes(b"GGUF" + b"\0" * 10_000_000)
            result = inspect_gguf(path)
            self.assertTrue(result["valid_gguf"])
            self.assertEqual(len(result["sha256"]), 64)

    def test_catalog_payload_contains_no_provider_secret_fields(self) -> None:
        payload = catalog_payload()
        text = str(payload).lower()
        self.assertEqual(payload["mode"], "local-only")
        self.assertNotIn("api_key", text)
        self.assertNotIn("provider", text)


if __name__ == "__main__":
    unittest.main()
