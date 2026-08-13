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

    def public(self) -> dict[str, Any]:
        data = asdict(self)
        data["languages"] = list(self.languages)
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


def inspect_gguf(path: Path) -> dict[str, Any]:
    """Inspect only safe file properties; no model code is loaded or executed."""
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
        "sha256": sha256(path) if valid else None,
    }
    if not valid:
        result["reason"] = "file is too small or does not have the GGUF magic bytes"
    return result


def catalog_payload() -> dict[str, Any]:
    """Return catalog metadata plus the active file inspection without network access."""
    return {
        "object": "a2i.local_model_catalog",
        "mode": "local-only",
        "active_model": inspect_gguf(ACTIVE_MODEL),
        "assets": [asset.public() for asset in CATALOG],
    }
