# A2I — All-in-One AI

A2I ប្រមូលខួរក្បាល AI ច្រើនចូលគ្នាជាកន្លែងតែមួយ — an all-in-one AI that
gathers many AI brains into one platform: in-browser models, self-hosted
models, and any OpenAI-compatible endpoint, with a mode that asks all
brains together and combines their answers into one.

This monorepo contains everything: the web app (`a2i-web/`), the
self-hosted engine (`a2i-core/`), and the full stack of open-source AI
projects that power and extend the platform — from models and SDKs to
visual builders, chat interfaces, and coding agents.

## Components

| Directory | Project | Role in A2I |
| --------- | ------- | ----------- |
| [`a2i-web/`](a2i-web/) | **A2I Web** | The all-in-one AI app (deployed on Vercel): chat with in-browser models (WebGPU, no server), your A2I Core, Ollama/LM Studio, or any OpenAI-compatible brain — including a 🧩 mode that asks every brain at once and combines their answers. |
| [`a2i-core/`](a2i-core/) | **A2I Core** | The platform's own brain: a self-hosted AI server that runs open-weight models 100% locally (llama.cpp) with an OpenAI-compatible API, built-in chat UI, and local document retrieval — no external AI APIs needed. |
| [`dify/`](dify/) | Dify | LLM application platform: agentic workflows, RAG pipelines, model management, and app orchestration with a web UI and Flask API backend. |
| [`flowise/`](flowise/) | Flowise | Visual drag-and-drop builder for LLM flows and agents (Node.js/TypeScript). |
| [`vane/`](vane/) | Vane | Next.js chat interface for talking to AI models. |
| [`glm-5/`](glm-5/) | GLM-5 | Resources, examples, and skills for the GLM-5 large language model. |
| [`ai-sdk/`](ai-sdk/) | Vercel AI SDK | TypeScript SDK providing a unified interface to many AI providers (OpenAI, Anthropic, Google, and more) for text generation, streaming, structured output, embeddings, and tools. |
| [`sweep/`](sweep/) | Sweep | AI coding assistant that turns issues into pull requests. |

## How the pieces fit together

```
                        ┌─────────────────────────────┐
                        │          Users              │
                        └──────────────┬──────────────┘
               ┌───────────────────────┼───────────────────────┐
               ▼                       ▼                       ▼
        ┌────────────┐          ┌────────────┐          ┌────────────┐
        │   vane/    │          │   dify/    │          │  flowise/  │
        │  chat UI   │          │  app + RAG │          │ visual     │
        │            │          │  platform  │          │ agent      │
        └─────┬──────┘          └─────┬──────┘          │ builder    │
              │                       │                 └─────┬──────┘
              ▼                       ▼                       │
        ┌────────────────────────────────────────┐            │
        │              ai-sdk/                   │◀───────────┘
        │  unified provider layer (OpenAI,       │
        │  Anthropic, Google, GLM, local, …)     │
        └─────────────────┬──────────────────────┘
                          ▼
        ┌────────────────────────────────────────┐
        │   Models (incl. glm-5/ resources)      │
        └────────────────────────────────────────┘

        sweep/ — AI coding agent that helps develop A2I itself
```

- **Answering questions & knowledge**: `dify/` provides RAG pipelines so the
  platform can ground answers in your own documents and knowledge bases.
- **Multi-provider intelligence**: `ai-sdk/` lets any component call the best
  available model for a task through one consistent API.
- **Agent building**: `flowise/` and Dify's agent capabilities let you compose
  tools, retrieval, and reasoning into agents without writing code.
- **User experience**: `vane/` offers a polished chat front end.
- **Model resources**: `glm-5/` documents and demonstrates the GLM-5 model.
- **Self-improvement**: `sweep/` can act on issues in this repo to keep the
  platform evolving.

## Famous, powerful AI models — with no external AI API

> 👉 **[MODELS.md](MODELS.md)** lists **every** model option — size and the
> device that runs each — from a phone to a free cloud GPU. A2I is free-first,
> but you can bring any model you like.

A2I runs well-known open-weight models (Qwen2.5, Llama 3.1/3.2, Gemma 2,
Mistral, Phi) with **no external inference API**. There are two independent
ways to do it, and either one alone is enough:

| Path | Runs where | Models | Needs a server? |
| ---- | ---------- | ------ | --------------- |
| **In-browser** | the user's own browser (WebGPU, CPU fallback) | up to Llama 3.1 8B / Qwen2.5 7B / Gemma 2 9B | no — open the page and chat |
| **A2I Core** | the user's own machine (`a2i-core`, llama.cpp) | the same models, plus bigger ones (Llama 70B, Qwen 72B) | yes — a local self-hosted server |

In both paths the model weights are downloaded **once** (from the open model
hub) and every inference request after that stays on your device. The only
piece that talks to an outside service is the *optional* **A2I Cloud** proxy
(`api/chat.js`), which is off by default and only appears when you deliberately
configure a provider — the famous-model, no-API guarantee above never depends
on it.

Reliability is built in: the in-browser engine automatically falls back from
GPU → CPU so any device gets an answer, and A2I Core verifies every model
download is a valid GGUF file so a dropped connection can't leave you stuck.

### In-browser (zero setup)

Open [`a2i-web/`](a2i-web/) (or the deployed page) and pick a model from the
**engine → In-browser AI** menu. A strong GPU can run the "Powerful" group
(7–9B). No server, no API, no account.

### A2I Core (self-hosted, most powerful)

`a2i-core/` serves open-weight models locally through an OpenAI-compatible
endpoint (`http://127.0.0.1:8990/v1`), which Dify, Flowise, Vane, and the AI
SDK can all use as their model provider. See
[`a2i-core/README.md`](a2i-core/README.md).

```bash
cd a2i-core
./download-model.sh list        # see every available famous open model
./download-model.sh llama-3.1-8b # one-time download of open model weights
./run.sh                        # chat at http://127.0.0.1:8990
```

## Coding tools — Aider, OpenHands, Tabby, PR-Agent

A2I Core can be the local brain for the open-source coding assistants in this
org: it serves both `/v1/chat/completions` (chat + agents) and
`/v1/completions` (code completion / fill-in-the-middle). Verified setup for
each tool is in **[`INTEGRATIONS.md`](INTEGRATIONS.md)**.

## Getting started

Each component keeps its own build system, documentation, and license — see
the `README.md` inside each directory:

- `dify/README.md` — Docker Compose deployment of the full Dify stack
- `flowise/README.md` — pnpm-based Node.js setup
- `vane/README.md` — Next.js app setup
- `ai-sdk/README.md` — installing and using the AI SDK packages
- `sweep/README.md` — running the Sweep agent
- `glm-5/README.md` — GLM-5 model usage and examples

## Licenses

Each subproject retains its original upstream license (see the `LICENSE` /
`LICENSE.md` file inside each directory). This monorepo does not change or
supersede those licenses.
