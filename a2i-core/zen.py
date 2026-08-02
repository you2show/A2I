"""OpenCode Zen bridge - use Zen free models through A2I Core.

A2I Core is OpenAI-compatible at ``/v1/chat/completions``. When the
requested model id is a Zen model (``big-pickle``, ``deepseek-v4-flash-free``,
``mimo-v2.5-free``, ...) and a Zen API key is available, the request is
proxied to ``https://opencode.ai/zen/v1`` instead of running locally - so
A2I Core answers with frontier free models on top of its local brain.

The key is discovered automatically from OpenCode's own ``auth.json``
(written by ``opencode auth login``), so A2I Core needs no extra
configuration when OpenCode is already signed in. It can also be set
explicitly with the ``A2I_ZEN_KEY`` environment variable.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ZEN_BASE = "https://opencode.ai/zen/v1"
CACHE_SECONDS = 300


def _auth_dict() -> dict[str, Any]:
    """OpenCode's auth.json contents (or the OPENCODE_AUTH_CONTENT env var)."""
    content = os.environ.get("OPENCODE_AUTH_CONTENT", "")
    if content:
        try:
            return json.loads(content)
        except ValueError:
            return {}
    roots = (
        os.environ.get("LOCALAPPDATA"),
        os.environ.get("XDG_DATA_HOME"),
        str(Path.home() / ".local" / "share"),
    )
    for root in roots:
        if not root:
            continue
        path = Path(root) / "opencode" / "auth.json"
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
    return {}


def zen_key() -> str:
    """The Zen API key, or ``""`` when none is configured."""
    for env in ("A2I_ZEN_KEY", "A2I_API_KEY"):
        value = os.environ.get(env, "").strip()
        if value:
            return value
    info = _auth_dict().get("opencode") or {}
    if isinstance(info, dict):
        if info.get("type") == "api" and info.get("key"):
            return str(info["key"])
        if isinstance(info.get("apiKey"), str) and info["apiKey"]:
            return info["apiKey"]
    return ""


_models_cache: list = [0.0, []]


def zen_models() -> list[str]:
    """Model ids advertised by Zen, cached for a few minutes."""
    now = time.time()
    if now - _models_cache[0] < CACHE_SECONDS:
        return _models_cache[1]
    ids: list[str] = []
    key = zen_key()
    try:
        req = urllib.request.Request(
            ZEN_BASE + "/models",
            headers={"User-Agent": "a2i-core", "Accept": "application/json"},
        )
        if key:
            req.add_header("Authorization", "Bearer " + key)
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode("utf-8"))
        rows = data.get("data") if isinstance(data, dict) else data
        for row in rows if isinstance(rows, list) else []:
            mid = row.get("id") if isinstance(row, dict) else row
            if isinstance(mid, str) and mid:
                ids.append(mid)
    except (urllib.error.URLError, OSError, ValueError):
        pass
    _models_cache[:] = [now, ids]
    return ids


def is_zen_model(model: str) -> bool:
    """Whether the requested model id should route through Zen."""
    if not model:
        return False
    if model.startswith("zen/"):
        return True
    if model.endswith("-free"):
        return True
    return model in zen_models()


def _upstream_model(model: str) -> str:
    return model[len("zen/"):] if model.startswith("zen/") else model


def chat(model: str, body: dict[str, Any]) -> tuple[int, str, str]:
    """Proxy one chat completion to Zen.

    Returns ``(status, content_type, text)``: JSON for non-streaming
    requests and the raw SSE body for streaming ones.
    """
    key = zen_key()
    if not key:
        return 503, "application/json", json.dumps(
            {"error": "zen_not_configured",
             "message": "No Zen key found. Run `opencode auth login` or set A2I_ZEN_KEY."}
        )
    payload = {
        "model": _upstream_model(model),
        "messages": body.get("messages", []),
        "temperature": body.get("temperature", 0.7),
        "max_tokens": body.get("max_tokens", 1024),
        "stream": body.get("stream", False),
    }
    req = urllib.request.Request(
        ZEN_BASE + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "User-Agent": "a2i-core",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            raw = res.read()
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:300]
        return err.code, "application/json", json.dumps({"error": detail})
    except urllib.error.URLError as err:
        return 502, "application/json", json.dumps({"error": str(err.reason)})
    if body.get("stream"):
        return 200, "text/event-stream", raw.decode("utf-8", "replace")
    try:
        parsed = json.loads(raw.decode("utf-8"))
        parsed["model"] = _upstream_model(model)
    except ValueError:
        parsed = {"error": "bad upstream response"}
    return 200, "application/json", json.dumps(parsed)
