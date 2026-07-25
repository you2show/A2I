"""Fetch web pages and turn them into readable text.

OpenHands gives its agent a full browser (browsergym + playwright) so it can
click through pages. That is a heavy dependency and more than A2I needs: the
valuable part for grounding an answer is *reading* a page, which the standard
library plus the HTML extractor in :mod:`extract` already cover.

So this module deliberately does less than a real browser — it does **not**
run JavaScript, so pages that render entirely client-side will come back
close to empty. It is for articles, docs and READMEs, not web apps.

Safety notes:

* responses are capped and time-limited, so a huge or slow page cannot hang
  the caller;
* only ``http``/``https`` are followed;
* private and loopback addresses are refused by default. An agent's input
  can be influenced by whatever it just read, so letting it fetch
  ``127.0.0.1`` or a ``192.168.*`` host would be a server-side request
  forgery risk. Pass ``allow_private=True`` when *you* are the one naming
  the URL.
"""

from __future__ import annotations

import ipaddress
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from extract import _from_html

USER_AGENT = "A2I/1.0 (+https://github.com/you2show/A2I)"
MAX_BYTES = 2_000_000
DEFAULT_TIMEOUT = 15


@dataclass
class Page:
    """A fetched page, or why it could not be fetched."""

    url: str
    title: str = ""
    text: str = ""
    error: str = ""

    @property
    def ok(self) -> bool:
        return bool(self.text.strip())

    def __str__(self) -> str:
        return f"{self.url}: {'ok' if self.ok else self.error or 'empty'}"


def _address_check(host: str) -> str:
    """``""`` when the host is safe to fetch, otherwise the reason it is not."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return "could not resolve host"
    for info in infos:
        try:
            address = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
        ):
            return "refusing to fetch a private or loopback address"
    return ""


def fetch(
    url: str,
    timeout: int = DEFAULT_TIMEOUT,
    allow_private: bool = False,
    max_bytes: int = MAX_BYTES,
) -> Page:
    """Fetch ``url`` and return its readable text. Never raises."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return Page(url, error=f"unsupported scheme {parsed.scheme or '(none)'}")
    if not parsed.hostname:
        return Page(url, error="no host in URL")
    if not allow_private:
        refusal = _address_check(parsed.hostname)
        if refusal:
            return Page(url, error=refusal)

    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content_type = response.headers.get("Content-Type", "")
            raw = response.read(max_bytes)
    except urllib.error.HTTPError as exc:
        return Page(url, error=f"HTTP {exc.code}")
    except (urllib.error.URLError, OSError, ValueError) as exc:
        return Page(url, error=f"{type(exc).__name__}: {exc}")

    charset = "utf-8"
    if "charset=" in content_type:
        charset = content_type.split("charset=")[-1].split(";")[0].strip() or "utf-8"
    try:
        body = raw.decode(charset, errors="ignore")
    except LookupError:
        body = raw.decode("utf-8", errors="ignore")

    if "html" in content_type or body.lstrip()[:200].lower().startswith(("<!doctype html", "<html")):
        title_match = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
        title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else ""
        return Page(url, title=title, text=_from_html(body))
    if "json" in content_type or "text" in content_type or not content_type:
        return Page(url, text=body.strip())
    return Page(url, error=f"unsupported content type {content_type!r}")


def find_urls(text: str) -> list[str]:
    """Every http(s) URL mentioned in ``text``, in order, deduplicated."""
    found = re.findall(r"https?://[^\s<>\"'\)\]]+", text)
    seen: list[str] = []
    for url in found:
        cleaned = url.rstrip(".,;:!?")
        if cleaned not in seen:
            seen.append(cleaned)
    return seen


def browse(
    urls: list[str], limit: int = 3, chars_per_page: int = 4000, **kwargs: object
) -> list[Page]:
    """Fetch several URLs, returning only the ones that produced text."""
    pages: list[Page] = []
    for url in urls[:limit]:
        page = fetch(url, **kwargs)  # type: ignore[arg-type]
        if page.ok:
            page.text = page.text[:chars_per_page]
            pages.append(page)
    return pages
