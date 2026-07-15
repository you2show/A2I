# A2I Core — Your Own AI, 100% Local

A2I Core ជា AI ផ្ទាល់ខ្លួនរបស់អ្នក ដែលដំណើរការទាំងស្រុងនៅលើម៉ាស៊ីនរបស់អ្នក —
**គ្មានការហៅ API ខាងក្រៅទាល់តែសោះ**។ ទិន្នន័យរបស់អ្នកមិនចេញពីម៉ាស៊ីនឡើយ។

A2I Core is a self-hosted AI engine. It runs an open-weight language model
locally with [llama.cpp](https://github.com/ggerganov/llama.cpp) — no OpenAI,
no Anthropic, no cloud. Your data never leaves your machine.

## Quick start

```bash
cd a2i-core
./download-model.sh        # one-time download of open model weights
./run.sh                   # start the server (sets up Python env on first run)
```

Then open <http://127.0.0.1:8990> in your browser and chat.

Model sizes:

| Command | Model | RAM needed | Quality |
| ------- | ----- | ---------- | ------- |
| `./download-model.sh small` | Qwen2.5 0.5B | ~1 GB | basic |
| `./download-model.sh` | Qwen2.5 1.5B | ~2 GB | good |
| `./download-model.sh large` | Qwen2.5 7B | ~6 GB | much smarter |

Any GGUF model works — put it at `models/model.gguf` or pass `--model path`.

## Answer questions from your own documents (local RAG)

Point A2I Core at a folder of `.txt` / `.md` files and it grounds its answers
in them — retrieval is computed locally with TF-IDF, no embedding API:

```bash
./run.sh --knowledge-dir ~/my-documents
```

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
                          │ local TF-IDF   │
                          │ knowledge base │  (your .txt/.md files)
                          └────────────────┘
```

Everything above runs in one process on your hardware. The only network
activity ever needed is the one-time model download.
