# Hugging Face model assessment notes

## Sources reviewed

- https://huggingface.co/meta-models/Muse-Glimmer-30B
- https://huggingface.co/MiniMaxAI/MiniMax-H3
- https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B
- https://huggingface.co/Lightricks/LTX-2.5

## Verified findings

| Asset | What the official model card states | Compatibility with the user's 12 GB RAM / 2 GB VRAM Windows laptop |
|---|---|---|
| Muse Glimmer 30B | Apache-2.0; 29.6B multimodal agentic model. Its approximately 17 GB 4-bit K-Quant target still needs a 24 GB or 32 GB memory/VRAM envelope alongside KV cache, vision encoder and drafter. | Cannot run locally on this PC. It is valuable as a future remote workstation / GPU-server A2I agent brain, not a local model tier. |
| MiniMax H3 | MiniMax H3 Community License; 33B dense omni video/audio model. H3-Base checkpoints can be local, but H3-Context-IR and 2K regeneration are hosted/API components. Official full local examples use multiple GPU serving for the complete workflow. | Cannot run locally; complete official workflow violates A2I local-only due to hosted components. Treat as a future external GPU / separated media workstation candidate only after license review. |
| Qwen3.8-2.4T-A95B | 2.4T total parameter MoE, 95B activated; Transformers/vLLM/SGLang deployment. Native context 262K, text only, thinking required. | Not suitable for this PC or the existing llama.cpp GGUF local runtime. It requires a multi-GPU server / specialist deployment. Use its model card and agent patterns as reference, not its weights. |
| LTX-2.5 | Gated access / LTX-2.x Community License; 22B video generation DiT plus Gemma 4 12B encoder and video/audio VAE components. Local execution via CUDA/PyTorch or ComfyUI, with low-VRAM CPU offload options. | Cannot run productively on 2 GB VRAM; no direct local A2I integration. It is a future separate GPU media-service option; never treat it as an A2I language model. |

## Important architectural conclusion

Hugging Face is a distribution and hosting platform. Downloading weights stores a local copy on the user's SSD and can be fully local after download; executing a Space, Inference Provider, or hosted endpoint is remote inference and conflicts with A2I's local-only policy. Large model files on Hugging Face cannot be executed merely by referencing Hugging Face storage without a remote service/API or sufficient local/remote hardware.

## Recommended immediate A2I action

Continue using official/curated GGUF models that fit the laptop (Qwen 3B as default; Qwen 7B as slower quality mode). Add only model metadata entries for the above frontier models, marked `future_gpu_required`, rather than allowing their download on this device.

## Citations

1. Meta, Muse Glimmer 30B model card, accessed 2026-08-14.
2. MiniMaxAI, MiniMax H3 model card, accessed 2026-08-14.
3. Qwen, Qwen3.8-2.4T-A95B model card, accessed 2026-08-14.
4. Lightricks, LTX-2.5 model card, accessed 2026-08-14.

## Browser verification details

The browser confirms that Muse Glimmer is tagged Apache-2.0 and presents local integrations including llama.cpp, LM Studio, Jan and Ollama, but its own published 4-bit target is a 24 GB/32 GB envelope. MiniMax H3 is tagged under the MiniMax H3 Community License Agreement and has a 33B model-size badge; its official card calls H3-Context-IR hosted and API-only. Qwen3.8 is tagged with a Qwen3.8-Max license and lists 2.4T parameters/95B activated in its official overview. LTX-2.5 is gated: access requires login and agreement to share contact information, and the card labels the repository under the LTX-2 Community License Agreement.

These findings rule out automatic download or direct inclusion in A2I's 12 GB RAM / 2 GB VRAM local catalog. Any future use must either run on hardware owned or controlled by the user with sufficient GPU memory, or be deliberately reclassified as a remote service, which is outside the current local-only policy.
