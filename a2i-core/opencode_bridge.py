"""OpenCode server bridge - drive a local ``opencode serve`` agent from A2I Core.

A2I Core is OpenAI-compatible at ``/v1/chat/completions``. When the requested
model id starts with ``oc/``, the request is proxied to the local OpenCode
HTTP server (``opencode serve``, default ``http://127.0.0.1:4096``) which runs
a full agent loop: it can read and edit files, run commands, and browse the
web - then returns its final answer.

Unlike ``zen.py`` (a pure model gateway) this bridge talks to OpenCode's own
session API, so A2I Core becomes a chat front end to the same coding agent you
would use in the terminal:

- ``POST /api/session`` - create a session
- ``POST /api/session/:id/message`` - admit the user prompt (agent loop runs)
- ``GET /api/session/:id/message`` - read the assistant reply

The server password (when ``opencode serve`` is started with
``--password`` / ``OPENCODE_SERVER_PASSWORD``) is reused automatically;
username defaults to ``opencode``. Override with ``A2I_OPENCODE_URL``,
``A2I_OPENCODE_USERNAME`` and ``A2I_OPENCODE_PASSWORD``.
"""

from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any

OC_DEFAULT_URL = "http://127.0.0.1:4096"
CACHE_SECONDS = 300
TIMEOUT = 600  # agent loops can take a while


def oc_url() -> str:
    """Base URL of the local OpenCode server."""
    return os.environ.get("A2I_OPENCODE_URL", OC_DEFAULT_URL).strip().rstrip("/")


def _auth_header() -> str | None:
    """Basic auth header when the server requires a password."""
    username = os.environ.get("A2I_OPENCODE_USERNAME") or os.environ.get(
        "OPENCODE_SERVER_USERNAME", "opencode"
    )
    password = os.environ.get("A2I_OPENCODE_PASSWORD") or os.environ.get(
        "OPENCODE_SERVER_PASSWORD", ""
    )
    if not password:
        return None
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    return "Basic " + token


def _request(path: str, method: str = "GET", body: dict[str, Any] | None = None) -> Any:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "User-Agent": "a2i-core",
        "Accept": "application/json",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    auth = _auth_header()
    if auth:
        headers["Authorization"] = auth
    req = urllib.request.Request(oc_url() + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        raw = res.read()
    return json.loads(raw.decode("utf-8"))


_models_cache: list = [0.0, []]


def oc_models() -> list[dict[str, str]]:
    """Models advertised by the OpenCode server, cached for a few minutes."""
    now = time.time()
    if now - _models_cache[0] < CACHE_SECONDS:
        return _models_cache[1]
    rows: list[dict[str, str]] = []
    try:
        data = _request("/api/model")
    except (urllib.error.URLError, OSError, ValueError):
        pass
    else:
        items = data if isinstance(data, list) else data.get("data") if isinstance(data, dict) else []
        for row in items if isinstance(items, list) else []:
            if isinstance(row, dict) and row.get("id"):
                rows.append(
                    {
                        "id": str(row["id"]),
                        "provider": str(row.get("providerID") or ""),
                        "name": str(row.get("name") or row["id"]),
                    }
                )
    _models_cache[:] = [now, rows]
    return rows


def is_oc_model(model: str) -> bool:
    """Whether the requested model id should route through OpenCode."""
    return bool(model) and model.startswith("oc/")


def _last_user_text(messages: list[dict[str, Any]]) -> str:
    """The most recent user message - what the agent loop should act on."""
    for msg in reversed(messages):
        if msg.get("role") == "user" and msg.get("content"):
            return str(msg["content"])
    return ""


def _assistant_text(data: Any) -> str:
    """Extract the assistant reply text from a session message object."""
    if isinstance(data, dict):
        if isinstance(data.get("parts"), list):
            texts = [
                p.get("text", "")
                for p in data["parts"]
                if isinstance(p, dict) and p.get("type") == "text" and p.get("text")
            ]
            if texts:
                return "\n".join(texts)
        if data.get("text"):
            return str(data["text"])
        if isinstance(data.get("info"), dict) and data["info"].get("text"):
            return str(data["info"]["text"])
    return ""


def chat(model: str, body: dict[str, Any]) -> tuple[int, str, str]:
    """Run one chat completion through the local OpenCode agent loop.

    Returns ``(status, content_type, text)``: JSON for non-streaming
    requests and an OpenAI-style SSE body for streaming ones.
    """
    messages: list[dict[str, Any]] = body.get("messages", [])
    prompt = _last_user_text(messages)
    if not prompt:
        return 400, "application/json", json.dumps(
            {"error": "no user message", "message": "OpenCode bridge needs a user message."}
        )
    try:
        session = _request("/api/session", method="POST", body={"title": "a2i-core"})
        session_id = session.get("id") if isinstance(session, dict) else None
        if not session_id:
            raise ValueError("no session id")
        payload: dict[str, Any] = {"parts": [{"type": "text", "text": prompt}]}
        if not body.get("stream"):
            reply = _request(f"/api/session/{session_id}/message", method="POST", body=payload)
            answer = _assistant_text(reply)
            return 200, "application/json", json.dumps(
                {
                    "id": f"chatcmpl-{session_id}",
                    "object": "chat.completion",
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "message": {"role": "assistant", "content": answer},
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                }
            )
        reply = _request(f"/api/session/{session_id}/message", method="POST", body=payload)
        answer = _assistant_text(reply)
        lines = [f"data: {json.dumps({'id': f'chatcmpl-{session_id}', 'object': 'chat.completion.chunk', 'model': model, 'choices': [{'index': 0, 'delta': {'role': 'assistant', 'content': answer}, 'finish_reason': None}]})}\n\n"]
        lines.append("data: [DONE]\n\n")
        return 200, "text/event-stream", "".join(lines)
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:300]
        return err.code, "application/json", json.dumps({"error": detail})
    except urllib.error.URLError as err:
        return 502, "application/json", json.dumps(
            {
                "error": "opencode_unreachable",
                "message": (
                    f"Cannot reach the OpenCode server at {oc_url()}. "
                    "Start it with: opencode serve (port 4096). "
                    f"Details: {err.reason}"
                ),
            }
        )
    except (OSError, ValueError) as err:
        return 502, "application/json", json.dumps({"error": str(err)})
