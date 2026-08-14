from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import api_providers


class ApiProviderStorageTests(unittest.TestCase):
    def test_catalog_never_returns_saved_key_and_clear_removes_it(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "api_providers.json"
            with patch("api_providers._config_path", return_value=config_path):
                initial = api_providers.catalog()
                openrouter = next(item for item in initial["chat_providers"] if item["id"] == "openrouter")
                self.assertFalse(openrouter["configured"])

                api_providers.configure("openrouter", "sk-local-test-key", "openrouter/free")
                configured = api_providers.catalog()
                serialised = json.dumps(configured)
                self.assertNotIn("sk-local-test-key", serialised)
                saved = next(item for item in configured["chat_providers"] if item["id"] == "openrouter")
                self.assertTrue(saved["configured"])
                self.assertEqual(saved["model"], "openrouter/free")

                on_disk = json.loads(config_path.read_text(encoding="utf-8"))
                self.assertEqual(on_disk["providers"]["openrouter"]["api_key"], "sk-local-test-key")

                api_providers.clear("openrouter")
                after_clear = api_providers.catalog()
                cleared = next(item for item in after_clear["chat_providers"] if item["id"] == "openrouter")
                self.assertFalse(cleared["configured"])

    def test_gemini_payload_separates_system_instruction(self) -> None:
        payload = api_providers._gemini_payload(
            [
                {"role": "system", "content": "Be concise."},
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi"},
            ],
            max_tokens=1200,
            temperature=0.4,
        )
        self.assertEqual(payload["systemInstruction"]["parts"][0]["text"], "Be concise.")
        self.assertEqual(payload["contents"][0]["role"], "user")
        self.assertEqual(payload["contents"][1]["role"], "model")
        self.assertEqual(payload["generationConfig"]["maxOutputTokens"], 1200)

    def test_unknown_provider_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            api_providers.configure("not-a-provider", "test-key-value")


if __name__ == "__main__":
    unittest.main()
