from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tool_policy import decide, enabled_tools, require_allowed


class ToolPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.path = Path(self.tempdir.name) / "tools.json"

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def write_policy(self, coding_enabled: bool) -> None:
        self.path.write_text(
            json.dumps({"tools": {"coding_agent": {"enabled": coding_enabled}}}),
            encoding="utf-8",
        )

    def test_default_policy_allows_only_low_risk_read_tools(self) -> None:
        self.assertIn("web_fetch", enabled_tools(self.path))
        self.assertNotIn("coding_agent", enabled_tools(self.path))

    def test_disabled_coding_agent_cannot_be_acknowledged_into_use(self) -> None:
        self.write_policy(False)
        decision = decide(
            {"tool": "coding_agent", "scope": "Review this repository", "a2i_approval": True},
            self.path,
        )
        self.assertEqual(decision.status, "disabled")

    def test_enabled_coding_agent_still_requires_explicit_confirmation(self) -> None:
        self.write_policy(True)
        decision = decide({"tool": "coding_agent", "scope": "Review this repository"}, self.path)
        self.assertEqual(decision.status, "needs_confirmation")

    def test_enabled_and_acknowledged_coding_agent_is_allowed(self) -> None:
        self.write_policy(True)
        decision = require_allowed(
            {"scope": "Review only the current project", "a2i_approval": True},
            "coding_agent",
            self.path,
        )
        self.assertEqual(decision.status, "allowed")

    def test_scope_is_required(self) -> None:
        decision = decide({"tool": "web_fetch"}, self.path)
        self.assertEqual(decision.status, "denied")


if __name__ == "__main__":
    unittest.main()
