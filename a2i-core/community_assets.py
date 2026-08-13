"""Curated registry for frontier community assets that do not fit A2I's laptop tier.

This registry is deliberately metadata-only. It gives A2I a reviewable record of
model cards, licences and hardware gates, but never triggers a heavyweight
download or remote inference request. Models move into ``local_catalog.py`` only
after they have a compatible local runtime and fit the user's hardware tier.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class CommunityAsset:
    id: str
    repository: str
    modality: str
    license_note: str
    published_requirement: str
    a2i_status: str
    a2i_recommendation: str
    model_card_url: str


FRONTIER_ASSETS: tuple[CommunityAsset, ...] = (
    CommunityAsset(
        id="muse-glimmer-30b",
        repository="meta-models/Muse-Glimmer-30B",
        modality="multimodal agentic language model",
        license_note="Apache-2.0 according to the model card.",
        published_requirement="The publisher's 4-bit deployment target is a 24 GB or 32 GB memory/VRAM envelope.",
        a2i_status="future_owned_gpu",
        a2i_recommendation="Use only on a user-owned 24 GB+ GPU workstation or server. It is not downloadable through the laptop catalog.",
        model_card_url="https://huggingface.co/meta-models/Muse-Glimmer-30B",
    ),
    CommunityAsset(
        id="minimax-h3",
        repository="MiniMaxAI/MiniMax-H3",
        modality="text/image/video/audio to synchronized video and audio",
        license_note="MiniMax H3 Community License Agreement; review the binding terms before download.",
        published_requirement="H3-Base is locally deployable, but the official Context-IR and 2K workflow use hosted services; official serving examples use multiple GPUs.",
        a2i_status="separate_gpu_media_stack",
        a2i_recommendation="Do not add to A2I Core. Consider a separate user-owned GPU media workstation only after license and hardware review.",
        model_card_url="https://huggingface.co/MiniMaxAI/MiniMax-H3",
    ),
    CommunityAsset(
        id="qwen3-8-2-4t-a95b",
        repository="Qwen/Qwen3.8-2.4T-A95B",
        modality="text-only MoE reasoning and agent model",
        license_note="Qwen3.8-Max license as labelled on the model card; review terms before use.",
        published_requirement="2.4T total parameters and 95B activated; published integrations target specialist serving engines such as vLLM and SGLang.",
        a2i_status="future_multi_gpu_cluster",
        a2i_recommendation="Keep as an architecture reference and future multi-GPU candidate. It cannot run on the laptop or the current llama.cpp GGUF tier.",
        model_card_url="https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B",
    ),
    CommunityAsset(
        id="ltx-2-5",
        repository="Lightricks/LTX-2.5",
        modality="video and synchronized audio generation",
        license_note="LTX-2.x Community License Agreement; gated access requires explicit user acceptance.",
        published_requirement="A 22B video transformer plus a 12B text encoder and VAE components; the official local stack requires CUDA/PyTorch or ComfyUI.",
        a2i_status="separate_gpu_media_stack",
        a2i_recommendation="Do not add to A2I Core or the laptop catalog. Treat as a separate GPU media pipeline after explicit license acceptance.",
        model_card_url="https://huggingface.co/Lightricks/LTX-2.5",
    ),
)


def research_assets_payload() -> dict[str, object]:
    """Return model-card metadata only; no file URLs, tokens, or API details."""
    return {
        "object": "a2i.community_asset_registry",
        "mode": "local-only",
        "download_policy": "metadata_only_until_user_owned_hardware_and_license_review",
        "assets": [asdict(asset) for asset in FRONTIER_ASSETS],
    }
