"""A2I coding agent — turn a task description into applied file edits.

Ties the other modules together:

* :mod:`repomap` builds a ranked map so the model sees the *relevant* parts
  of a repository rather than a truncated dump;
* the model is asked for edits in aider's ``SEARCH/REPLACE`` format;
* :mod:`editblock` applies them through its fallback cascade;
* anything that still fails is fed back with the closest matching region and
  retried — the same graceful-degradation principle used elsewhere in A2I.

The model is reached over the OpenAI-compatible API, so this works against
A2I Core, vLLM, Ollama, or any other provider. Only the standard library is
used, and the LLM call is injectable so the loop is testable without a model.

Safety: edits are computed in memory and **not written to disk** unless
``write=True`` (the CLI requires an explicit ``--write``).
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Protocol

from editblock import EditResult, apply_blocks, find_edit_blocks
from repomap import build_repo_map, extract_refs, rank_files

SYSTEM_PROMPT = """You are A2I Coder, an expert software engineer.

You will be given a task and the contents of some files. Reply ONLY with
edits in this exact format, one block per change:

path/to/file.py
<<<<<<< SEARCH
the exact existing lines to replace
=======
the new lines
>>>>>>> REPLACE

Rules:
1. The SEARCH text must match the file EXACTLY, including indentation.
2. Keep each block small — only the lines that change, plus enough
   surrounding lines to be unique.
3. Use the file's real path as shown to you.
4. To create a new file, leave the SEARCH section empty.
5. Do not explain; emit only the blocks."""


class LLM(Protocol):
    """Anything that maps a list of chat messages to a reply."""

    def __call__(self, messages: list[dict[str, str]]) -> str: ...


@dataclass
class AgentResult:
    """Outcome of an agent run."""

    files: dict[str, str]
    results: list[EditResult] = field(default_factory=list)
    rounds: int = 0
    log: list[str] = field(default_factory=list)

    @property
    def applied(self) -> int:
        return sum(1 for r in self.results if r.applied)

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if not r.applied)

    @property
    def changed_files(self) -> list[str]:
        return sorted({r.block.path for r in self.results if r.applied})

    def __str__(self) -> str:
        return f"AgentResult(applied={self.applied}, failed={self.failed}, rounds={self.rounds})"


def openai_llm(
    base_url: str = "http://127.0.0.1:8990/v1",
    model: str | None = None,
    api_key: str | None = None,
    temperature: float = 0.2,
    timeout: int = 300,
) -> LLM:
    """An :class:`LLM` backed by any OpenAI-compatible endpoint."""

    def call(messages: list[dict[str, str]]) -> str:
        payload: dict[str, object] = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 2048,
            "stream": False,
        }
        if model:
            payload["model"] = model
        request = urllib.request.Request(
            base_url.rstrip("/") + "/chat/completions",
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {api_key}"} if api_key else {}),
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = json.loads(response.read())
        except urllib.error.HTTPError as exc:  # pragma: no cover - network
            raise RuntimeError(f"{exc.code} from {base_url}: {exc.read()[:200]!r}") from exc
        except urllib.error.URLError as exc:  # pragma: no cover - network
            raise RuntimeError(
                f"Could not reach {base_url} — is A2I Core running?"
            ) from exc
        return body["choices"][0]["message"]["content"]

    return call


def build_context(
    task: str, files: dict[str, str], max_file_chars: int = 12_000
) -> str:
    """Assemble the user message: a repo map plus the most relevant files.

    Files are ordered by repo-map relevance to the task, so when the budget
    runs out it is the least relevant file that is dropped.
    """
    parts: list[str] = []
    repo_map = build_repo_map(files, mentioned_idents=extract_refs(task), max_chars=2000)
    if repo_map:
        parts.append("Repository map (most relevant first):\n" + repo_map)

    used = 0
    for path in rank_files(files, mentioned_idents=extract_refs(task)):
        content = files[path]
        block = f"\n--- {path} ---\n{content}"
        if used + len(block) > max_file_chars:
            continue
        parts.append(block)
        used += len(block)

    parts.append(f"\nTask: {task}")
    return "\n".join(parts)


def run_agent(
    task: str,
    files: dict[str, str],
    llm: LLM,
    max_rounds: int = 3,
    on_progress: Callable[[str], None] | None = None,
) -> AgentResult:
    """Ask the model for edits and apply them, retrying what fails.

    Args:
        task: What to change, in natural language.
        files: Mapping of path to current contents.
        llm: The model callable.
        max_rounds: How many times to retry failed edits.
        on_progress: Optional callback for status lines.

    Returns:
        An :class:`AgentResult` holding the updated file contents.
    """
    report = on_progress or (lambda _message: None)
    working = dict(files)
    outcome = AgentResult(files=working)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_context(task, working)},
    ]

    for round_number in range(1, max_rounds + 1):
        outcome.rounds = round_number
        report(f"round {round_number}: asking the model…")
        try:
            reply = llm(messages)
        except Exception as exc:
            outcome.log.append(f"round {round_number}: model call failed: {exc}")
            report(f"model call failed: {exc}")
            break

        blocks = find_edit_blocks(reply)
        if not blocks:
            outcome.log.append(f"round {round_number}: no edit blocks in reply")
            report("no edit blocks found in the reply")
            break

        results = apply_blocks(working, blocks)
        for result in results:
            if result.applied and result.content is not None:
                working[result.block.path] = result.content
        outcome.results.extend(results)

        applied = [r for r in results if r.applied]
        failed = [r for r in results if not r.applied]
        report(f"round {round_number}: {len(applied)} applied, {len(failed)} failed")
        outcome.log.append(
            f"round {round_number}: applied {len(applied)}, failed {len(failed)}"
        )

        if not failed:
            break
        if round_number == max_rounds:
            break

        # Retry only what failed, showing the model the real surrounding text.
        detail = "\n\n".join(
            f"This edit to {r.block.path} did not match the file:\n"
            f"<<<<<<< SEARCH\n{r.block.search}\n=======\n{r.block.replace}\n>>>>>>> REPLACE\n"
            f"The closest text actually in the file is:\n{r.hint}"
            for r in failed
        )
        messages.append({"role": "assistant", "content": reply})
        messages.append(
            {
                "role": "user",
                "content": detail
                + "\n\nRe-issue ONLY the failed edits, matching the file exactly.",
            }
        )

    outcome.files = working
    return outcome


def write_files(files: dict[str, str], root: Path, only: list[str] | None = None) -> list[Path]:
    """Write changed files to disk, creating parent directories."""
    written: list[Path] = []
    for path, content in files.items():
        if only is not None and path not in only:
            continue
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        written.append(target)
    return written


def collect_files(
    root: Path, suffixes: tuple[str, ...] = (".py", ".js", ".ts", ".tsx", ".go", ".rs", ".java")
) -> dict[str, str]:
    """Read a source tree into a ``{relative_path: content}`` mapping."""
    files: dict[str, str] = {}
    skip = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in suffixes:
            continue
        if any(part in skip for part in path.parts):
            continue
        try:
            files[str(path.relative_to(root))] = path.read_text()
        except (OSError, UnicodeDecodeError):
            continue
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description="A2I coding agent")
    parser.add_argument("task", help="what to change, in natural language")
    parser.add_argument("--dir", type=Path, default=Path("."), help="project directory")
    parser.add_argument("--url", default="http://127.0.0.1:8990/v1", help="OpenAI-compatible base URL")
    parser.add_argument("--model", default=None, help="model id (optional)")
    parser.add_argument("--api-key", default=None, help="API key (optional)")
    parser.add_argument("--rounds", type=int, default=3, help="max retry rounds")
    parser.add_argument(
        "--write", action="store_true", help="write the changes (default: dry run)"
    )
    args = parser.parse_args()

    files = collect_files(args.dir)
    if not files:
        raise SystemExit(f"No source files found under {args.dir}")
    print(f"Loaded {len(files)} files from {args.dir}")

    result = run_agent(
        task=args.task,
        files=files,
        llm=openai_llm(args.url, args.model, args.api_key),
        max_rounds=args.rounds,
        on_progress=lambda message: print(f"  {message}"),
    )

    print(f"\n{result.applied} edit(s) applied, {result.failed} failed")
    for entry in result.results:
        print(f"  {entry}")

    if not result.changed_files:
        return
    if not args.write:
        print("\nDry run — nothing written. Re-run with --write to apply.")
        print("Changed files would be: " + ", ".join(result.changed_files))
        return

    written = write_files(result.files, args.dir, only=result.changed_files)
    print("\nWrote:")
    for path in written:
        print(f"  {path}")


if __name__ == "__main__":
    sys.exit(main())
