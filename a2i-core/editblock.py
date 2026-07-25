"""Apply model-generated SEARCH/REPLACE edits to source files.

Models are asked to emit edits in aider's block format::

    path/to/file.py
    <<<<<<< SEARCH
    old code
    =======
    new code
    >>>>>>> REPLACE

They rarely reproduce the original text byte-for-byte: indentation drifts,
trailing whitespace changes, the middle gets elided with ``...``. Rejecting
those edits would make the feature useless, so :func:`apply_edit` tries a
**cascade** of progressively more forgiving strategies and reports which one
succeeded — the technique that makes aider's edits land in practice.

Adapted from aider's ``coders/editblock_coder.py``; reimplemented here with
no dependencies (``difflib`` is in the standard library) and as pure
functions over strings, so every stage is unit-testable.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

HEAD = "<<<<<<< SEARCH"
DIVIDER = "======="
UPDATED = ">>>>>>> REPLACE"

#: Minimum similarity for the fuzzy stage. Below this an edit is refused
#: rather than applied to the wrong place — a wrong edit is worse than none.
FUZZY_THRESHOLD = 0.82


@dataclass
class EditBlock:
    """One SEARCH/REPLACE edit targeting a file."""

    path: str
    search: str
    replace: str

    def __str__(self) -> str:
        return f"EditBlock({self.path}, -{len(self.search)}/+{len(self.replace)})"


@dataclass
class EditResult:
    """Outcome of applying one block."""

    block: EditBlock
    applied: bool
    strategy: str
    content: str | None = None
    hint: str = ""

    def __str__(self) -> str:
        state = f"applied via {self.strategy}" if self.applied else f"failed ({self.strategy})"
        return f"{self.block.path}: {state}"


_FENCE_RE = re.compile(r"^\s*```")


def find_edit_blocks(text: str) -> list[EditBlock]:
    """Parse every SEARCH/REPLACE block out of a model response.

    Malformed or truncated blocks are skipped rather than raising, since the
    text comes from a model.
    """
    blocks: list[EditBlock] = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        if lines[i].strip() != HEAD:
            i += 1
            continue

        path = _find_path(lines, i)
        search: list[str] = []
        i += 1
        while i < len(lines) and lines[i].strip() != DIVIDER:
            if lines[i].strip() == UPDATED:  # truncated block
                break
            search.append(lines[i])
            i += 1
        if i >= len(lines) or lines[i].strip() != DIVIDER:
            continue

        replace: list[str] = []
        i += 1
        while i < len(lines) and lines[i].strip() != UPDATED:
            if lines[i].strip() == HEAD:  # truncated block
                break
            replace.append(lines[i])
            i += 1
        if i >= len(lines) or lines[i].strip() != UPDATED:
            continue

        if path:
            blocks.append(
                EditBlock(
                    path=path,
                    search="\n".join(search),
                    replace="\n".join(replace),
                )
            )
        i += 1
    return blocks


def _find_path(lines: list[str], head_index: int) -> str:
    """The filename precedes the block, possibly across a code fence."""
    for offset in range(1, 4):
        index = head_index - offset
        if index < 0:
            break
        candidate = lines[index].strip()
        if not candidate or _FENCE_RE.match(candidate):
            continue
        candidate = candidate.strip("`*: ")
        if candidate and " " not in candidate.strip():
            return candidate
    return ""


def _exact(content: str, search: str, replace: str) -> str | None:
    """Stage 1 — the text appears verbatim."""
    if search and search in content:
        return content.replace(search, replace, 1)
    return None


def _line_trimmed(content: str, search: str, replace: str) -> str | None:
    """Stage 2 — matches once trailing whitespace is ignored."""
    haystack = content.splitlines(keepends=True)
    needle = search.splitlines()
    if not needle:
        return None
    stripped_needle = [line.rstrip() for line in needle]
    for start in range(len(haystack) - len(needle) + 1):
        window = [line.rstrip("\n").rstrip() for line in haystack[start : start + len(needle)]]
        if window == stripped_needle:
            return "".join(haystack[:start]) + _ensure_newline(replace, haystack, start + len(needle)) + "".join(
                haystack[start + len(needle) :]
            )
    return None


def _reindented(content: str, search: str, replace: str) -> str | None:
    """Stage 3 — the model dropped or changed the leading indentation.

    Finds a window whose lines match after removing each side's common
    indent, then re-indents the replacement by the file's actual indent so
    the result stays syntactically valid.
    """
    haystack = content.splitlines(keepends=True)
    needle = [line for line in search.splitlines()]
    if not needle:
        return None
    needle_body = _dedent(needle)
    for start in range(len(haystack) - len(needle) + 1):
        window_raw = [line.rstrip("\n") for line in haystack[start : start + len(needle)]]
        if _dedent(window_raw) != needle_body:
            continue
        indent = _common_indent(window_raw)
        new_lines = [indent + line if line.strip() else line for line in _dedent(replace.splitlines())]
        return "".join(haystack[:start]) + _ensure_newline(
            "\n".join(new_lines), haystack, start + len(needle)
        ) + "".join(haystack[start + len(needle) :])
    return None


def _elided(content: str, search: str, replace: str) -> str | None:
    """Stage 4 — the model elided the middle with ``...``.

    Each ``...`` marker splits the edit into segments that are applied in
    order, so the untouched middle is preserved.
    """
    marker = re.compile(r"^\s*\.\.\.\s*$", re.MULTILINE)
    search_parts = marker.split(search)
    replace_parts = marker.split(replace)
    if len(search_parts) < 2 or len(search_parts) != len(replace_parts):
        return None
    result = content
    for old, new in zip(search_parts, replace_parts):
        if not old.strip():
            continue
        updated = _exact(result, old.strip("\n"), new.strip("\n"))
        if updated is None:
            updated = _line_trimmed(result, old.strip("\n"), new.strip("\n"))
        if updated is None:
            return None
        result = updated
    return result if result != content else None


def _fuzzy(content: str, search: str, replace: str) -> str | None:
    """Stage 5 — closest window above :data:`FUZZY_THRESHOLD`."""
    haystack = content.splitlines(keepends=True)
    needle = search.splitlines()
    if not needle or len(needle) > len(haystack):
        return None
    best_ratio, best_start = 0.0, -1
    for start in range(len(haystack) - len(needle) + 1):
        window = "".join(haystack[start : start + len(needle)])
        ratio = SequenceMatcher(None, window, search).ratio()
        if ratio > best_ratio:
            best_ratio, best_start = ratio, start
    if best_start < 0 or best_ratio < FUZZY_THRESHOLD:
        return None
    return "".join(haystack[:best_start]) + _ensure_newline(
        replace, haystack, best_start + len(needle)
    ) + "".join(haystack[best_start + len(needle) :])


def _dedent(lines: list[str]) -> list[str]:
    indent = _common_indent(lines)
    if not indent:
        return [line.rstrip() for line in lines]
    return [(line[len(indent) :] if line.startswith(indent) else line).rstrip() for line in lines]


def _common_indent(lines: list[str]) -> str:
    indents = [line[: len(line) - len(line.lstrip())] for line in lines if line.strip()]
    if not indents:
        return ""
    shortest = min(indents, key=len)
    for indent in indents:
        while not indent.startswith(shortest):
            shortest = shortest[:-1]
            if not shortest:
                return ""
    return shortest


def _ensure_newline(text: str, haystack: list[str], next_index: int) -> str:
    """Keep the file's line structure intact after a replacement."""
    if not text:
        return ""
    if text.endswith("\n"):
        return text
    # Add a newline unless the replaced region ran to the end of the file.
    return text + "\n" if next_index < len(haystack) else text


#: Ordered cascade: each strategy is tried until one succeeds.
_STRATEGIES = (
    ("exact", _exact),
    ("whitespace", _line_trimmed),
    ("reindent", _reindented),
    ("elided", _elided),
    ("fuzzy", _fuzzy),
)


def apply_edit(content: str, search: str, replace: str) -> tuple[str | None, str]:
    """Apply one edit, returning ``(new_content, strategy)``.

    ``new_content`` is ``None`` when every strategy failed; ``strategy`` then
    names the reason.
    """
    if not search:
        # Empty SEARCH means "create or overwrite this file".
        return replace, "create"
    for name, strategy in _STRATEGIES:
        result = strategy(content, search, replace)
        if result is not None:
            return result, name
    return None, "no-match"


def closest_lines(content: str, search: str, count: int = 3) -> str:
    """The nearest region in the file, to show when an edit cannot be applied."""
    haystack = content.splitlines()
    needle = search.splitlines()
    if not needle or not haystack:
        return ""
    best_ratio, best_start = 0.0, 0
    span = min(len(needle), len(haystack))
    for start in range(len(haystack) - span + 1):
        ratio = SequenceMatcher(
            None, "\n".join(haystack[start : start + span]), search
        ).ratio()
        if ratio > best_ratio:
            best_ratio, best_start = ratio, start
    lo = max(0, best_start - count)
    hi = min(len(haystack), best_start + span + count)
    return "\n".join(haystack[lo:hi])


def apply_blocks(files: dict[str, str], blocks: list[EditBlock]) -> list[EditResult]:
    """Apply blocks in order, threading each file's content through.

    Later blocks see earlier edits, and a failed block never corrupts the
    file — it is reported with the closest matching region as a hint.
    """
    working = dict(files)
    results: list[EditResult] = []
    for block in blocks:
        original = working.get(block.path, "")
        updated, strategy = apply_edit(original, block.search, block.replace)
        if updated is None:
            results.append(
                EditResult(
                    block=block,
                    applied=False,
                    strategy=strategy,
                    hint=closest_lines(original, block.search),
                )
            )
            continue
        working[block.path] = updated
        results.append(
            EditResult(block=block, applied=True, strategy=strategy, content=updated)
        )
    return results
