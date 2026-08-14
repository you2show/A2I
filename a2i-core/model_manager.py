"""A2I local GGUF model manager.

This module is deliberately a small, allow-listed control plane. It downloads
only URLs in :mod:`local_catalog`, stores model bytes in the user's own model
library, verifies the GGUF magic bytes, records a SHA-256 receipt, and selects
the next model for A2I Core. It never downloads or executes repository scripts
and it never performs inference through a remote API.
"""

from __future__ import annotations

import json
import os
import shutil
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from local_catalog import (
    ACTIVE_MODEL,
    LIBRARY_DIR,
    MODELS_DIR,
    get_asset,
    inspect_gguf,
    library_asset_path,
    receipt_path,
    sha256,
)

SELECTION_FILE = MODELS_DIR / "selected-model.json"
_MIN_GGUF_BYTES = 10_000_000
_CHUNK_BYTES = 1024 * 1024


@dataclass
class DownloadJob:
    asset_id: str
    activate: bool
    status: str = "queued"
    bytes_downloaded: int = 0
    total_bytes: int | None = None
    message: str = "Waiting to start"
    error: str | None = None
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None

    def public(self) -> dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "activate": self.activate,
            "status": self.status,
            "bytes_downloaded": self.bytes_downloaded,
            "total_bytes": self.total_bytes,
            "message": self.message,
            "error": self.error,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }


_jobs: dict[str, DownloadJob] = {}
_jobs_lock = threading.Lock()


def selected_asset_id() -> str | None:
    """Return the next selected catalog asset without trusting arbitrary paths."""
    try:
        payload = json.loads(SELECTION_FILE.read_text(encoding="utf-8"))
        asset_id = payload.get("asset_id")
        get_asset(asset_id)
        return asset_id
    except (OSError, ValueError, TypeError, json.JSONDecodeError, KeyError):
        return None


def selection_payload() -> dict[str, Any]:
    selected = selected_asset_id()
    return {
        "selected_asset_id": selected,
        "restart_required": bool(selected),
        "loaded_model": ACTIVE_MODEL.name if ACTIVE_MODEL.exists() else None,
    }


def download_status(asset_id: str | None = None) -> dict[str, Any]:
    """Return in-memory download progress. Jobs disappear only on process exit."""
    with _jobs_lock:
        if asset_id:
            job = _jobs.get(asset_id)
            return job.public() if job else {"asset_id": asset_id, "status": "idle"}
        return {"jobs": [job.public() for job in _jobs.values()]}


def _write_selection(asset_id: str) -> None:
    asset = get_asset(asset_id)  # allow-list and validate ID first
    path = library_asset_path(asset.id)
    inspection = inspect_gguf(path, include_sha=False)
    if not inspection.get("valid_gguf"):
        raise ValueError("This verified model is not installed completely yet.")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    SELECTION_FILE.write_text(
        json.dumps(
            {
                "asset_id": asset.id,
                "name": asset.name,
                "selected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def select_installed_asset(asset_id: str) -> dict[str, Any]:
    """Select a verified local asset for the *next* Core start.

    Replacing a model while llama.cpp is using it can fail on Windows and can
    create an unclear model state. Selection is therefore explicit and the
    process keeps the currently loaded model until the user restarts Core.
    """
    _write_selection(asset_id)
    return {
        "asset_id": asset_id,
        "selected": True,
        "restart_required": True,
        "message": "Model selected. Restart A2I Core to load it from your SSD.",
    }


def _link_or_copy(source: Path, destination: Path) -> None:
    """Materialize the selected asset as model.gguf without a second download."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + ".next")
    temporary.unlink(missing_ok=True)
    try:
        os.link(source, temporary)
    except OSError:
        shutil.copy2(source, temporary)
    os.replace(temporary, destination)


def apply_selected_model() -> dict[str, Any]:
    """Apply the selected model before Core loads llama.cpp on startup."""
    asset_id = selected_asset_id()
    if not asset_id:
        return {"applied": False, "reason": "no selection"}
    source = library_asset_path(asset_id)
    inspection = inspect_gguf(source, include_sha=False)
    if not inspection.get("valid_gguf"):
        return {"applied": False, "reason": "selected asset is not valid"}
    try:
        if not (ACTIVE_MODEL.exists() and ACTIVE_MODEL.samefile(source)):
            _link_or_copy(source, ACTIVE_MODEL)
        return {"applied": True, "asset_id": asset_id, "model_path": str(ACTIVE_MODEL)}
    except OSError as error:
        return {"applied": False, "reason": f"could not activate selected model: {error}"}


def _verify_complete_gguf(path: Path) -> None:
    inspection = inspect_gguf(path, include_sha=False)
    if not inspection.get("valid_gguf"):
        path.unlink(missing_ok=True)
        raise ValueError("Download did not produce a valid GGUF model.")


def _download_part(url: str, target: Path, job: DownloadJob) -> None:
    """Download one allow-listed part with resume support into a private partial."""
    resume_from = target.stat().st_size if target.exists() else 0
    headers = {"User-Agent": "A2I-local-model-manager/1.0"}
    if resume_from:
        headers["Range"] = f"bytes={resume_from}-"
    request = Request(url, headers=headers)
    with urlopen(request, timeout=60) as response:  # nosec B310: URL is catalog-maintained
        status = getattr(response, "status", response.getcode())
        # A server that ignores Range must overwrite the stale partial rather
        # than append duplicate bytes.
        append = resume_from > 0 and status == 206
        if not append:
            resume_from = 0
        content_length = response.headers.get("Content-Length")
        if content_length and content_length.isdigit():
            part_total = resume_from + int(content_length)
            job.total_bytes = (job.total_bytes or 0) + part_total
        mode = "ab" if append else "wb"
        with target.open(mode) as handle:
            while True:
                chunk = response.read(_CHUNK_BYTES)
                if not chunk:
                    break
                handle.write(chunk)
                job.bytes_downloaded += len(chunk)
                job.message = f"Downloading {job.bytes_downloaded // (1024 * 1024)} MB"


def _download_worker(job: DownloadJob) -> None:
    try:
        asset = get_asset(job.asset_id)
        destination = library_asset_path(asset.id)
        receipt = receipt_path(asset.id)
        LIBRARY_DIR.mkdir(parents=True, exist_ok=True)

        if inspect_gguf(destination, include_sha=False).get("valid_gguf"):
            job.status = "installed"
            job.message = "Already stored on this PC — no download needed."
            if job.activate:
                select_installed_asset(asset.id)
                job.message = "Already stored on this PC. Selected for the next Core restart."
            return

        job.status = "downloading"
        job.message = "Downloading verified GGUF data to your SSD."
        parts = asset.download_parts or (asset.download_url,)
        partials: list[Path] = []
        for index, url in enumerate(parts):
            partial = LIBRARY_DIR / f".{asset.id}.part{index}.partial"
            partials.append(partial)
            _download_part(url, partial, job)

        combined = LIBRARY_DIR / f".{asset.id}.gguf.partial"
        combined.unlink(missing_ok=True)
        with combined.open("wb") as out:
            for partial in partials:
                with partial.open("rb") as source:
                    shutil.copyfileobj(source, out, length=_CHUNK_BYTES)
        _verify_complete_gguf(combined)
        os.replace(combined, destination)
        for partial in partials:
            partial.unlink(missing_ok=True)

        digest = sha256(destination)
        receipt.write_text(
            json.dumps(
                {
                    "id": asset.id,
                    "name": asset.name,
                    "source": list(parts),
                    "model_card": asset.model_card_url,
                    "license_note": asset.license_note,
                    "sha256": digest,
                    "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        if job.activate:
            select_installed_asset(asset.id)
            job.message = "Download complete. Restart A2I Core to load this model."
        else:
            job.message = "Download complete. The model is stored on this PC."
        job.status = "complete"
    except Exception as error:  # Surface only a plain local error to the UI.
        job.status = "failed"
        job.error = str(error)
        job.message = "Download did not complete. You can retry; partial files are kept for resume."
    finally:
        job.finished_at = time.time()


def start_download(asset_id: str, activate: bool = True) -> dict[str, Any]:
    """Start a confirmed download in a daemon thread and return its status."""
    asset = get_asset(asset_id)  # validate allow-list before creating a job
    with _jobs_lock:
        existing = _jobs.get(asset.id)
        if existing and existing.status in {"queued", "downloading"}:
            return {"accepted": True, "already_running": True, "job": existing.public()}
        job = DownloadJob(asset_id=asset.id, activate=activate)
        _jobs[asset.id] = job
        thread = threading.Thread(target=_download_worker, args=(job,), daemon=True, name=f"a2i-download-{asset.id}")
        thread.start()
        return {"accepted": True, "already_running": False, "job": job.public()}


def install_default_if_missing(asset_id: str = "qwen-3b") -> None:
    """CLI/startup helper for first-run setup; blocks only outside the web API."""
    if inspect_gguf(ACTIVE_MODEL, include_sha=False).get("valid_gguf"):
        return
    # An existing selected asset is always preferable to fetching the default
    # again. This is the key to download-once behavior across Core restarts.
    selected = apply_selected_model()
    if selected.get("applied"):
        return
    result = start_download(asset_id, activate=True)
    job = _jobs[result["job"]["asset_id"]]
    while job.status in {"queued", "downloading"}:
        time.sleep(0.25)
    if job.status not in {"installed", "complete"}:
        raise RuntimeError(job.error or "model download failed")
    applied = apply_selected_model()
    if not applied.get("applied"):
        raise RuntimeError(str(applied.get("reason") or "model activation failed"))


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="A2I local GGUF model manager")
    parser.add_argument("command", choices=("install-default", "apply-selection"))
    args = parser.parse_args()
    if args.command == "install-default":
        install_default_if_missing()
    else:
        print(json.dumps(apply_selected_model(), indent=2))
