# A2I Core — Your Own AI, 100% Local

A2I Core ជា AI ផ្ទាល់ខ្លួន **local-only** របស់អ្នក។ វាដំណើរការ model និង
RAG លើម៉ាស៊ីនរបស់អ្នក ហើយមិនប្រើ cloud inference provider ឬ API key ទេ។
Network ត្រូវបានប្រើតែពេលអ្នកជ្រើសទាញយក GGUF model ម្តងពីប្រភពដែលបានពិនិត្យ;
បន្ទាប់មកការជជែក និង knowledge retrieval រត់ក្រៅបណ្ដាញលើ SSD និង RAM របស់អ្នក។

A2I Core is a self-hosted AI engine. It runs an open-weight GGUF language model
locally with [llama.cpp](https://github.com/ggerganov/llama.cpp) and exposes a
local OpenAI-compatible interface only to software on your own machine.

## Quick start — one command

**macOS / Linux / WSL:**

```bash
cd a2i-core
./run.sh
```

**Windows:** double-click `start.bat` (or run it in a terminal).

That single command sets up Python, downloads the recommended Qwen 3B Q4_K_M
model on first run, starts the local server, and opens
<http://127.0.0.1:8990> after Core is ready. Keep the launcher window open
while using A2I.

If the page cannot be reached, read the message left in the launcher window. It
reports missing Python, a failed package/model download, a port `8990` conflict,
or a model-load error instead of closing immediately. If another process already
uses port `8990`, close that process and run `start.bat` again.

### Why this is the reliable, guaranteed path

In-browser AI (WebGPU / WebAssembly) depends on features a given browser may
not support — some devices load a model but then abort mid-generation. A2I
Core sidesteps all of that: it runs the model on **native llama.cpp** on your
own machine, so it works the same everywhere, needs no GPU, and never calls an
external API. Point the A2I web app at it (add a brain → `http://127.0.0.1:8990`)
or just use the built-in chat UI at that address. For the futuristic **3D
voice assistant**, open <http://127.0.0.1:8990/live> and talk to it directly.

Use the **Local model library** in the A2I web Settings to inspect each reviewed GGUF asset. The library checks your SSD first: a model already stored in `models/library/` can be selected for the next Core restart without another download. A missing model shows **Download once** only after you review its source, model card, disk/RAM tier, and licence reminder. Downloads are stored in your own library; A2I then uses the selected GGUF through Core without cloud inference.

The command-line workflow remains available:

```bash
./download-model.sh list
./download-model.sh qwen-3b     # recommended default for a 12 GB PC
./download-model.sh activate qwen-3b
```

After selecting a different model in the web library, close and start A2I Core again. The next startup links the selected file into `models/model.gguf` when possible, so it does not duplicate a multi-GB model.

| Command | Local model | Suitability for this PC |
| ------- | ----------- | ----------------------- |
| `./download-model.sh qwen-1.5b` | Qwen2.5 1.5B Q4_K_M | Fast fallback. |
| `./download-model.sh qwen-3b` | Qwen2.5 3B Q4_K_M | **Recommended default**. |
| `./download-model.sh qwen-7b` | Qwen2.5 7B Q4_K_M | Slower quality mode; the official asset has two parts that A2I joins locally. |
| `./download-model.sh qwen-coder-7b` | Qwen2.5 Coder 7B Q4_K_M | Local code explanation and repository Q&A. |
| `./download-model.sh sea-lion-7b` | SEA-LION 7B Q4_0 | Khmer/ASEAN experiment; slower CPU mode. |

Before every download, A2I displays its source, model card, and license reminder
and asks for confirmation. It accepts only a large file with the GGUF magic
bytes, records a local SHA-256 receipt, and never executes scripts or installer
files from a model repository. You may import another GGUF manually, but you
must review its publisher, license, model card, and checksum yourself.

## Local-only boundary

A2I Core has no cloud provider router. The `/v1/providers` and `/v1/router/plan`
endpoints do not exist, no provider configuration file is loaded, and the Web
client accepts only `127.0.0.1:8990` or `localhost:8990` as its Core endpoint.
The default browser origin policy also permits only local origins. Do not expose
Core directly to the public internet.

## Tool permissions — disabled by default

A model may propose an action, but it cannot automatically gain permission to
edit files, run commands, send messages, import data, or schedule jobs. Copy
`tools.example.json` to `tools.json` and enable only capabilities you want to
make available on this machine. High-impact tools still require an explicit
per-request acknowledgement (`a2i_approval: true`) and a concise scope.

```bash
cp tools.example.json tools.json
curl http://127.0.0.1:8990/v1/tools
curl -X POST http://127.0.0.1:8990/v1/tools/plan \
  -H 'Content-Type: application/json' \
  -d '{"tool":"coding_agent","scope":"Review only this repository"}'
```

Write-capable tools remain disabled by default. Keep their workspace and
command boundary isolated from your personal files, and review any proposed
change before enabling it locally.

## Review-first local coding agent

In A2I Web, open **Project**, load a small group of source files, and use
**Review plan** before requesting edits. The agent only receives the files you
load into that panel. It returns proposals for download and never writes to
your project folder. To request an edit proposal, you must enable
`coding_agent` in `tools.json` and confirm the review-first checkbox in the
Project panel. The Core still requires both `a2i_approval: true` and a scope on
every edit request.

## Answer questions from your own documents (local RAG)

Point A2I Core at a folder of documents and it grounds its answers in them —
retrieval is computed locally with BM25, no embedding API:

```bash
./run.sh --knowledge-dir ~/my-documents
curl http://127.0.0.1:8990/v1/knowledge
```

The knowledge endpoint returns only local index metadata—document names and
chunk counts—not document text. A2I Web displays the same status in Settings.

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

The local model, knowledge base, and browser chat run entirely on your
hardware. Network activity is limited to a one-time user-approved GGUF download
from the model publisher; inference and local RAG do not require an API.
