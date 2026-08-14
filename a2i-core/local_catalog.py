"""Curated local-only model catalog and GGUF asset verification.

The catalog intentionally includes a small number of published GGUF assets with
clear model cards. It is not an inference-provider list: every entry is a file
the user downloads once to their own storage and then runs offline through A2I
Core. Community assets must be reviewed by source, license and checksum before
they become the active model.
"""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

MODELS_DIR = Path(__file__).with_name("models")
LIBRARY_DIR = MODELS_DIR / "library"
ACTIVE_MODEL = MODELS_DIR / "model.gguf"


@dataclass(frozen=True)
class LocalModelAsset:
    id: str
    name: str
    download_url: str
    model_card_url: str
    license_note: str
    languages: tuple[str, ...]
    min_ram_gb: int
    recommended_ram_gb: int
    approx_disk_gb: float
    quantization: str
    recommended_for: str
    community_asset: bool = False
    # Split GGUF assets are joined locally by the model manager. This is not
    # public UI input: only catalog-maintained URLs may be downloaded.
    download_parts: tuple[str, ...] = ()

    def public(self) -> dict[str, Any]:
        data = asdict(self)
        data["languages"] = list(self.languages)
        data.pop("download_parts", None)
        return data


CATALOG: tuple[LocalModelAsset, ...] = (
    LocalModelAsset(
        id="qwen-1.5b",
        name="Qwen2.5 1.5B Instruct",
        download_url="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        model_card_url="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF",
        license_note="Review the publisher model card and Qwen license before download.",
        languages=("multilingual",),
        min_ram_gb=4,
        recommended_ram_gb=6,
        approx_disk_gb=1.2,
        quantization="Q4_K_M",
        recommended_for="Fast offline chat and basic local document questions.",
    ),
    LocalModelAsset(
        id="qwen-3b",
        name="Qwen2.5 3B Instruct",
        download_url="https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
        model_card_url="https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF",
        license_note="Review the publisher model card and Qwen license before download.",
        languages=("multilingual", "Khmer experimental"),
        min_ram_gb=7,
        recommended_ram_gb=10,
        approx_disk_gb=2.1,
        quantization="Q4_K_M",
        recommended_for="Recommended default for this 12 GB PC: daily assistant and local RAG.",
    ),
    LocalModelAsset(
        id="qwen-7b",
        name="Qwen2.5 7B Instruct",
        download_url="https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf",
        model_card_url="https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF",
        license_note="Review the publisher model card and Qwen license before download. The official Q4_K_M asset has two parts; A2I's downloader joins them locally.",
        languages=("multilingual", "Khmer experimental"),
        min_ram_gb=10,
        recommended_ram_gb=16,
        approx_disk_gb=4.7,
        quantization="Q4_K_M",
        recommended_for="Slower quality mode for writing, reasoning, and longer local work.",
        download_parts=(
            "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf",
            "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf",
        ),
    ),
    LocalModelAsset(
        id="qwen-coder-7b",
        name="Qwen2.5 Coder 7B Instruct",
        download_url="https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf",
        model_card_url="https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
        license_note="Review the publisher model card and Qwen license before download.",
        languages=("code", "English", "multilingual prompts"),
        min_ram_gb=10,
        recommended_ram_gb=16,
        approx_disk_gb=4.7,
        quantization="Q4_K_M",
        recommended_for="Local code explanation, repository Q&A, and review plans.",
    ),
    LocalModelAsset(
        id="sea-lion-7b",
        name="SEA-LION 7B Instruct",
        download_url="https://huggingface.co/aisingapore/sea-lion-7b-instruct-gguf/resolve/main/sea-lion-7b-instruct-Q4_0.gguf",
        model_card_url="https://huggingface.co/aisingapore/SEA-LION-v1-7B-IT-GGUF",
        license_note="MIT License according to the publisher model card; review the model's safety caveats before use.",
        languages=("Khmer", "English", "Thai", "Vietnamese", "Malay", "Indonesian", "ASEAN languages"),
        min_ram_gb=10,
        recommended_ram_gb=16,
        approx_disk_gb=4.0,
        quantization="Q4_0",
        recommended_for="Optional Khmer/ASEAN language experiment on this PC; expect slower CPU generation.",
        community_asset=True,
    ),
)


def get_asset(asset_id: str) -> LocalModelAsset:
    for asset in CATALOG:
        if asset.id == asset_id:
            return asset
    raise KeyError(asset_id)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_gguf(path: Path, include_sha: bool = True) -> dict[str, Any]:
    """Inspect only safe file properties; no model code is loaded or executed.

    Library list refreshes can skip a multi-gigabyte SHA-256 pass; a completed
    download always records its checksum in a receipt and the active model can
    still be inspected with a full hash when requested.
    """
    if not path.exists():
        return {"exists": False, "valid_gguf": False}
    size = path.stat().st_size
    with path.open("rb") as handle:
        magic = handle.read(4)
    valid = size >= 10_000_000 and magic == b"GGUF"
    result: dict[str, Any] = {
        "exists": True,
        "valid_gguf": valid,
        "size_bytes": size,
        "sha256": sha256(path) if valid and include_sha else None,
    }
    if not valid:
        result["reason"] = "file is too small or does not have the GGUF magic bytes"
    return result


def library_asset_path(asset_id: str) -> Path:
    """Return the only approved local library filename for a catalog asset."""
    if "/" in asset_id or "\\" in asset_id or asset_id in {"", ".", ".."}:
        raise ValueError("invalid local model asset id")
    return LIBRARY_DIR / f"{asset_id}.gguf"


def receipt_path(asset_id: str) -> Path:
    return library_asset_path(asset_id).with_suffix(".json")


def _same_file(left: Path, right: Path) -> bool:
    try:
        return left.exists() and right.exists() and left.samefile(right)
    except OSError:
        return False


def installed_asset_payload(asset: LocalModelAsset) -> dict[str, Any]:
    path = library_asset_path(asset.id)
    inspection = inspect_gguf(path, include_sha=False)
    return {
        **asset.public(),
        "installed": bool(inspection.get("valid_gguf")),
        "active": _same_file(ACTIVE_MODEL, path),
        "local_file": {
            "size_bytes": inspection.get("size_bytes", 0),
            "valid_gguf": inspection.get("valid_gguf", False),
        },
    }


def active_asset_id() -> str | None:
    for asset in CATALOG:
        if _same_file(ACTIVE_MODEL, library_asset_path(asset.id)):
            return asset.id
    return None


def catalog_payload() -> dict[str, Any]:
    """Return catalog metadata and local installation state without inference."""
    return {
        "object": "a2i.local_model_catalog",
        "mode": "local-only",
        "active_model": inspect_gguf(ACTIVE_MODEL),
        "active_asset_id": active_asset_id(),
        "assets": [installed_asset_payload(asset) for asset in CATALOG],
    }
