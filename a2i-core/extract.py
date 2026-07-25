"""Extract plain text from documents for the knowledge base.

A2I's knowledge base originally read only ``.txt`` and ``.md``, which meant
most real material — notes exported as HTML, spreadsheets, JSON dumps,
source files — could not be used at all. Dify solves this with a registry of
per-format extractors; this is the same idea, restricted to what the Python
standard library can do so A2I Core stays dependency-free.

Formats needing a third-party parser (PDF, .docx, .xlsx) are recognised and
reported as unsupported rather than silently skipped, so the user knows to
convert them instead of wondering why a file was ignored.
"""

from __future__ import annotations

import csv
import io
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

#: Plain-text formats, including source code, read as-is.
TEXT_SUFFIXES = frozenset(
    """
    .txt .md .markdown .rst .log .text
    .py .js .jsx .ts .tsx .go .rs .java .rb .php .c .h .cpp .hpp .cs .swift .kt
    .sh .bash .zsh .sql .yaml .yml .toml .ini .cfg .env
    """.split()
)

#: Formats we can parse with the standard library.
STRUCTURED_SUFFIXES = frozenset({".html", ".htm", ".xml", ".csv", ".tsv", ".json", ".docx"})

#: Recognised but needing a third-party parser.
UNSUPPORTED_SUFFIXES = frozenset({".pdf", ".xlsx", ".xls", ".doc", ".ppt", ".pptx", ".odt"})


@dataclass
class Extracted:
    """Text pulled from one file, or the reason it could not be."""

    path: Path
    text: str = ""
    error: str = ""

    @property
    def ok(self) -> bool:
        return bool(self.text.strip())

    def __str__(self) -> str:
        return f"{self.path.name}: {'ok' if self.ok else self.error or 'empty'}"


class _TextHTMLParser(HTMLParser):
    """Collect visible text, dropping script/style content."""

    _SKIP = {"script", "style", "noscript", "head"}
    _BREAK = {"p", "br", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skipping = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._SKIP:
            self._skipping += 1
        elif tag in self._BREAK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP and self._skipping:
            self._skipping -= 1
        elif tag in self._BREAK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skipping and data.strip():
            self.parts.append(data.strip())

    def text(self) -> str:
        joined = " ".join(self.parts)
        return re.sub(r"[ \t]*\n[ \t]*", "\n", re.sub(r"\n{3,}", "\n\n", joined)).strip()


def _from_html(raw: str) -> str:
    parser = _TextHTMLParser()
    parser.feed(raw)
    return parser.text()


def _from_xml(raw: str) -> str:
    root = ET.fromstring(raw)
    return "\n".join(t.strip() for t in root.itertext() if t and t.strip())


def _from_delimited(raw: str, delimiter: str) -> str:
    """Render rows as ``column: value`` lines so retrieval sees the headers."""
    rows = list(csv.reader(io.StringIO(raw), delimiter=delimiter))
    if not rows:
        return ""
    header, *body = rows
    if not body:
        return " | ".join(header)
    lines = []
    for row in body:
        pairs = [f"{h}: {v}" for h, v in zip(header, row) if v.strip()]
        if pairs:
            lines.append(", ".join(pairs))
    return "\n".join(lines)


def _from_json(raw: str) -> str:
    """Flatten JSON into ``a.b.c: value`` lines."""
    data = json.loads(raw)
    lines: list[str] = []

    def walk(node: object, prefix: str) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                walk(value, f"{prefix}.{key}" if prefix else str(key))
        elif isinstance(node, list):
            for index, value in enumerate(node):
                walk(value, f"{prefix}[{index}]")
        else:
            lines.append(f"{prefix}: {node}" if prefix else str(node))

    walk(data, "")
    return "\n".join(lines)


def _from_docx(path: Path) -> str:
    """A .docx is a zip of XML — readable without a Word library."""
    with zipfile.ZipFile(path) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
    # Paragraph marks become newlines; strip the remaining tags.
    xml = re.sub(r"</w:p>", "\n", xml)
    return re.sub(r"<[^>]+>", "", xml).strip()


def extract(path: Path) -> Extracted:
    """Extract text from one file, never raising."""
    suffix = path.suffix.lower()
    try:
        if suffix in UNSUPPORTED_SUFFIXES:
            return Extracted(path, error=f"{suffix} needs conversion to text first")
        if suffix in TEXT_SUFFIXES or suffix == "":
            return Extracted(path, text=path.read_text(errors="ignore"))
        if suffix in {".html", ".htm"}:
            return Extracted(path, text=_from_html(path.read_text(errors="ignore")))
        if suffix == ".xml":
            return Extracted(path, text=_from_xml(path.read_text(errors="ignore")))
        if suffix in {".csv", ".tsv"}:
            delimiter = "\t" if suffix == ".tsv" else ","
            return Extracted(path, text=_from_delimited(path.read_text(errors="ignore"), delimiter))
        if suffix == ".json":
            return Extracted(path, text=_from_json(path.read_text(errors="ignore")))
        if suffix == ".docx":
            return Extracted(path, text=_from_docx(path))
    except (OSError, UnicodeDecodeError, ValueError, ET.ParseError, zipfile.BadZipFile, KeyError) as exc:
        return Extracted(path, error=f"{type(exc).__name__}: {exc}")
    return Extracted(path, error=f"unsupported type {suffix or '(none)'}")


def supported_suffixes() -> frozenset[str]:
    """Every suffix :func:`extract` can turn into text."""
    return TEXT_SUFFIXES | STRUCTURED_SUFFIXES
