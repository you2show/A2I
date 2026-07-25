# A2I Core — Your Own AI, 100% Local

A2I Core ជា AI ផ្ទាល់ខ្លួនរបស់អ្នក ដែលដំណើរការទាំងស្រុងនៅលើម៉ាស៊ីនរបស់អ្នក —
**គ្មានការហៅ API ខាងក្រៅទាល់តែសោះ**។ ទិន្នន័យរបស់អ្នកមិនចេញពីម៉ាស៊ីនឡើយ។

A2I Core is a self-hosted AI engine. It runs an open-weight language model
locally with [llama.cpp](https://github.com/ggerganov/llama.cpp) — no OpenAI,
no Anthropic, no cloud. Your data never leaves your machine.

## Quick start — one command

**macOS / Linux / WSL:**

```bash
cd a2i-core
./run.sh
```

**Windows:** double-click `start.bat` (or run it in a terminal).

That single command sets up Python, downloads an open model on first run, and
starts the server. Then open <http://127.0.0.1:8990> and chat.

### Why this is the reliable, guaranteed path

In-browser AI (WebGPU / WebAssembly) depends on features a given browser may
not support — some devices load a model but then abort mid-generation. A2I
Core sidesteps all of that: it runs the model on **native llama.cpp** on your
own machine, so it works the same everywhere, needs no GPU, and never calls an
external API. Point the A2I web app at it (add a brain → `http://127.0.0.1:8990`)
or just use the built-in chat UI at that address. For the futuristic **3D
voice assistant**, open <http://127.0.0.1:8990/live> and talk to it directly.

Pick a bigger model any time with `A2I_MODEL` (see `./download-model.sh list`):

```bash
A2I_MODEL=llama-3.1-8b ./run.sh     # Meta Llama 3.1 8B, fully local
```

Models — famous open-weight models that run **100% locally, no external API**.
Run `./download-model.sh list` to see them all; here are the highlights:

| Command | Model | RAM needed | Quality |
| ------- | ----- | ---------- | ------- |
| `./download-model.sh small` | Qwen2.5 0.5B | ~1 GB | basic, any machine |
| `./download-model.sh` | Qwen2.5 1.5B | ~2 GB | good, CPU-friendly |
| `./download-model.sh qwen-3b` | Qwen2.5 3B | ~4 GB | smart |
| `./download-model.sh mistral-7b` | Mistral 7B Instruct | ~6 GB | powerful |
| `./download-model.sh qwen-7b` | Qwen2.5 7B (alias `large`) | ~6 GB | powerful |
| `./download-model.sh qwen-coder-7b` | Qwen2.5 Coder 7B | ~6 GB | great at code |
| `./download-model.sh gemma-2-9b` | Google Gemma 2 9B | ~8 GB | powerful |
| `./download-model.sh llama-3.1-8b` | Meta Llama 3.1 8B | ~7 GB | powerful |

Each download is verified to be a real GGUF file before it is accepted, so a
dropped connection or proxy error page can never leave you with a broken model
— you get a clear "please retry" instead.

Any GGUF model works — even bigger ones like Llama 70B or Qwen 72B: put the
file at `models/model.gguf`, or pass `--model /path/to/model.gguf` to `run.sh`.

## Answer questions from your own documents (local RAG)

Point A2I Core at a folder of documents and it grounds its answers in them —
retrieval is computed locally with BM25, no embedding API:

```bash
./run.sh --knowledge-dir ~/my-documents
```

Readable formats: text and Markdown, source code, **HTML, XML, CSV/TSV,
JSON and .docx** — all parsed with the standard library, so nothing extra to
install. PDF and .xlsx are recognised and reported as needing conversion
first, rather than being skipped silently. Documents are split on structure
(paragraphs, then sentences — including Khmer `។`) instead of at a fixed
width, so a chunk is never cut mid-sentence.

## Use it as the brain of the whole A2I platform

A2I Core speaks the **OpenAI-compatible API** (`/v1/chat/completions`,
`/v1/models`), so every other component in this monorepo can use it as its
model backend and the entire platform stays offline:

- **Dify** (`../dify`): add an OpenAI-compatible model provider with base URL
  `http://127.0.0.1:8990/v1` (any API key string works).
- **Flowise** (`../flowise`): use the ChatOpenAI Custom node with the same
  base URL.
- **Vane** (`../vane`): configure the OpenAI provider endpoint to
  `http://127.0.0.1:8990/v1`.
- **AI SDK** (`../ai-sdk`):

  ```ts
  import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

  const a2i = createOpenAICompatible({
    name: 'a2i',
    baseURL: 'http://127.0.0.1:8990/v1',
  });
  ```

## API example

```bash
curl http://127.0.0.1:8990/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
```

## How it works

```
browser UI ──┐
Dify ────────┤            ┌────────────────┐     ┌──────────────────┐
Flowise ─────┼──► FastAPI │ OpenAI-compat  │ ──► │ llama.cpp +      │
Vane ────────┤            │ /v1/chat/...   │     │ open GGUF model  │
AI SDK ──────┘            └───────┬────────┘     └──────────────────┘
                                  │
                          ┌───────▼────────┐
                          │ local BM25     │
                          │ knowledge base │  (text, code, HTML,
                          └────────────────┘   CSV, JSON, .docx)
```

Everything above runs in one process on your hardware. The only network
activity ever needed is the one-time model download.
