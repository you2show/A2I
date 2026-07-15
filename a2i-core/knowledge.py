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

_WORD_RE = re.compile(r"[\wក-៿]+", re.UNICODE)

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def tokenize(text: str) -> list[str]:
    return _WORD_RE.findall(text.lower())


def split_into_chunks(text: str) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        chunk = text[start : start + CHUNK_SIZE].strip()
        if chunk:
            chunks.append(chunk)
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


@dataclass
class Chunk:
    source: str
    text: str
    term_counts: Counter[str] = field(repr=False, default_factory=Counter)

    def __str__(self) -> str:
        return f"{self.source}: {self.text[:60]}..."


class KnowledgeBase:
    """TF-IDF retrieval over local text documents."""

    def __init__(self, chunks: list[Chunk]) -> None:
        self._chunks = chunks
        self._doc_freq: Counter[str] = Counter()
        for chunk in chunks:
            chunk.term_counts = Counter(tokenize(chunk.text))
            self._doc_freq.update(chunk.term_counts.keys())

    @classmethod
    def from_directory(cls, directory: Path) -> "KnowledgeBase":
        chunks: list[Chunk] = []
        for path in sorted(directory.rglob("*")):
            if path.suffix.lower() not in {".txt", ".md"} or not path.is_file():
                continue
            for text in split_into_chunks(path.read_text(errors="ignore")):
                chunks.append(Chunk(source=path.name, text=text))
        return cls(chunks)

    @property
    def size(self) -> int:
        return len(self._chunks)

    def _idf(self, term: str) -> float:
        df = self._doc_freq.get(term, 0)
        return math.log((1 + len(self._chunks)) / (1 + df)) + 1

    def search(self, query: str, top_k: int = 3) -> list[Chunk]:
        query_counts = Counter(tokenize(query))
        if not query_counts or not self._chunks:
            return []

        def score(chunk: Chunk) -> float:
            dot = 0.0
            for term, q_count in query_counts.items():
                if term in chunk.term_counts:
                    idf = self._idf(term)
                    dot += (q_count * idf) * (chunk.term_counts[term] * idf)
            norm = math.sqrt(
                sum((c * self._idf(t)) ** 2 for t, c in chunk.term_counts.items())
            )
            return dot / norm if norm else 0.0

        ranked = sorted(self._chunks, key=score, reverse=True)
        return [c for c in ranked[:top_k] if score(c) > 0]

    def __repr__(self) -> str:
        return f"KnowledgeBase(chunks={len(self._chunks)})"
