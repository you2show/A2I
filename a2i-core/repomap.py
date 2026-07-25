"""Rank the most relevant code in a repository, for use as model context.

A repository never fits in a context window, so instead of truncating files
we rank *symbols*: build a graph where an edge runs from a file that
references an identifier to the file that defines it, run PageRank over it,
and emit the highest-scoring definitions until a character budget is spent.

The approach is adapted from aider's repo map. Two deliberate differences:

* **No dependencies.** aider uses ``tree-sitter`` and ``networkx``; here
  symbol extraction is regex-based per language and PageRank is implemented
  directly (it is a short power iteration). This keeps A2I Core installable
  anywhere, at the cost of parse accuracy — the regexes catch declarations,
  not a full grammar, which is what the reference graph needs.
* **Pure functions over a file list**, so the ranking is unit-testable
  without a repository or a model.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

# Definition patterns per language. Kept intentionally small and readable:
# these catch the declarations that matter for cross-file reference, which is
# what the graph needs — not a full grammar.
_DEF_PATTERNS: dict[str, list[str]] = {
    ".py": [r"^\s*(?:async\s+)?def\s+(\w+)", r"^\s*class\s+(\w+)"],
    ".js": [r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)", r"^\s*(?:export\s+)?class\s+(\w+)",
            r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*="],
    ".ts": [r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)", r"^\s*(?:export\s+)?class\s+(\w+)",
            r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=",
            r"^\s*(?:export\s+)?(?:interface|type|enum)\s+(\w+)"],
    ".go": [r"^\s*func\s+(?:\([^)]*\)\s*)?(\w+)", r"^\s*type\s+(\w+)"],
    ".rs": [r"^\s*(?:pub\s+)?fn\s+(\w+)", r"^\s*(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)"],
    ".java": [r"^\s*(?:public|private|protected).*?\s(\w+)\s*\(", r"^\s*(?:public\s+)?class\s+(\w+)"],
}
_DEF_PATTERNS[".jsx"] = _DEF_PATTERNS[".js"]
_DEF_PATTERNS[".tsx"] = _DEF_PATTERNS[".ts"]

_IDENT_RE = re.compile(r"\b[A-Za-z_]\w{2,}\b")

# Words that look like identifiers but carry no cross-file meaning.
_STOPWORDS = frozenset("""
    the and for not you are with this that from have has was were will can
    def class function const let var return import export type interface enum
    public private protected static async await new delete typeof instanceof
    true false null none self super args kwargs str int bool list dict set
""".split())


@dataclass
class RankedDef:
    """A definition with its computed importance."""

    name: str
    path: str
    line: int
    score: float
    text: str = field(repr=False, default="")

    def __str__(self) -> str:
        return f"{self.path}:{self.line} {self.name} ({self.score:.4f})"


def extract_defs(path: str, text: str) -> list[tuple[str, int]]:
    """Definitions in a file as ``(name, line_number)`` pairs."""
    suffix = Path(path).suffix.lower()
    patterns = _DEF_PATTERNS.get(suffix)
    if not patterns:
        return []
    compiled = [re.compile(p) for p in patterns]
    defs: list[tuple[str, int]] = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        for pattern in compiled:
            match = pattern.match(line)
            if match:
                defs.append((match.group(1), lineno))
                break
    return defs


def extract_refs(text: str) -> list[str]:
    """Identifiers referenced in a file (duplicates kept — frequency matters)."""
    return [t for t in _IDENT_RE.findall(text) if t.lower() not in _STOPWORDS]


def identifier_multiplier(ident: str, definer_count: int, mentioned: set[str]) -> float:
    """Aider's weighting heuristics, which carry most of the quality.

    A distinctive name is a strong relevance signal; a name defined
    everywhere, or marked private, is weak.
    """
    multiplier = 1.0
    if ident in mentioned:
        multiplier *= 10.0
    is_snake = "_" in ident.strip("_") and any(c.isalpha() for c in ident)
    is_camel = any(c.isupper() for c in ident) and any(c.islower() for c in ident)
    if (is_snake or is_camel) and len(ident) >= 8:
        multiplier *= 10.0
    if ident.startswith("_"):
        multiplier *= 0.1
    if definer_count > 5:
        multiplier *= 0.1
    return multiplier


def pagerank(
    nodes: list[str],
    edges: dict[tuple[str, str], float],
    personalization: dict[str, float] | None = None,
    damping: float = 0.85,
    iterations: int = 40,
    tolerance: float = 1.0e-8,
) -> dict[str, float]:
    """Weighted PageRank by power iteration.

    Implemented here so the repo map needs no third-party graph library.
    Rank leaked by dangling nodes (no outgoing edges) is redistributed via
    the personalization vector, matching the standard formulation.
    """
    if not nodes:
        return {}

    if personalization and sum(personalization.values()) > 0:
        total = sum(personalization.values())
        base = {n: personalization.get(n, 0.0) / total for n in nodes}
    else:
        base = {n: 1.0 / len(nodes) for n in nodes}

    out_weight: dict[str, float] = defaultdict(float)
    outgoing: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for (src, dst), weight in edges.items():
        if weight <= 0:
            continue
        out_weight[src] += weight
        outgoing[src].append((dst, weight))

    rank = dict(base)
    for _ in range(iterations):
        nxt = {n: 0.0 for n in nodes}
        dangling = 0.0
        for node in nodes:
            share = rank[node]
            if out_weight[node] <= 0:
                dangling += share
                continue
            for dst, weight in outgoing[node]:
                nxt[dst] += share * (weight / out_weight[node])
        for node in nodes:
            nxt[node] = (1 - damping) * base[node] + damping * (
                nxt[node] + dangling * base[node]
            )
        delta = sum(abs(nxt[n] - rank[n]) for n in nodes)
        rank = nxt
        if delta < tolerance:
            break
    return rank


def rank_definitions(
    files: dict[str, str],
    focus_files: Iterable[str] = (),
    mentioned_idents: Iterable[str] = (),
) -> list[RankedDef]:
    """Rank every definition across ``files`` by importance.

    Args:
        files: Mapping of path to file contents.
        focus_files: Paths the user is working on — these and what they
            reference are boosted, mirroring aider's chat-file weighting.
        mentioned_idents: Identifiers the user just mentioned.

    Returns:
        Definitions ordered most important first.
    """
    focus = set(focus_files)
    mentioned = set(mentioned_idents)

    defs_by_ident: dict[str, list[tuple[str, int]]] = defaultdict(list)
    refs_by_file: dict[str, list[str]] = {}
    for path, text in files.items():
        for name, line in extract_defs(path, text):
            defs_by_ident[name].append((path, line))
        refs_by_file[path] = extract_refs(text)

    nodes = list(files.keys())
    edges: dict[tuple[str, str], float] = defaultdict(float)
    for path, refs in refs_by_file.items():
        counts: dict[str, int] = defaultdict(int)
        for ref in refs:
            counts[ref] += 1
        for ident, count in counts.items():
            definers = defs_by_ident.get(ident)
            if not definers:
                continue
            multiplier = identifier_multiplier(ident, len(definers), mentioned)
            if path in focus:
                multiplier *= 50.0
            weight = multiplier * (count ** 0.5)
            for definer_path, _line in definers:
                if definer_path == path:
                    continue  # self-reference carries no cross-file signal
                edges[(path, definer_path)] += weight

    personalization = {n: (100.0 if n in focus else 1.0) for n in nodes}
    file_rank = pagerank(nodes, dict(edges), personalization)

    ranked: list[RankedDef] = []
    for ident, definers in defs_by_ident.items():
        multiplier = identifier_multiplier(ident, len(definers), mentioned)
        for path, line in definers:
            ranked.append(
                RankedDef(
                    name=ident,
                    path=path,
                    line=line,
                    score=file_rank.get(path, 0.0) * multiplier,
                )
            )
    ranked.sort(key=lambda d: (-d.score, d.path, d.line))
    return ranked


def rank_files(
    files: dict[str, str],
    focus_files: Iterable[str] = (),
    mentioned_idents: Iterable[str] = (),
) -> list[str]:
    """Order file paths by how relevant they are, most relevant first.

    Used to decide which supporting files to hand a code model when the
    prompt budget cannot hold the whole repository.
    """
    best: dict[str, float] = {path: 0.0 for path in files}
    for definition in rank_definitions(files, focus_files, mentioned_idents):
        if definition.score > best.get(definition.path, 0.0):
            best[definition.path] = definition.score
    return sorted(best, key=lambda p: (-best[p], p))


def build_repo_map(
    files: dict[str, str],
    focus_files: Iterable[str] = (),
    mentioned_idents: Iterable[str] = (),
    max_chars: int = 4000,
) -> str:
    """Render a compact, ranked map of the repository.

    Definitions are emitted most-important first, grouped by file, until the
    character budget is spent — so a small context window still receives the
    code that matters most.
    """
    ranked = rank_definitions(files, focus_files, mentioned_idents)
    if not ranked:
        return ""

    by_file: dict[str, list[RankedDef]] = defaultdict(list)
    order: list[str] = []
    for definition in ranked:
        if definition.path not in by_file:
            order.append(definition.path)
        by_file[definition.path].append(definition)

    out: list[str] = []
    used = 0
    for path in order:
        lines = [f"{path}:"]
        for definition in sorted(by_file[path], key=lambda d: d.line):
            lines.append(f"  {definition.line}: {definition.name}")
        section = "\n".join(lines)
        if used + len(section) + 1 > max_chars:
            break
        out.append(section)
        used += len(section) + 1
    return "\n".join(out)
