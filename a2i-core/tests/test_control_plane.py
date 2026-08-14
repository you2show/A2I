from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
import server


class LocalOnlyApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.tools = Path(self.tempdir.name) / "tools.json"
        self.old_tools = os.environ.get("A2I_TOOLS_FILE")
        os.environ["A2I_TOOLS_FILE"] = str(self.tools)
        self.client = TestClient(server.app)

    def tearDown(self) -> None:
        if self.old_tools is None:
            os.environ.pop("A2I_TOOLS_FILE", None)
        else:
            os.environ["A2I_TOOLS_FILE"] = self.old_tools
        self.tempdir.cleanup()

    def test_health_advertises_local_default_with_explicit_api_mode(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["mode"], "local-default")
        self.assertEqual(response.json()["api_mode"], "optional_explicit_consent")

    def test_model_list_is_owned_by_local_runtime(self) -> None:
        response = self.client.get("/v1/models")
        self.assertEqual(response.status_code, 200)
        models = response.json()["data"]
        self.assertEqual(len(models), 1)
        self.assertEqual(models[0]["owned_by"], "a2i-local")

    def test_legacy_remote_provider_routes_are_absent(self) -> None:
        self.assertEqual(self.client.get("/v1/providers").status_code, 404)
        self.assertEqual(
            self.client.post("/v1/router/plan", json={"intent": "research"}).status_code,
            404,
        )

    def test_api_provider_catalog_is_metadata_only_and_configuration_needs_consent(self) -> None:
        catalog = self.client.get("/v1/api-providers")
        self.assertEqual(catalog.status_code, 200)
        self.assertIn("openrouter", {item["id"] for item in catalog.json()["chat_providers"]})
        self.assertNotIn("api_key", str(catalog.json()).lower())
        blocked = self.client.post(
            "/v1/api-providers/configure",
            json={"provider_id": "openrouter", "api_key": "sk-test-key"},
        )
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(blocked.json()["error"], "confirmation_required")
        unconfigured_chat = self.client.post(
            "/v1/api/chat/completions",
            json={"provider_id": "openrouter", "messages": [{"role": "user", "content": "hello"}]},
        )
        self.assertEqual(unconfigured_chat.status_code, 400)
        self.assertEqual(unconfigured_chat.json()["error"], "api_provider_unavailable")

    def test_local_model_catalog_exposes_only_local_assets(self) -> None:
        response = self.client.get("/v1/local-models")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["mode"], "local-only")
        self.assertIn("qwen-3b", {asset["id"] for asset in payload["assets"]})
        self.assertNotIn("provider", str(payload).lower())

    def test_knowledge_status_is_empty_without_an_index(self) -> None:
        response = self.client.get("/v1/knowledge")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["loaded"])
        self.assertEqual(payload["document_count"], 0)
        self.assertEqual(payload["documents"], [])

    def test_community_asset_registry_is_metadata_only(self) -> None:
        response = self.client.get("/v1/community-assets")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["mode"], "local-only")
        self.assertEqual(payload["download_policy"], "metadata_only_until_user_owned_hardware_and_license_review")
        self.assertIn("muse-glimmer-30b", {asset["id"] for asset in payload["assets"]})
        self.assertNotIn("download_url", str(payload))
        self.assertNotIn("api_key", str(payload).lower())

    def test_tool_plan_marks_coding_agent_disabled_by_default(self) -> None:
        response = self.client.post(
            "/v1/tools/plan", json={"tool": "coding_agent", "scope": "Review this repository"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["decision"]["status"], "disabled")

    def test_agent_edit_is_blocked_before_local_model_loads(self) -> None:
        response = self.client.post(
            "/v1/agent/edit",
            json={
                "task": "Change this file",
                "files": {"demo.py": "print('old')\n"},
                "a2i_approval": True,
                "scope": "Generate a reviewable proposal for this file.",
            },
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "tool_not_authorized")


if __name__ == "__main__":
    unittest.main()
