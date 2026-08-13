"""Hardware-aware local model recommendations for A2I Core.

The catalogue deliberately describes operating tiers rather than promising that a
large model will be fast on every computer.  Storage is not used as a proxy for
inference capacity: the active model and its context cache need system memory.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ModelProfile:
    """One A2I operating tier and the model used to start it."""

    id: str
    label: str
    model_key: str
    model_name: str
    purpose: str
    min_ram_gb: int
    recommended_ram_gb: int
    approx_model_ram_gb: int
    notes: str = ""

    def public(self, available_ram_gb: float | None = None) -> dict[str, object]:
        """Return a JSON-safe representation with an optional suitability flag."""

        data = asdict(self)
        if available_ram_gb is not None:
            data["suitable"] = available_ram_gb >= self.min_ram_gb
            data["recommended"] = available_ram_gb >= self.recommended_ram_gb
        return data


PROFILES: tuple[ModelProfile, ...] = (
    ModelProfile(
        id="fast-local",
        label="Fast local",
        model_key="qwen-1.5b",
        model_name="Qwen2.5 1.5B Instruct (Q4_K_M)",
        purpose="Private everyday chat, short summaries, and simple document questions.",
        min_ram_gb=4,
        recommended_ram_gb=6,
        approx_model_ram_gb=2,
        notes="Best low-resource fallback. It remains fully local after the one-time model download.",
    ),
    ModelProfile(
        id="balanced-local",
        label="Balanced local",
        model_key="qwen-3b",
        model_name="Qwen2.5 3B Instruct (Q4_K_M)",
        purpose="Default personal assistant for Khmer/English chat and local knowledge retrieval.",
        min_ram_gb=7,
        recommended_ram_gb=10,
        approx_model_ram_gb=4,
        notes="Recommended default for a 12 GB Windows PC. Keep the context window modest for responsive CPU use.",
    ),
    ModelProfile(
        id="quality-local",
        label="Quality local",
        model_key="qwen-7b",
        model_name="Qwen2.5 7B Instruct (Q4_K_M)",
        purpose="Better writing and reasoning when a slower local response is acceptable.",
        min_ram_gb=10,
        recommended_ram_gb=16,
        approx_model_ram_gb=6,
        notes="On 12 GB RAM this is a CPU quality mode: close other applications and expect slower generation.",
    ),
    ModelProfile(
        id="coder-local",
        label="Local coder",
        model_key="qwen-coder-7b",
        model_name="Qwen2.5 Coder 7B Instruct (Q4_K_M)",
        purpose="Code explanation, repository Q&A, and controlled edit plans.",
        min_ram_gb=10,
        recommended_ram_gb=16,
        approx_model_ram_gb=6,
        notes="Use through the A2I coding-agent flow. Never enable write or commit operations without review.",
    ),
    ModelProfile(
        id="khmer-local",
        label="Khmer / ASEAN local",
        model_key="sea-lion-7b",
        model_name="SEA-LION 7B Instruct (Q4_0)",
        purpose="Khmer and ASEAN-language experiments, local writing, and document questions.",
        min_ram_gb=10,
        recommended_ram_gb=16,
        approx_model_ram_gb=6,
        notes="Optional quality mode on 12 GB RAM. It is a community-published GGUF model, so A2I keeps it offline and requires the user to review the source and license before download.",
    ),
)


def model_profiles(available_ram_gb: float | None = None) -> list[dict[str, object]]:
    """List A2I model tiers with optional suitability for the supplied RAM."""

    return [profile.public(available_ram_gb) for profile in PROFILES]


def recommend_profile(available_ram_gb: float | None = None) -> ModelProfile:
    """Choose the safest useful local default for a machine's system RAM."""

    ram = available_ram_gb if available_ram_gb is not None else 0
    if ram >= 7:
        return next(profile for profile in PROFILES if profile.id == "balanced-local")
    return next(profile for profile in PROFILES if profile.id == "fast-local")
