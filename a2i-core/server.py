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
import time
import uuid
from pathlib import Path
from typing import Iterator, TypedDict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from llama_cpp import Llama

from fim import RepoFile, build_repo_fim_prompt
from knowledge import KnowledgeBase
from repomap import extract_refs, rank_files

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
app = FastAPI(title="A2I Core", version="1.0.0")

# Allow browser front ends (e.g. the a2i-web page hosted on Vercel) to call
# this server directly from the user's browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
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
    return {"status": "ok", "model": Path(state.llm.model_path).name}


@app.get("/v1/models")
def list_models() -> dict[str, object]:
    name = Path(state.llm.model_path).stem
    return {
        "object": "list",
        "data": [{"id": name, "object": "model", "owned_by": "a2i"}],
    }


@app.post("/v1/chat/completions", response_model=None)
def chat_completions(body: dict) -> JSONResponse | StreamingResponse:
    messages: list[ChatMessage] = body.get("messages", [])
    max_tokens: int = body.get("max_tokens") or 512
    temperature: float = body.get("temperature", 0.7)
    stream: bool = body.get("stream", False)
    model_name = Path(state.llm.model_path).stem
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
        "--knowledge-dir",
        type=Path,
        default=None,
        help="directory of .txt/.md documents to answer from (local RAG)",
    )
    args = parser.parse_args()

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

    print(f"A2I Core ready: http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
