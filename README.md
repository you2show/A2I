# A2I — Unified AI Platform

A2I brings together several powerful open-source AI projects into a single
monorepo, forming one integrated platform that covers the full stack of
building, running, and using AI applications — from models and SDKs to
visual builders, chat interfaces, and coding agents.

## Components

| Directory | Project | Role in A2I |
| --------- | ------- | ----------- |
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

## Run it fully offline — no external AI APIs

`a2i-core/` makes the whole platform self-sufficient: it serves open-weight
models locally through an OpenAI-compatible endpoint
(`http://127.0.0.1:8990/v1`), which Dify, Flowise, Vane, and the AI SDK can
all use as their model provider. See [`a2i-core/README.md`](a2i-core/README.md).

```bash
cd a2i-core
./download-model.sh   # one-time download of open model weights
./run.sh              # chat at http://127.0.0.1:8990
```

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
