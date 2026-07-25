"""Fill-in-the-middle prompt construction for code completion.

Code models are trained with special tokens that mark the text before and
after the cursor, and optionally other files from the same repository. This
module builds those prompts. It is deliberately dependency-free so it can be
unit-tested without loading a model.

Reference: ``Qwen2.5-Coder`` / ``Qwen3-Coder`` examples —
``<|fim_prefix|>…<|fim_suffix|>…<|fim_middle|>`` for a single file, and the
repo-level form that prepends ``<|repo_name|>`` and one ``<|file_sep|>``
section per supporting file.
"""

from __future__ import annotations

from typing import TypedDict

FIM_PREFIX = "<|fim_prefix|>"
FIM_SUFFIX = "<|fim_suffix|>"
FIM_MIDDLE = "<|fim_middle|>"
REPO_NAME = "<|repo_name|>"
FILE_SEP = "<|file_sep|>"


class RepoFile(TypedDict):
    """A supporting file supplied as cross-file context."""

    name: str
    content: str


def build_fim_prompt(prefix: str, suffix: str) -> str:
    """Single-file fill-in-the-middle prompt."""
    return f"{FIM_PREFIX}{prefix}{FIM_SUFFIX}{suffix}{FIM_MIDDLE}"


def build_repo_fim_prompt(
    prefix: str,
    suffix: str,
    files: list[RepoFile] | None = None,
    repo_name: str | None = None,
    max_context_chars: int = 24_000,
) -> str:
    """Repo-level fill-in-the-middle prompt.

    Supporting files are emitted before the edited region so the model can
    use cross-file context (imports, signatures, types). Files are included
    whole, in the order given — callers should pass them most-relevant first,
    since anything that would exceed ``max_context_chars`` is dropped rather
    than truncated: half a source file is more likely to mislead the model
    than to help it.

    Args:
        prefix: Source text before the cursor.
        suffix: Source text after the cursor.
        files: Supporting files, most relevant first.
        repo_name: Repository name, emitted as the ``<|repo_name|>`` header.
        max_context_chars: Budget for supporting files only; the edited
            region is always included.

    Returns:
        The prompt string to send to the model.
    """
    if not files and not repo_name:
        return build_fim_prompt(prefix, suffix)

    parts: list[str] = []
    if repo_name:
        parts.append(f"{REPO_NAME}{repo_name}")

    used = 0
    for file in files or []:
        name = file.get("name") or ""
        content = file.get("content") or ""
        if not name or not content:
            continue
        section = f"{FILE_SEP}{name}\n{content}"
        if used + len(section) > max_context_chars:
            continue
        parts.append(section)
        used += len(section)

    parts.append(f"{FILE_SEP}{build_fim_prompt(prefix, suffix)}")
    return "\n".join(parts)
