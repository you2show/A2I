"""Local API provider registry for A2I hybrid mode.

Keys are deliberately handled by A2I Core, not by the browser UI.  The browser
only talks to the local Core loopback server, and Core stores each key in the
user's operating-system configuration directory.  Local GGUF inference never
reads this module or sends a request to the network.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class ProviderSpec:
    id: str
    name: str
    kind: str
    default_model: str
    endpoint: str
    docs_url: str
    privacy_note: str
    free_note: str


CHAT_PROVIDERS: dict[str, ProviderSpec] = {
    "openrouter": ProviderSpec(
        id="openrouter",
        name="OpenRouter",
        kind="openai",
        default_model="openrouter/free",
        endpoint="https://openrouter.ai/api/v1/chat/completions",
        docs_url="https://openrouter.ai/openrouter/free",
        privacy_note="Your prompt is sent to the model/provider selected by OpenRouter.",
        free_note="openrouter/free selects an available free model; availability and limits can change.",
    ),
    "groq": ProviderSpec(
        id="groq",
        name="Groq",
        kind="openai",
        default_model="llama-3.3-70b-versatile",
        endpoint="https://api.groq.com/openai/v1/chat/completions",
        docs_url="https://console.groq.com/docs/models",
        privacy_note="Your prompt is sent to Groq Cloud for inference.",
        free_note="Free accounts are rate-limited; see the Groq console for your current limits.",
    ),
    "huggingface": ProviderSpec(
        id="huggingface",
        name="Hugging Face Inference Providers",
        kind="openai",
        default_model="openai/gpt-oss-120b:fastest",
        endpoint="https://router.huggingface.co/v1/chat/completions",
        docs_url="https://huggingface.co/docs/inference-providers/en/index",
        privacy_note="Your prompt is routed by Hugging Face to an inference provider.",
        free_note="Free accounts receive small monthly credits; select a model/provider before use.",
    ),
    "gemini": ProviderSpec(
        id="gemini",
        name="Google Gemini API",
        kind="gemini",
        default_model="gemini-2.5-flash",
        endpoint="https://generativelanguage.googleapis.com/v1beta/models",
        docs_url="https://ai.google.dev/gemini-api/docs/pricing",
        privacy_note="Your prompt is sent to Google Gemini. Review the selected tier's data-use terms before sending private material.",
        free_note="Some Gemini models have a free tier with project/model rate limits; availability can change.",
    ),
}

SEARCH_PROVIDERS: dict[str, ProviderSpec] = {
    "tavily": ProviderSpec(
        id="tavily",
        name="Tavily Search",
        kind="search",
        default_model="",
        endpoint="https://api.tavily.com/search",
        docs_url="https://docs.tavily.com/documentation/api-credits",
        privacy_note="Your search query is sent to Tavily. Result snippets are returned to A2I Core.",
        free_note="The free plan provides monthly credits; usage depends on search depth.",
    ),
    "brave": ProviderSpec(
        id="brave",
        name="Brave Search",
        kind="search",
        default_model="",
        endpoint="https://api.search.brave.com/res/v1/web/search",
        docs_url="https://brave.com/search/api/",
        privacy_note="Your search query is sent to Brave Search.",
        free_note="The Search plan includes monthly credits; an account and card verification may be required.",
    ),
}

ALL_PROVIDERS = {**CHAT_PROVIDERS, **SEARCH_PROVIDERS}


def _config_path() -> Path:
    """Return a user-private config location that survives ZIP updates."""
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA") or (Path.home() / "AppData" / "Roaming"))
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME") or (Path.home() / ".config"))
    return base / "A2I" / "api_providers.json"


def _empty_config() -> dict[str, object]:
    return {"version": 1, "providers": {}}


def _load() -> dict[str, object]:
    path = _config_path()
    if not path.exists():
        return _empty_config()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("providers"), dict):
            return data
    except (OSError, ValueError):
        pass
    return _empty_config()


def _save(data: dict[str, object]) -> None:
    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temporary, path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        # Windows ACLs are managed by the user account; chmod is best-effort.
        pass


def _public(spec: ProviderSpec, configured: bool, model: str = "") -> dict[str, object]:
    return {
        "id": spec.id,
        "name": spec.name,
        "kind": spec.kind,
        "default_model": spec.default_model,
        "model": model or spec.default_model,
        "configured": configured,
        "docs_url": spec.docs_url,
        "privacy_note": spec.privacy_note,
        "free_note": spec.free_note,
    }


def catalog() -> dict[str, object]:
    """Return safe provider metadata; API keys are never included."""
    providers = _load().get("providers", {})
    if not isinstance(providers, dict):
        providers = {}
    return {
        "object": "a2i.api_provider_catalog",
        "storage": "A2I Core local user configuration",
        "chat_providers": [
            _public(spec, spec.id in providers, str(providers.get(spec.id, {}).get("model", "")))
            for spec in CHAT_PROVIDERS.values()
        ],
        "search_providers": [
            _public(spec, spec.id in providers, "") for spec in SEARCH_PROVIDERS.values()
        ],
    }


def configure(provider_id: str, api_key: str, model: str = "") -> dict[str, object]:
    """Save a key locally after the caller presents a consent prompt."""
    spec = ALL_PROVIDERS.get(provider_id)
    if spec is None:
        raise ValueError("unknown API provider")
    key = api_key.strip()
    if len(key) < 8:
        raise ValueError("API key is missing or too short")
    data = _load()
    providers = data.setdefault("providers", {})
    assert isinstance(providers, dict)
    providers[provider_id] = {"api_key": key, "model": model.strip() or spec.default_model}
    _save(data)
    return {"message": f"{spec.name} key saved locally in A2I Core.", **_public(spec, True, model)}


def clear(provider_id: str) -> dict[str, object]:
    spec = ALL_PROVIDERS.get(provider_id)
    if spec is None:
        raise ValueError("unknown API provider")
    data = _load()
    providers = data.setdefault("providers", {})
    assert isinstance(providers, dict)
    providers.pop(provider_id, None)
    _save(data)
    return {"message": f"{spec.name} key removed from local A2I Core configuration."}


def _configured(provider_id: str) -> tuple[ProviderSpec, str, str]:
    spec = ALL_PROVIDERS.get(provider_id)
    if spec is None:
        raise ValueError("unknown API provider")
    entry = _load().get("providers", {}).get(provider_id, {})
    if not isinstance(entry, dict) or not str(entry.get("api_key", "")).strip():
        raise ValueError(f"{spec.name} is not configured. Save its API key locally first.")
    return spec, str(entry["api_key"]), str(entry.get("model") or spec.default_model)


def _open_request(url: str, payload: dict[str, object], headers: dict[str, str]):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        return urllib.request.urlopen(request, timeout=90)
    except urllib.error.HTTPError as error:
        detail = error.read(600).decode("utf-8", errors="replace")
        raise ValueError(f"API returned HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise ValueError(f"Could not reach API provider: {error.reason}") from error


def validate_chat_provider(provider_id: str) -> dict[str, str]:
    """Validate local configuration without exposing the provider API key."""
    spec, _, model = _configured(provider_id)
    if spec.kind not in {"openai", "gemini"}:
        raise ValueError("this provider is not a chat API")
    return {"id": spec.id, "name": spec.name, "model": model}


def _text(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(_text(part.get("text", "")) if isinstance(part, dict) else _text(part) for part in value)
    return str(value or "")


def _gemini_payload(messages: list[dict[str, object]], max_tokens: int, temperature: float) -> dict[str, object]:
    system_parts: list[dict[str, str]] = []
    contents: list[dict[str, object]] = []
    for message in messages:
        role = str(message.get("role") or "user")
        text = _text(message.get("content"))
        if not text:
            continue
        if role == "system":
            system_parts.append({"text": text})
        else:
            contents.append({"role": "model" if role == "assistant" else "user", "parts": [{"text": text}]})
    payload: dict[str, object] = {
        "contents": contents or [{"role": "user", "parts": [{"text": "Hello"}]}],
        "generationConfig": {"maxOutputTokens": max(1, min(int(max_tokens), 4096)), "temperature": max(0.0, min(float(temperature), 2.0))},
    }
    if system_parts:
        payload["systemInstruction"] = {"parts": system_parts}
    return payload


def _stream_gemini(spec: ProviderSpec, key: str, model: str, messages: list[dict[str, object]], max_tokens: int, temperature: float) -> Iterable[str]:
    endpoint = spec.endpoint.rstrip("/") + "/" + urllib.parse.quote(model, safe="") + ":streamGenerateContent?alt=sse&key=" + urllib.parse.quote(key, safe="")
    with _open_request(endpoint, _gemini_payload(messages, max_tokens, temperature), {}) as response:
        for raw in response:
            line = raw.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            try:
                candidate = json.loads(line[5:].strip()).get("candidates", [{}])[0]
                parts = candidate.get("content", {}).get("parts", [])
                text = "".join(str(part.get("text", "")) for part in parts if isinstance(part, dict))
            except (IndexError, TypeError, ValueError):
                text = ""
            if text:
                yield "data: " + json.dumps({"choices": [{"delta": {"content": text}}]}) + "\n\n"


def stream_chat(provider_id: str, messages: list[dict[str, object]], max_tokens: int, temperature: float) -> Iterable[str]:
    """Proxy a selected provider and emit OpenAI-style SSE to the local browser UI."""
    spec, key, stored_model = _configured(provider_id)
    if spec.kind == "gemini":
        yield from _stream_gemini(spec, key, stored_model, messages, max_tokens, temperature)
        return
    if spec.kind != "openai":
        raise ValueError("this provider is not a chat API")
    payload: dict[str, object] = {
        "model": stored_model,
        "messages": messages,
        "stream": True,
        "max_tokens": max(1, min(int(max_tokens), 4096)),
        "temperature": max(0.0, min(float(temperature), 2.0)),
    }
    with _open_request(spec.endpoint, payload, {"Authorization": f"Bearer {key}"}) as response:
        for raw in response:
            line = raw.decode("utf-8", errors="replace")
            if line.strip():
                yield line if line.endswith("\n\n") else line.rstrip("\n") + "\n\n"


def search(provider_id: str, query: str, max_results: int = 5) -> dict[str, object]:
    """Run one explicit web search using a configured search API."""
    spec, key, _ = _configured(provider_id)
    if spec.kind != "search":
        raise ValueError("this provider is not a search API")
    query = query.strip()
    if not query:
        raise ValueError("search query is required")
    limit = max(1, min(int(max_results), 10))
    try:
        if provider_id == "tavily":
            response = _open_request(spec.endpoint, {"api_key": key, "query": query, "max_results": limit}, {})
            with response:
                payload = json.loads(response.read(2_000_000).decode("utf-8"))
            results = [
                {"title": item.get("title", ""), "url": item.get("url", ""), "snippet": item.get("content", "")}
                for item in payload.get("results", [])[:limit]
            ]
        else:  # Brave uses a GET endpoint and an X-Subscription-Token header.
            url = spec.endpoint + "?" + urllib.parse.urlencode({"q": query, "count": limit})
            request = urllib.request.Request(url, headers={"X-Subscription-Token": key}, method="GET")
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read(2_000_000).decode("utf-8"))
            results = [
                {"title": item.get("title", ""), "url": item.get("url", ""), "snippet": item.get("description", "")}
                for item in payload.get("web", {}).get("results", [])[:limit]
            ]
    except urllib.error.HTTPError as error:
        raise ValueError(f"Search API returned HTTP {error.code}") from error
    except urllib.error.URLError as error:
        raise ValueError(f"Could not reach search API: {error.reason}") from error
    return {"object": "a2i.web_search", "provider": spec.name, "query": query, "results": results}
