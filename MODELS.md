# A2I — Models guide / ជ្រើស model តាមឧបករណ៍

A2I is **free-first**: it works out of the box, and you can also bring **any
model you like** — download an open one, or connect a hosted one. Nothing here
requires a paid AI API.

There is one rule that decides everything: **the model has to fit your
device.** This page lists every option with its **size** and the **device**
that runs it, so you can pick one that actually works.

> Rough sizing (Q4_K_M GGUF): a model needs about **its file size in free RAM**,
> plus ~1–2 GB for the app and context. "≈ size" columns below are the Q4
> download size.

---

## 1. In the browser — nothing to install

A2I runs a model **inside the web page** (WebGPU, or CPU via WebAssembly).
The model downloads **once**, then is cached and works offline. Best for small
models; see §2 to load a bigger one from your own disk.

| Model | ≈ size | Device that runs it |
| ----- | ------ | ------------------- |
| Qwen2.5 **0.5B** | ~1 GB | 📱 any phone / old laptop (2 GB RAM) |
| Qwen2.5 **1.5B** | ~2 GB | 📱 phone / basic laptop (3–4 GB RAM) |
| Qwen2.5 **3B** | ~2 GB | 💻 laptop (4 GB RAM) |

WebGPU (a modern browser + GPU) makes these much faster. Open `check.html` to
see whether your device has the fast path.

## 2. Download a bigger model to your disk / SSD — still no API

Keep a GGUF on your disk (or a big external **SSD**) and point A2I at it:
**⚙️ Settings → Local model file → Choose model (.gguf)**. Reads straight from
the file — **no download, no re-download, offline, unlimited**.

Sizing is by your **RAM** (models run in memory, not from the SSD directly):

| Model | ≈ size | Device (RAM needed) |
| ----- | ------ | ------------------- |
| Qwen2.5 **7B** | ~5 GB | 💻 8 GB laptop |
| Meta **Llama 3.1 8B** | ~5 GB | 💻 8 GB laptop |
| Google **Gemma 2 9B** | ~6 GB | 💻 8 GB laptop (tight) |
| DavidAU **Qwen3.5 9B Fable** (uncensored) | ~6 GB | 💻 8 GB laptop |
| **Ternary Bonsai 27B→4B** (compressed) | ~4 GB | 💻 8 GB laptop |
| Qwen2.5 / Qwen3 **14B** | ~9 GB | 🖥️ 16 GB PC |
| **32–35B** (KAT-Coder, Qwen3-A3B) | ~20 GB | 🖥️ 32 GB PC / GPU |
| DavidAU **Qwen3.6 27B Fable** | ~17 GB | 🖥️ 24 GB+ RAM or GPU (see §3) |

> A 500 GB SSD **stores** any model, but inference speed is bound by **RAM**.
> A model larger than RAM can run by memory-mapping from SSD, but it will be
> very slow — keep the active model within your RAM.

## 3. Free GPU in the cloud — run big models you can't fit locally

No powerful PC? Run a 20–70B model on a **free Colab/Kaggle GPU** and connect
A2I to it. See [`a2i-core/serve_gguf_colab.ipynb`](a2i-core/serve_gguf_colab.ipynb).

| Model | ≈ size | Where |
| ----- | ------ | ----- |
| DavidAU **Qwen3.6 27B** | ~17 GB | Colab T4 (split) / A100 |
| **Solar-Open2 250B**, GLM, Kimi-K3 (2.8T) | 100s of GB–TB | large multi-GPU only |

Free GPU has weekly hour limits and the session ends after a while, so this is
"unlimited while it runs", not 24/7.

## 4. Hosted models — no download at all (free tiers, rate-limited)

Add a provider in **⚙️ Settings → AI providers** and use famous big models
without any local hardware. Free tiers are **rate-limited**, need a free key,
and require internet — but reach models no laptop can run.

| Provider | Famous models | Key |
| -------- | ------------- | --- |
| **Groq** | Llama 3.3 70B (very fast) | console.groq.com/keys |
| **Hugging Face** | any HF model (Llama 4, Qwen3, DeepSeek-R1) | huggingface.co/settings/tokens |
| **OpenRouter** | DeepSeek R1, Llama 70B (`:free`) | openrouter.ai/keys |

For the **newest** model, browse
[huggingface.co/models?sort=trending](https://huggingface.co/models?sort=trending)
and paste its repo id into the model field — A2I is never pinned to one version.

## 5. Your own model — self-hosted, unlimited

- **A2I Core** (any machine): `cd a2i-core && ./download-model.sh <key>` then
  `./run.sh`. Run `./download-model.sh list` for every catalog model.
- **vLLM** (GPU): serves GGUF, LoRA adapters, and compressed-tensors — one
  backend for everything. See [`INTEGRATIONS.md`](INTEGRATIONS.md).

---

## Quick pick by device

| Your device | Best free choice |
| ----------- | ---------------- |
| 📱 Phone / 2–4 GB | Qwen2.5 0.5B–1.5B in the browser |
| 💻 8 GB laptop | **Qwen2.5 7B** or **DavidAU Fable 9B** on disk (§2) |
| 🖥️ 16–32 GB PC | 14–32B on disk |
| 🎮 Gaming GPU | any of the above, much faster (WebGPU / vLLM) |
| ☁️ No good hardware | **Groq / Hugging Face** hosted (§4), or free Colab GPU (§3) |

**Rule of thumb:** biggest model that fits your RAM = best quality you can run
locally and privately. Need bigger? Use a free GPU (cloud) or a hosted API.
