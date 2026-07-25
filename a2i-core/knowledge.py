"""Local knowledge base for A2I Core.

A tiny, dependency-free retrieval layer: documents are split into chunks
and ranked with TF-IDF cosine similarity. Everything is computed locally
— no embedding API, no network access.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from extract import UNSUPPORTED_SUFFIXES, extract, supported_suffixes

_WORD_RE = re.compile(r"[\wក-៿]+", re.UNICODE)

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def tokenize_raw(text: str) -> list[str]:
    """Tokenize preserving case, so identifier shape stays detectable."""
    return _WORD_RE.findall(text)


# Splits an identifier into word parts: FooBar -> Foo, Bar; HTTPServer -> HTTP,
# Server. Same pattern sweep uses for its code index.
_VARIABLE_RE = re.compile(r"[A-Z][a-z]+|[a-z]+|[A-Z]+(?=[A-Z]|$)|\d+")


def _is_meaningful(part: str) -> bool:
    """Reject junk tokens such as ``aaaa`` or base64 blobs.

    Heuristic from sweep's code tokenizer: a real word is mostly
    alphanumeric and does not repeat a tiny alphabet.
    """
    if len(part) < 2:
        return False
    alnum = sum(1 for c in part if c.isalnum())
    return alnum > len(part) // 2 and len(part) / len(set(part)) < 4


def split_identifier(token: str) -> list[str]:
    """Split ``parse_config_file`` / ``parseConfigFile`` into word parts."""
    parts: list[str] = []
    for section in token.split("_"):
        for part in _VARIABLE_RE.findall(section):
            if _is_meaningful(part):
                parts.append(part.lower())
    return parts


def tokenize(text: str) -> list[str]:
    """Index tokens: the whole word plus its identifier parts.

    Keeping both means an exact search for ``parse_config_file`` still scores
    highest, while a search for "config parser" can also reach it — the
    behaviour sweep's code index provides.
    """
    tokens: list[str] = []
    for raw in tokenize_raw(text):
        lowered = raw.lower()
        tokens.append(lowered)
        parts = split_identifier(raw)
        if len(parts) > 1:  # only add parts for compound identifiers
            tokens.extend(p for p in parts if p != lowered)
    return tokens


def identifier_weight(term: str) -> float:
    """How distinctive a term looks, judged by its shape.

    Adapted from aider's repo-map heuristics: a long ``snake_case`` or
    ``camelCase`` name is a strong relevance signal, while a leading
    underscore marks an implementation detail. Applied to query terms so a
    search for ``parse_config_file`` is not diluted by ordinary words.
    Aider's multipliers are tuned for PageRank edge weights; TF-IDF scores
    are far more sensitive, so the boost here is deliberately gentler.
    """
    has_alpha = any(c.isalpha() for c in term)
    is_snake = "_" in term.strip("_") and has_alpha
    is_camel = any(c.isupper() for c in term) and any(c.islower() for c in term)

    weight = 1.0
    if (is_snake or is_camel) and len(term) >= 8:
        weight *= 3.0
    if term.startswith("_"):
        weight *= 0.5
    if len(term) <= 2:
        weight *= 0.5
    return weight


#: Separators tried in order, coarsest first: paragraphs, then lines, then
#: sentences (including the Khmer ។ and CJK 。), then words. Adapted from
#: dify's recursive splitter — cutting on structure keeps each chunk
#: self-contained, where a fixed-width cut lands mid-sentence and produces
#: chunks that retrieve badly and read worse.
_SEPARATORS = ["\n\n", "\n", "។ ", "។", "。", ". ", "! ", "? ", "; ", " ", ""]


def _split_on(text: str, separator: str) -> list[str]:
    if separator == "":
        return list(text)
    parts = text.split(separator)
    # Keep the separator attached so rejoined chunks read naturally.
    return [p + separator for p in parts[:-1]] + [parts[-1]]


def _recursive_split(text: str, size: int, separators: list[str]) -> list[str]:
    """Split ``text`` into pieces of at most ``size``, respecting structure."""
    if len(text) <= size:
        return [text] if text.strip() else []
    if not separators:
        return [text[i : i + size] for i in range(0, len(text), size)]

    separator, rest = separators[0], separators[1:]
    pieces: list[str] = []
    buffer = ""
    for piece in _split_on(text, separator):
        if len(piece) > size:
            if buffer:
                pieces.append(buffer)
                buffer = ""
            pieces.extend(_recursive_split(piece, size, rest))
        elif len(buffer) + len(piece) <= size:
            buffer += piece
        else:
            if buffer:
                pieces.append(buffer)
            buffer = piece
    if buffer:
        pieces.append(buffer)
    return [p for p in pieces if p.strip()]


def split_into_chunks(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split a document into overlapping, structure-aware chunks.

    Overlap is taken from the tail of the previous chunk so a fact that
    straddles a boundary is still retrievable from one side.
    """
    pieces = _recursive_split(text, size, _SEPARATORS)
    if overlap <= 0 or len(pieces) < 2:
        return [p.strip() for p in pieces if p.strip()]

    chunks: list[str] = []
    for index, piece in enumerate(pieces):
        if index == 0:
            chunks.append(piece.strip())
            continue
        tail = pieces[index - 1][-overlap:]
        chunks.append((tail + piece).strip())
    return [c for c in chunks if c]


@dataclass
class Chunk:
    source: str
    text: str
    term_counts: Counter[str] = field(repr=False, default_factory=Counter)

    def __str__(self) -> str:
        return f"{self.source}: {self.text[:60]}..."


#: BM25 term-frequency saturation. Above this, extra repeats add little.
BM25_K1 = 1.5
#: BM25 length normalisation: 0 = off, 1 = full.
BM25_B = 0.75


class KnowledgeBase:
    """BM25 retrieval over local text documents.

    BM25 rather than plain TF-IDF cosine: it saturates term frequency (a word
    repeated 20 times is not 20× more relevant) and normalises by document
    length, which matters because chunks vary in size. Both dify's weighted
    reranker and sweep's code index use BM25 for the same reasons.
    """

    def __init__(self, chunks: list[Chunk]) -> None:
        self._chunks = chunks
        self._doc_freq: Counter[str] = Counter()
        self._lengths: list[int] = []
        for chunk in chunks:
            chunk.term_counts = Counter(tokenize(chunk.text))
            self._doc_freq.update(chunk.term_counts.keys())
            self._lengths.append(sum(chunk.term_counts.values()))
        self._avg_len = (sum(self._lengths) / len(self._lengths)) if self._lengths else 0.0

    @classmethod
    def from_directory(
        cls, directory: Path, on_skip: Callable[[str], None] | None = None
    ) -> "KnowledgeBase":
        """Index every document under ``directory`` that can be read as text.

        Args:
            directory: Folder to index, searched recursively.
            on_skip: Called with a message for each file that could not be
                read, so unreadable material is visible rather than silently
                dropped.
        """
        chunks: list[Chunk] = []
        supported = supported_suffixes()
        for path in sorted(directory.rglob("*")):
            if not path.is_file():
                continue
            suffix = path.suffix.lower()
            if suffix not in supported and suffix not in UNSUPPORTED_SUFFIXES:
                continue
            result = extract(path)
            if not result.ok:
                if on_skip and result.error:
                    on_skip(f"{path.name}: {result.error}")
                continue
            for text in split_into_chunks(result.text):
                chunks.append(Chunk(source=path.name, text=text))
        return cls(chunks)

    @property
    def size(self) -> int:
        return len(self._chunks)

    def _idf(self, term: str) -> float:
        """BM25 inverse document frequency (always positive)."""
        df = self._doc_freq.get(term, 0)
        n = len(self._chunks)
        return math.log(1 + (n - df + 0.5) / (df + 0.5))

    def search(self, query: str, top_k: int = 3) -> list[Chunk]:
        query_counts = Counter(tokenize(query))
        if not query_counts or not self._chunks:
            return []

        # Weight query terms by how distinctive their identifier shape is,
        # judged on the original (pre-lowercase) spelling.
        weights: dict[str, float] = {}
        for raw in tokenize_raw(query):
            lowered = raw.lower()
            weight = identifier_weight(raw)
            weights[lowered] = max(weights.get(lowered, 0.0), weight)
            # Parts of a compound identifier inherit a share of its weight.
            for part in split_identifier(raw):
                weights.setdefault(part, weight * 0.5)

        def score(chunk: Chunk, length: int) -> float:
            total = 0.0
            for term in query_counts:
                freq = chunk.term_counts.get(term, 0)
                if not freq:
                    continue
                norm = 1 - BM25_B + BM25_B * (length / self._avg_len if self._avg_len else 1)
                saturated = (freq * (BM25_K1 + 1)) / (freq + BM25_K1 * norm)
                total += self._idf(term) * saturated * weights.get(term, 1.0)
            return total

        scored = [
            (score(chunk, length), index, chunk)
            for index, (chunk, length) in enumerate(zip(self._chunks, self._lengths))
        ]
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [chunk for value, _index, chunk in scored[:top_k] if value > 0]

    def __repr__(self) -> str:
        return f"KnowledgeBase(chunks={len(self._chunks)})"
