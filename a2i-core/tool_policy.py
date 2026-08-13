"""Explicit tool policy for A2I Core.

A language model may propose actions, but it must never receive unrestricted
access just because a prompt asks for it. This module provides a small,
file-backed policy layer that makes high-impact capabilities disabled by
default. Enabling a capability requires both:

1. a local ``tools.json`` entry owned by the machine user; and
2. an explicit per-request acknowledgement from the A2I client.

The policy layer does not execute tools. It produces an auditable decision that
callers must enforce before invoking an agent or external worker.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

CONFIG_ENV = "A2I_TOOLS_FILE"
DEFAULT_CONFIG = Path(__file__).with_name("tools.json")


@dataclass(frozen=True)
class ToolCapability:
    id: str
    title: str
    risk: str
    requires_confirmation: bool
    default_enabled: bool
    description: str


CAPABILITIES: dict[str, ToolCapability] = {
    "web_fetch": ToolCapability(
        "web_fetch", "Read public web pages", "low", False, True,
        "Fetches public pages through A2I's SSRF-protected reader; fetched text remains untrusted.",
    ),
    "knowledge_search": ToolCapability(
        "knowledge_search", "Search local knowledge", "low", False, True,
        "Searches the local knowledge index without modifying files.",
    ),
    "coding_agent": ToolCapability(
        "coding_agent", "Coding agent with command access", "high", True, False,
        "May read and edit project files, run commands, and browse during an isolated coding task.",
    ),
    "file_write": ToolCapability(
        "file_write", "Write files", "high", True, False,
        "May create, change, rename, or delete files within an approved workspace.",
    ),
    "shell": ToolCapability(
        "shell", "Run shell commands", "high", True, False,
        "May execute allow-listed commands in an approved workspace.",
    ),
    "messaging": ToolCapability(
        "messaging", "Send messages", "high", True, False,
        "May send an outbound message only after recipient and content are confirmed.",
    ),
    "data_ingest": ToolCapability(
        "data_ingest", "Import external files", "medium", True, False,
        "May download or ingest files into quarantine before manual approval for knowledge indexing.",
    ),
    "scheduled_task": ToolCapability(
        "scheduled_task", "Create scheduled task", "high", True, False,
        "May create a repeating task only after schedule, scope, and external effects are confirmed.",
    ),
}


@dataclass(frozen=True)
class ToolDecision:
    tool: ToolCapability
    status: str
    message: str
    scope: str

    def public(self) -> dict[str, Any]:
        payload = asdict(self.tool)
        payload.update({"status": self.status, "message": self.message, "scope": self.scope})
        return payload


def config_path() -> Path:
    raw = os.environ.get(CONFIG_ENV, "").strip()
    return Path(raw).expanduser() if raw else DEFAULT_CONFIG


def enabled_tools(path: Path | None = None) -> set[str]:
    """Load local enablement; an absent file safely enables only low-risk reads."""
    enabled = {ident for ident, cap in CAPABILITIES.items() if cap.default_enabled}
    chosen = path or config_path()
    if not chosen.exists():
        return enabled
    try:
        raw = json.loads(chosen.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        raise ValueError(f"cannot read tool policy {chosen}: {err}") from err
    rows = raw.get("tools") if isinstance(raw, dict) else None
    if not isinstance(rows, dict):
        raise ValueError("tools.json must contain a tools object")
    for ident, setting in rows.items():
        if ident not in CAPABILITIES:
            raise ValueError(f"unknown tool in tools.json: {ident}")
        if not isinstance(setting, dict) or not isinstance(setting.get("enabled"), bool):
            raise ValueError(f"tool {ident} must use an object with boolean enabled")
        if setting["enabled"]:
            enabled.add(ident)
        else:
            enabled.discard(ident)
    return enabled


def capabilities(path: Path | None = None) -> list[dict[str, Any]]:
    enabled = enabled_tools(path)
    rows = []
    for capability in CAPABILITIES.values():
        row = asdict(capability)
        row["enabled"] = capability.id in enabled
        rows.append(row)
    return rows


def _scope(body: dict[str, Any]) -> str:
    scope = str(body.get("scope") or body.get("purpose") or "").strip()
    if len(scope) > 500:
        raise ValueError("tool scope is too long")
    return scope


def decide(body: dict[str, Any], path: Path | None = None) -> ToolDecision:
    """Return a non-executing authorization decision for one requested tool."""
    ident = str(body.get("tool") or "").strip()
    capability = CAPABILITIES.get(ident)
    if capability is None:
        raise ValueError("unknown tool")
    scope = _scope(body)
    if not scope:
        return ToolDecision(capability, "denied", "A concise task scope is required.", scope)
    if ident not in enabled_tools(path):
        return ToolDecision(
            capability,
            "disabled",
            "This tool is disabled locally. Enable it in tools.json before use.",
            scope,
        )
    if capability.requires_confirmation and body.get("a2i_approval") is not True:
        return ToolDecision(
            capability,
            "needs_confirmation",
            "Explicit user confirmation is required for this action.",
            scope,
        )
    return ToolDecision(capability, "allowed", "Allowed for this one acknowledged task scope.", scope)


def require_allowed(body: dict[str, Any], tool: str, path: Path | None = None) -> ToolDecision:
    """Enforce a decision for an actual caller such as the OpenCode bridge."""
    payload = dict(body)
    payload["tool"] = tool
    decision = decide(payload, path)
    if decision.status != "allowed":
        raise PermissionError(decision.message)
    return decision
