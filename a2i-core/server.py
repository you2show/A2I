"""A2I Core — self-hosted AI server.

Runs a local open-weight language model with llama.cpp and exposes:

- ``POST /v1/chat/completions`` — OpenAI-compatible chat API, so Dify,
  Flowise, Vane, and the AI SDK can all use A2I Core as their model
  backend without any external API.
- ``GET /`` — a built-in browser chat UI.
- Optional retrieval over local documents (see ``knowledge.py``) so
  answers can be grounded in your own files.

Everything runs on your machine. No request ever leaves it.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import uuid
import webbrowser
from threading import Timer
from pathlib import Path
from typing import Callable, Iterator, TypedDict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

try:
    from llama_cpp import Llama
except ModuleNotFoundError:  # Keep routing/policy APIs testable before native install.
    Llama = None  # type: ignore[assignment,misc]

from agent import ask, run_agent
from api_providers import catalog as api_provider_catalog, clear as clear_api_provider, configure as configure_api_provider
from api_providers import search as api_search, stream_chat as stream_api_chat, validate_chat_provider

from browse import browse
from community_assets import research_assets_payload

from fim import RepoFile, build_repo_fim_prompt

from knowledge import KnowledgeBase
from local_catalog import catalog_payload
from model_manager import apply_selected_model, download_status, select_installed_asset, selection_payload, start_download
from profiles import model_profiles, recommend_profile
from repomap import build_repo_map, extract_refs, rank_files
from tool_policy import capabilities as tool_capabilities, decide as decide_tool, require_allowed

DEFAULT_MODEL_PATH = Path(__file__).parent / "models" / "model.gguf"
DEFAULT_SYSTEM_PROMPT = (
    "You are A2I, a helpful personal AI assistant that runs fully offline "
    "on the user's own machine. Answer clearly and accurately. If context "
    "documents are provided, ground your answer in them."
)


class ChatMessage(TypedDict):
    role: str
    content: str


class AppState:
    """Holds the loaded model and optional knowledge base."""

    llm: Llama
    knowledge: KnowledgeBase | None = None

    def __repr__(self) -> str:
        kb = self.knowledge.size if self.knowledge else 0
        return f"AppState(model={self.llm.model_path!r}, knowledge_chunks={kb})"


state = AppState()
app = FastAPI(title="A2I Core", version="1.1.0")

def _allowed_origins() -> list[str]:
    """Return explicit browser origins allowed to call a local Core server.

    A public wildcard is unsafe for a machine-local assistant that can expose
    private knowledge and later invoke user-approved tools. Set
    ``A2I_ALLOWED_ORIGINS`` to a comma-separated list when hosting A2I Web on a
    trusted domain; use exact origins rather than a wildcard.
    """
    configured = os.environ.get("A2I_ALLOWED_ORIGINS", "").strip()
    if configured:
        return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8990",
        "http://127.0.0.1:8990",
    ]


# Allow only explicit, trusted browser front ends to reach the local server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


def build_messages(messages: list[ChatMessage]) -> list[ChatMessage]:
    """Inject the default system prompt and retrieved context if needed."""
    result = list(messages)
    if not result or result[0]["role"] != "system":
        result.insert(0, {"role": "system", "content": DEFAULT_SYSTEM_PROMPT})

    if state.knowledge is not None and state.knowledge.size > 0:
        last_user = next((m for m in reversed(result) if m["role"] == "user"), None)
        if last_user is not None:
            chunks = state.knowledge.search(last_user["content"], top_k=3)
            if chunks:
                context = "\n\n".join(f"[{c.source}]\n{c.text}" for c in chunks)
                result[0] = {
                    "role": "system",
                    "content": (
                        result[0]["content"]
                        + "\n\nContext documents:\n"
                        + context
                    ),
                }
    return result


@app.get("/health")
def health() -> dict[str, str]:
    model = Path(state.llm.model_path).name if hasattr(state, "llm") else "not-loaded"
    return {
        "status": "ok",
        "mode": "local-default",
        "api_mode": "optional_explicit_consent",
        "model": model,
    }


@app.get("/v1/local-models")
def list_local_models() -> dict[str, object]:
    """List curated local GGUF assets, SSD state and active download progress."""
    jobs = download_status().get("jobs", [])
    downloads = {job["asset_id"]: job for job in jobs if isinstance(job, dict) and job.get("asset_id")}
    return {**catalog_payload(), **selection_payload(), "downloads": downloads}


@app.get("/v1/local-models/download/{asset_id}")
def local_model_download_status(asset_id: str) -> dict[str, object]:
    """Return local download progress; no remote inference is involved."""
    return {"object": "a2i.local_model_download", **download_status(asset_id)}


@app.post("/v1/local-models/download", response_model=None)
def download_local_model(body: dict) -> dict[str, object] | JSONResponse:
    """Begin one confirmed, allow-listed GGUF download to the local SSD.

    The browser must explicitly send ``confirm: true`` after showing the asset's
    source and licence. URLs, filenames and destination paths are never taken
    from the browser request.
    """
    asset_id = str(body.get("asset_id") or "")
    if body.get("confirm") is not True:
        return JSONResponse(
            {"error": "confirmation_required", "message": "Review the source and licence, then confirm this one-time local download."},
            status_code=400,
        )
    try:
        result = start_download(asset_id, activate=bool(body.get("activate", True)))
    except (KeyError, ValueError) as error:
        return JSONResponse({"error": "invalid_local_model", "message": str(error)}, status_code=400)
    return {"object": "a2i.local_model_download", **result}


@app.post("/v1/local-models/select", response_model=None)
def select_local_model(body: dict) -> dict[str, object] | JSONResponse:
    """Select an installed verified asset for the next A2I Core restart."""
    asset_id = str(body.get("asset_id") or "")
    if body.get("confirm") is not True:
        return JSONResponse(
            {"error": "confirmation_required", "message": "Confirm model selection before changing the next Core startup model."},
            status_code=400,
        )
    try:
        return {"object": "a2i.local_model_selection", **select_installed_asset(asset_id)}
    except (KeyError, ValueError) as error:
        return JSONResponse({"error": "invalid_local_model", "message": str(error)}, status_code=400)


@app.get("/v1/api-providers")
def list_api_providers() -> dict[str, object]:
    """Safe local API-provider catalog; secrets are never returned to the browser."""
    return api_provider_catalog()


@app.post("/v1/api-providers/configure", response_model=None)
def configure_api_provider_endpoint(body: dict) -> dict[str, object] | JSONResponse:
    """Save one user-approved API key inside local A2I Core configuration."""
    if body.get("confirm") is not True:
        return JSONResponse(
            {"error": "confirmation_required", "message": "Confirm that this provider will receive future prompts before saving its API key."},
            status_code=400,
        )
    try:
        return configure_api_provider(
            str(body.get("provider_id") or ""),
            str(body.get("api_key") or ""),
            str(body.get("model") or ""),
        )
    except ValueError as error:
        return JSONResponse({"error": "api_provider_configuration", "message": str(error)}, status_code=400)


@app.post("/v1/api-providers/clear", response_model=None)
def clear_api_provider_endpoint(body: dict) -> dict[str, object] | JSONResponse:
    try:
        return clear_api_provider(str(body.get("provider_id") or ""))
    except ValueError as error:
        return JSONResponse({"error": "api_provider_configuration", "message": str(error)}, status_code=400)


@app.post("/v1/api/chat/completions", response_model=None)
def api_chat_completions(body: dict) -> StreamingResponse | JSONResponse:
    """Stream a user-selected hosted model through local A2I Core.

    The browser only supplies a provider id and messages; the corresponding key
    remains in the local Core configuration and is never sent back in a response.
    """
    provider_id = str(body.get("provider_id") or "")
    try:
        profile = validate_chat_provider(provider_id)
    except ValueError as error:
        return JSONResponse({"error": "api_provider_unavailable", "message": str(error)}, status_code=400)
    messages = body.get("messages") or []
    if not isinstance(messages, list):
        return JSONResponse({"error": "invalid_messages", "message": "messages must be a list"}, status_code=400)
    try:
        max_tokens = int(body.get("max_tokens") or 1024)
        temperature = float(body.get("temperature") or 0.7)
    except (TypeError, ValueError):
        return JSONResponse({"error": "invalid_generation_parameters"}, status_code=400)
    response = StreamingResponse(
        stream_api_chat(provider_id, messages, max_tokens=max_tokens, temperature=temperature),
        media_type="text/event-stream",
    )
    response.headers["X-A2I-Provider"] = profile["id"]
    response.headers["X-A2I-Model"] = profile["model"]
    return response


@app.post("/v1/api/search", response_model=None)
def api_web_search(body: dict) -> dict[str, object] | JSONResponse:
    """Run one explicitly confirmed external web search through local Core."""
    if body.get("confirm") is not True:
        return JSONResponse(
            {"error": "confirmation_required", "message": "Confirm that this query may be sent to the selected web-search provider."},
            status_code=400,
        )
    try:
        return api_search(
            str(body.get("provider_id") or ""),
            str(body.get("query") or ""),
            int(body.get("max_results") or 5),
        )
    except (TypeError, ValueError) as error:
        return JSONResponse({"error": "web_search_unavailable", "message": str(error)}, status_code=400)


@app.get("/v1/knowledge")
def knowledge_status() -> dict[str, object]:
    """Show local RAG index metadata without returning private document text."""
    if state.knowledge is None:
        return {"object": "a2i.knowledge_status", "loaded": False, "chunk_count": 0, "document_count": 0, "documents": []}
    return {"object": "a2i.knowledge_status", **state.knowledge.status()}


@app.get("/v1/community-assets")
def community_assets() -> dict[str, object]:
    """List reviewed frontier assets without downloading or serving them."""
    return research_assets_payload()


@app.get("/v1/model-profiles")
def list_model_profiles(ram_gb: float | None = None) -> dict[str, object]:
    """Expose local model tiers for the A2I settings UI.

    ``ram_gb`` is optional because browser hardware detection is not reliable.
    When supplied, every local tier reports whether it is merely possible or
    genuinely recommended for that amount of system memory.
    """

    recommendation = recommend_profile(ram_gb)
    return {
        "object": "a2i.model_profile_list",
        "ram_gb": ram_gb,
        "recommended_profile": recommendation.id,
        "profiles": model_profiles(ram_gb),
    }


@app.get("/v1/tools", response_model=None)
def list_tools() -> dict[str, object] | JSONResponse:
    """List tool capabilities and their local enablement state."""
    try:
        tools = tool_capabilities()
    except ValueError as err:
        return JSONResponse({"error": "invalid_tool_policy", "message": str(err)}, status_code=503)
    return {"object": "a2i.tool_list", "tools": tools}


@app.post("/v1/tools/plan", response_model=None)
def tool_plan(body: dict) -> dict[str, object] | JSONResponse:
    """Return an authorization decision; this endpoint never executes a tool."""
    try:
        decision = decide_tool(body)
    except ValueError as err:
        return JSONResponse({"error": "tool_policy_error", "message": str(err)}, status_code=400)
    return {"object": "a2i.tool_decision", "decision": decision.public()}


@app.get("/v1/models")
def list_models() -> dict[str, object]:
    name = Path(state.llm.model_path).stem if hasattr(state, "llm") else "not-loaded"
    return {"object": "list", "data": [{"id": name, "object": "model", "owned_by": "a2i-local"}]}


@app.post("/v1/chat/completions", response_model=None)

def chat_completions(body: dict) -> JSONResponse | StreamingResponse:
    messages: list[ChatMessage] = body.get("messages", [])
    max_tokens: int = body.get("max_tokens") or 512
    temperature: float = body.get("temperature", 0.7)
    stream: bool = body.get("stream", False)
    # Agent/provider routes below may be rejected before a local GGUF model is
    # loaded. Keeping this fallback also makes control-plane APIs testable.
    model_name = Path(state.llm.model_path).stem if hasattr(state, "llm") else "local"

    full_messages = build_messages(messages)

    if not stream:
        result = state.llm.create_chat_completion(
            messages=full_messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        result["model"] = model_name
        return JSONResponse(result)

    def event_stream() -> Iterator[str]:
        completion_id = f"chatcmpl-{uuid.uuid4().hex}"
        for chunk in state.llm.create_chat_completion(
            messages=full_messages,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
        ):
            chunk["id"] = completion_id
            chunk["model"] = model_name
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _rank_repo_files(
    files: list[RepoFile] | None, prefix: str, suffix: str
) -> list[RepoFile] | None:
    """Order supporting files most-relevant-first for repo-level FIM.

    ``build_repo_fim_prompt`` drops whatever exceeds its budget, so the order
    decides what the model actually sees. Relevance is computed with the repo
    map, using identifiers around the cursor as the focus signal.
    """
    if not files or len(files) < 2:
        return files
    try:
        contents = {f["name"]: f.get("content", "") for f in files if f.get("name")}
        mentioned = extract_refs(prefix + "\n" + suffix)
        order = rank_files(contents, mentioned_idents=mentioned)
        position = {name: i for i, name in enumerate(order)}
        return sorted(files, key=lambda f: position.get(f.get("name", ""), len(order)))
    except Exception:
        return files  # ranking is an optimisation, never a hard dependency


@app.post("/v1/completions", response_model=None)
def completions(body: dict) -> JSONResponse | StreamingResponse:
    """Raw (non-chat) completion — what code-completion tools speak.

    Coding assistants such as Tabby (``kind = "openai/completion"``) and
    editor plugins send a prompt plus an optional ``suffix`` for
    fill-in-the-middle, rather than a chat transcript. Serving this endpoint
    lets them use A2I Core as their backend with no external API.
    """
    prompt: str = body.get("prompt") or ""
    if isinstance(prompt, list):  # some clients send a list of prompts
        prompt = prompt[0] if prompt else ""
    suffix: str | None = body.get("suffix")
    max_tokens: int = body.get("max_tokens") or 256
    temperature: float = body.get("temperature", 0.2)
    stop: list[str] | None = body.get("stop")
    stream: bool = body.get("stream", False)
    model_name = Path(state.llm.model_path).stem

    # Optional repo-level context (A2I extension, ignored by plain clients):
    # ``files`` supplies cross-file context and ``repo_name`` the repo header,
    # following the Qwen coder repo-level FIM format. When present we build
    # the FIM prompt ourselves, so ``suffix`` must not also be passed to
    # llama.cpp — it is already embedded in the prompt.
    files: list[RepoFile] | None = body.get("files")
    repo_name: str | None = body.get("repo_name")

    kwargs: dict[str, object] = {
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if files or repo_name:
        kwargs["prompt"] = build_repo_fim_prompt(
            prefix=prompt,
            suffix=suffix or "",
            files=_rank_repo_files(files, prompt, suffix or ""),
            repo_name=repo_name,
        )
    else:
        kwargs["prompt"] = prompt
        if suffix:
            kwargs["suffix"] = suffix
    if stop:
        kwargs["stop"] = stop

    if not stream:
        result = state.llm.create_completion(**kwargs)
        result["model"] = model_name
        return JSONResponse(result)

    def event_stream() -> Iterator[str]:
        completion_id = f"cmpl-{uuid.uuid4().hex}"
        for chunk in state.llm.create_completion(stream=True, **kwargs):
            chunk["id"] = completion_id
            chunk["model"] = model_name
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _local_llm(temperature: float = 0.2, max_tokens: int = 2048) -> "Callable[[list], str]":
    """Use the loaded model directly, with no HTTP round trip."""

    def call(messages: list[ChatMessage]) -> str:
        result = state.llm.create_chat_completion(
            messages=messages, max_tokens=max_tokens, temperature=temperature
        )
        return result["choices"][0]["message"]["content"]

    return call


@app.post("/v1/agent/ask")
def agent_ask(body: dict) -> JSONResponse:
    """Answer a question about a codebase, without changing anything.

    The caller supplies the files, so this works for a browser client that
    has no filesystem access of its own.
    """
    question: str = body.get("question") or body.get("query") or ""
    files: dict[str, str] = body.get("files") or {}
    if not question:
        return JSONResponse({"error": "question is required"}, status_code=400)
    answer = ask(question, files, _local_llm(), read_urls=bool(body.get("read_urls")))
    return JSONResponse({"answer": answer})


@app.post("/v1/agent/plan")
def agent_plan(body: dict) -> JSONResponse:
    """Produce a local review plan without generating or applying edits."""
    task: str = body.get("task") or ""
    files: dict[str, str] = body.get("files") or {}
    if not task or not files:
        return JSONResponse({"error": "task and files are required"}, status_code=400)
    plan = ask(
        "Create a review-first implementation plan for this task. Do not edit files. " + task,
        files,
        _local_llm(temperature=0.3, max_tokens=1536),
        read_urls=False,
    )
    return JSONResponse({"plan": plan})


@app.post("/v1/agent/edit")
def agent_edit(body: dict) -> JSONResponse:
    """Generate reviewable edits only after an explicit local approval.

    The returned contents are never written to disk by Core. The caller must
    download and review them before applying any change outside A2I.
    """
    task: str = body.get("task") or ""
    files: dict[str, str] = body.get("files") or {}
    if not task or not files:
        return JSONResponse({"error": "task and files are required"}, status_code=400)
    try:
        require_allowed(body, "coding_agent")
    except (PermissionError, ValueError) as err:
        return JSONResponse({"error": "tool_not_authorized", "message": str(err)}, status_code=403)
    result = run_agent(
        task=task,
        files=files,
        llm=_local_llm(),
        max_rounds=int(body.get("rounds") or 3),
        architect=_local_llm(temperature=0.4) if body.get("architect") else None,
        read_urls=bool(body.get("read_urls")),
    )
    return JSONResponse(
        {
            "files": {p: t for p, t in result.files.items() if files.get(p) != t},
            "applied": result.applied,
            "failed": result.failed,
            "rounds": result.rounds,
            "plan": result.plan,
            "log": result.log,
        }
    )


@app.post("/v1/repomap")
def repo_map(body: dict) -> JSONResponse:
    """Rank a repository's definitions — useful context for any client."""
    files: dict[str, str] = body.get("files") or {}
    if not files:
        return JSONResponse({"error": "files are required"}, status_code=400)
    return JSONResponse(
        {
            "map": build_repo_map(
                files,
                focus_files=body.get("focus_files") or (),
                mentioned_idents=extract_refs(body.get("query") or ""),
                max_chars=int(body.get("max_chars") or 4000),
            )
        }
    )


@app.post("/v1/browse")
def browse_url(body: dict) -> JSONResponse:
    """Fetch web pages as text, so browser clients can bypass CORS.

    Private and loopback addresses stay refused (see ``browse.fetch``).
    """
    urls = body.get("urls") or ([body["url"]] if body.get("url") else [])
    if not urls:
        return JSONResponse({"error": "url or urls is required"}, status_code=400)
    try:
        require_allowed({"scope": "Read public web pages for this request", **body}, "web_fetch")
    except (PermissionError, ValueError) as err:
        return JSONResponse({"error": "tool_not_authorized", "message": str(err)}, status_code=403)
    pages = browse(urls, limit=int(body.get("limit") or 3))
    return JSONResponse(
        {"pages": [{"url": p.url, "title": p.title, "text": p.text} for p in pages]}
    )


@app.get("/", response_class=HTMLResponse)
def chat_ui() -> str:
    return (Path(__file__).parent / "static" / "chat.html").read_text()


@app.get("/live", response_class=HTMLResponse)
def live_ui() -> HTMLResponse:
    """Serve the 3D voice UI same-origin so it talks to this server directly."""
    live_html = Path(__file__).parent.parent / "a2i-web" / "live.html"
    if not live_html.exists():
        return HTMLResponse(
            "<h1>A2I Live</h1><p>live.html not found — it ships in a2i-web/.</p>",
            status_code=404,
        )
    return HTMLResponse(live_html.read_text())


def main() -> None:
    parser = argparse.ArgumentParser(description="A2I Core — self-hosted AI server")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8990)
    parser.add_argument("--ctx", type=int, default=4096, help="context window size")
    parser.add_argument(
        "--open-browser",
        action="store_true",
        help="open the local browser UI after Core starts (used by the Windows launcher)",
    )
    parser.add_argument(
        "--knowledge-dir",
        type=Path,
        default=None,
        help="directory of .txt/.md documents to answer from (local RAG)",
    )
    args = parser.parse_args()

    if Llama is None:
        raise SystemExit(
            "llama-cpp-python is not installed. Run: python -m pip install -r requirements.txt"
        )
    # When the user selected an installed catalog asset in the web library,
    # materialize it as models/model.gguf before llama.cpp opens the file. This
    # is a hard link where possible, so a multi-GB model is not downloaded or
    # duplicated. A custom --model path always remains under the user's control.
    if args.model == DEFAULT_MODEL_PATH:
        selection = apply_selected_model()
        if selection.get("applied"):
            print(f"Selected local model applied: {selection.get('asset_id')}")
        elif selection.get("reason") not in {None, "no selection"}:
            print(f"Warning: selected local model was not applied: {selection.get('reason')}")
    if not args.model.exists():
        raise SystemExit(
            f"Model not found: {args.model}\n"
            "Download one first: ./download-model.sh"
        )

    print(f"Loading model {args.model} ...")
    state.llm = Llama(
        model_path=str(args.model),
        n_ctx=args.ctx,
        n_threads=None,  # autodetect
        verbose=False,
    )
    if args.knowledge_dir is not None:
        state.knowledge = KnowledgeBase.from_directory(args.knowledge_dir)
        print(f"Knowledge base loaded: {state.knowledge.size} chunks")

    import uvicorn

    local_url = f"http://{args.host}:{args.port}"
    print(f"A2I Core ready: {local_url}")
    if args.open_browser:
        # Delay the browser handoff slightly so uvicorn has bound its local port.
        Timer(1.0, lambda: webbrowser.open(local_url)).start()
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()

