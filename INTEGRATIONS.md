# A2I — ភ្ជាប់ឧបករណ៍ AI សរសេរកូដ · Coding-tool integrations

A2I Core speaks the **OpenAI-compatible API**, so the open-source coding
tools in this org can all use it as their brain — running open models
**100% locally, with no external AI API**.

Start A2I Core first (a coding model is a good default):

```bash
cd a2i-core
A2I_MODEL=qwen-coder-7b ./run.sh      # or: ./download-model.sh list
```

It serves:

| Endpoint | Used by |
| -------- | ------- |
| `POST /v1/chat/completions` | chat + agents (Aider, OpenHands, PR-Agent, Continue, Cline, Tabby chat) |
| `POST /v1/completions` | code completion / fill-in-the-middle (Tabby completion) |
| `GET /v1/models` | model discovery |

### Repo-level completion (A2I extension)

`POST /v1/completions` also accepts optional `repo_name` and `files`, so a
client can supply cross-file context. A2I Core ranks those files by relevance
to the code around the cursor (see `repomap.py`) and builds the Qwen
repo-level FIM prompt, keeping the most useful ones within the budget:

```jsonc
{
  "prompt": "cfg = parse_config_file(",   // text before the cursor
  "suffix": ")\n",                         // text after the cursor
  "repo_name": "my-project",
  "files": [{ "name": "config.py", "content": "def parse_config_file(p): ..." }]
}
```

Plain clients that send only `prompt`/`suffix` are unaffected.

### Agent endpoints (A2I extension)

The agent's capabilities are also reachable over HTTP, so a browser client —
which has no filesystem and is blocked by CORS — can use them. The caller
supplies the files, and edits come back as data rather than being written,
keeping the destructive step on the client where the user can see it.

| Endpoint | Body | Returns |
| -------- | ---- | ------- |
| `POST /v1/agent/ask` | `question`, `files` | `answer` |
| `POST /v1/agent/edit` | `task`, `files`, optional `architect`, `rounds` | changed `files`, `applied`, `failed`, `plan` |
| `POST /v1/repomap` | `files`, optional `query`, `focus_files` | ranked `map` |
| `POST /v1/browse` | `url` or `urls` | `pages` as text |

Base URL: **`http://127.0.0.1:8990/v1`** — any non-empty API key string works.

---

## A2I's own coding agent (`a2i-core/agent.py`)

A2I Core ships a small agent that edits files for you, using whichever
OpenAI-compatible backend you point it at:

```bash
cd a2i-core
python3 agent.py "fix the off-by-one in add()" --dir ../my-project   # dry run
python3 agent.py "fix the off-by-one in add()" --dir ../my-project --write
```

It ranks the repository with `repomap.py` so the model sees the relevant
code, asks for `SEARCH/REPLACE` edits, applies them through `editblock.py`'s
fallback cascade, and retries whatever fails — showing the model the real
surrounding text. **Nothing is written without `--write`.**

Verify the change and commit it:

```bash
python3 agent.py "make the failing test pass" --dir ../my-project \
    --write --test "pytest -q" --commit
```

With `--test`, the command runs after the edits land and any failure output
is fed back so the model can fix its own change; `--commit` git-commits the
changed files. Both need `--write`, since a test command can only see files
that are actually on disk.

Ask about the code instead of changing it:

```bash
python3 agent.py "how does the knowledge base rank results?" --dir . --ask
```

`--ask` uses the same ranked context, read-only — nothing is edited.

Plan first, then edit (aider's architect mode):

```bash
python3 agent.py "add caching to the model loader" --dir ../my-project --architect
python3 agent.py "…" --dir ../my-project --architect qwen2.5-72b   # plan with a bigger model
```

One model describes the change, the other turns it into edits — reasoning
and editing are different skills. If planning fails the agent just edits
directly.

Read web pages mentioned in the task:

```bash
python3 agent.py "port this to match https://peps.python.org/pep-0008/" \
    --dir ../my-project --read-urls
```

`--read-urls` fetches any http(s) links and includes their text — the
useful half of OpenHands' browsing without a headless browser. It does not
run JavaScript, so it suits articles and docs rather than web apps, and it
refuses private/loopback addresses so a page cannot steer the agent into
your internal network.

Use `--url`/`--model`/`--api-key` to target vLLM, Ollama, or a hosted
provider instead of the default `http://127.0.0.1:8990/v1`.


## OpenCode - terminal coding agent + the Zen free-model gateway

[OpenCode](https://github.com/anomalyco/opencode) is a terminal coding
agent (the tool you may already know as the one that provides the free Zen
models). It gives A2I two things:

1. **A strong local coding agent** - opencode serve starts a headless
   HTTP server (session / message / agent / file / pty / mcp endpoints with
   an OpenAPI spec). Any client - including the A2I web app - can drive
   it to read, write, and edit code, run commands, search the web, and use
   MCP tools from the browser. Point it at A2I Core
   (`http://127.0.0.1:8990/v1`) to keep everything on your machine.
2. **The Zen free-model gateway** - OpenCode's hosted Zen API
   (`https://opencode.ai/zen/v1`) serves free models such as Big Pickle,
   DeepSeek V4 Flash Free, MiMo V2.5 Free, Nemotron 3 Ultra Free (see
   `MODELS.md`). A2I Core reads the Zen key automatically from OpenCode's
   `auth.json` (written by `opencode auth login`), so once you log in
   to OpenCode, A2I Core can also answer with those models - no second
   key needed. `GET /v1/models` on A2I Core lists them alongside the
   local model, and requesting any Zen model id routes the chat through
   the Zen bridge (`zen.py`).

### Enable it

`ash
# 1. Install opencode, log in to Zen (free, no credit card)
opencode auth login --provider zen

# 2. Start A2I Core - it auto-reads the Zen key from opencode's auth.json
cd a2i-core && python server.py

# 3. Ask for a Zen model through the OpenAI-compatible API
curl http://127.0.0.1:8990/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model": "big-pickle", "messages": [{"role": "user", "content": "hi"}]}'

# Or use opencode as the agent, powered by A2I Core locally
opencode --provider custom --base-url http://127.0.0.1:8990/v1
`

The Zen key can also be set explicitly with `A2I_ZEN_KEY` (or reused by
the A2I Cloud Vercel proxy via `A2I_API_KEY`). Zen free tier:
100 requests/day, up to 128K context.

### OpenCode server bridge — drive the real agent from the chat UI

`opencode serve` (default `http://127.0.0.1:4096`) exposes the full
agent: sessions, prompts, file edits, shell, web, MCP. A2I Core tunnels
OpenAI-style chat requests into it: any model id prefixed `oc/` runs a
real agent loop on the local server instead of a local completion, so the
chat UI (and any OpenAI-compatible client) gets OpenCode's coding agent
as a "brain". `GET /v1/models` lists the server's models as `oc/<id>`.

```bash
# 1. Start the OpenCode server (agent loop; 127.0.0.1 only)
opencode serve                                   # port 4096 by default
# optional password: OPENCODE_SERVER_PASSWORD=... opencode serve

# 2. A2I Core bridges oc/* models to it automatically (no extra config)
cd a2i-core && python server.py

# 3. Ask through the OpenAI-compatible API
curl http://127.0.0.1:8990/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model": "oc/big-pickle", "messages": [{"role": "user", "content": "hello"}]}'
```

In the a2i-web settings panel press **Opencode Server (local)** to point
the chat at A2I Core with an `oc/` model, or **↻ OC models** to list the
server's models. When `opencode serve` is password-protected, set
`A2I_OPENCODE_PASSWORD` (or reuse `OPENCODE_SERVER_PASSWORD`; username
defaults to `opencode`, override with `A2I_OPENCODE_USERNAME`). Point the
server elsewhere with `A2I_OPENCODE_URL`. To call `opencode serve` from a
browser directly (instead of through A2I Core), add its origin with
`--cors http://localhost:<a2i-port>`.
## Aider — AI pair programmer in the terminal

[`you2show/aider`](https://github.com/you2show/aider). Aider sets
`OPENAI_API_BASE` from `--openai-api-base` (see `aider/main.py`):

```bash
python -m aider \
  --openai-api-base http://127.0.0.1:8990/v1 \
  --openai-api-key a2i \
  --model openai/qwen2.5-coder-7b-instruct-q4_k_m
```

## OpenHands — autonomous AI software engineer

[`you2show/openhands`](https://github.com/you2show/openhands). Point its LLM
config at A2I Core (`config.toml`, `[llm]` section):

```toml
[llm]
model = "openai/qwen2.5-coder-7b-instruct-q4_k_m"
base_url = "http://127.0.0.1:8990/v1"
api_key = "a2i"
```

## Tabby — self-hosted Copilot server

[`you2show/tabby`](https://github.com/you2show/tabby). Tabby needs both a
chat model and a completion model — A2I Core now serves both:

```toml title="~/.tabby/config.toml"
[model.chat.http]
kind = "openai/chat"
model_name = "a2i"
api_endpoint = "http://127.0.0.1:8990/v1"
api_key = ""

[model.completion.http]
kind = "openai/completion"
model_name = "a2i"
api_endpoint = "http://127.0.0.1:8990/v1"
api_key = ""
# Match the template to your model. Qwen2.5-Coder uses:
prompt_template = "<|fim_prefix|>{prefix}<|fim_suffix|>{suffix}<|fim_middle|>"
```

## PR-Agent — AI code review on pull requests

[`you2show/pr-agent`](https://github.com/you2show/pr-agent). In
`.secrets.toml` / env, use the OpenAI-compatible settings:

```toml
[openai]
key = "a2i"
api_base = "http://127.0.0.1:8990/v1"

[config]
model = "openai/qwen2.5-coder-7b-instruct-q4_k_m"
```

## Continue / Cline — VS Code assistants

Add an OpenAI-compatible provider with
`apiBase: http://127.0.0.1:8990/v1` and any `apiKey`.

## vLLM — the fastest local backend (needs a GPU)

[`you2show/vllm`](https://github.com/you2show/vllm) serves the *same* API as
A2I Core (`/v1/chat/completions` + `/v1/completions`, port 8000), so every
tool above works unchanged — just point it at vLLM instead:

```bash
vllm serve Qwen/Qwen2.5-Coder-7B-Instruct     # → http://127.0.0.1:8000/v1
```

In the web app: **⚙️ Settings → AI providers → 🚀 vLLM**.
Use A2I Core when you want it to run anywhere; use vLLM when you have a GPU
and want large models fast. Both are fully local — no external API.

### vLLM ties the whole toolkit together

vLLM speaks the OpenAI-compatible API (plus Anthropic Messages + gRPC) and
accepts almost every weight format A2I produces or references, so one backend
covers all of the model work in this repo:

- **The fine-tuned SEA-LION adapter — no merge needed.** vLLM serves LoRA
  adapters directly, so the output of
  [`a2i-train/khmer_sealion_finetune.ipynb`](a2i-train/khmer_sealion_finetune.ipynb)
  is usable as-is — you can skip the awkward "reload base in fp16 → merge →
  GGUF" step that overflows free-tier RAM:

  ```bash
  vllm serve you2show/Llama-SEA-LION-v3-8B-IT-bucket \
      --enable-lora --lora-modules khmer=./sealion-khmer-lora
  # then request model "khmer"
  ```

- **GGUF** — the same big single-file quants A2I Core runs (e.g. the DavidAU
  27B) also load in vLLM: `vllm serve ./model.gguf`.
- **compressed-tensors / MXFP4** — the format Kimi-K3 ships in (see below).
- Runs on **NVIDIA/AMD GPUs and x86/ARM/PowerPC CPUs**, so it is not strictly
  GPU-only when you just need compatibility.

Whichever you serve, add its `http://HOST:8000/v1` in **⚙️ Settings → AI
providers** and A2I uses it like any other brain.

## Models — Qwen3-Coder, WizardLM, transformers

- [`you2show/qwen3-coder`](https://github.com/you2show/qwen3-coder) and
  [`you2show/wizardlm`](https://github.com/you2show/wizardlm) document the
  model families. To serve one from A2I Core, drop a GGUF build at
  `a2i-core/models/model.gguf` (or `./run.sh --model /path/to.gguf`).
- [`you2show/transformers`](https://github.com/you2show/transformers) is the
  library for running/fine-tuning the original weights.
- Prefer Ollama? Run it, then add it in the A2I web app:
  **⚙️ Settings → AI providers → `http://127.0.0.1:11434/v1`**.

### Frontier models too big to self-host (e.g. Kimi-K3)

Some open-weight models are simply too large for any single machine —
`you2show/Kimi-K3`, for instance, is a **2.8T-parameter MoE** (104B active,
multimodal, `compressed-tensors`/MXFP4). It is served by **vLLM** or **SGLang**,
not llama.cpp/GGUF, and needs a large multi-GPU host — not Colab, not a laptop.

Two realistic ways to use it from A2I, both OpenAI-compatible:

- **Self-host on a big GPU server** with [`you2show/vllm`](https://github.com/you2show/vllm)
  (`vllm serve moonshotai/Kimi-K3` — see the model's vLLM recipe), then add that
  endpoint in **⚙️ Settings → AI providers**. Fully local, but the hardware is
  substantial.
- **Hosted API** at `https://platform.kimi.ai` (model `kimi-k3`), which exposes
  an OpenAI-compatible endpoint — add it like any other provider. This is an
  external API, so it falls outside A2I's "no external API" default; use it only
  when you accept that trade-off.

Note: Kimi-K3 always returns `reasoning_content` and expects the full assistant
message (reasoning + tool_calls) echoed back on multi-turn calls — a client
detail to preserve if you wire it in directly.

### Run a big GGUF on a free Colab GPU → use it in A2I

No GPU at home but want a famous 20–30B model (e.g.
`DavidAU/Qwen3.6-27B-Fable-Fusion-…-GGUF`)? Open
[`a2i-core/serve_gguf_colab.ipynb`](a2i-core/serve_gguf_colab.ipynb) in Colab.
It serves any GGUF over the OpenAI-compatible API on Colab's GPU and exposes a
public URL, so you can add it in **⚙️ Settings → AI providers** and chat with
it from A2I web — no local hardware, no paid API. A 27B IQ4 (~17 GB) runs on a
free T4 with CPU+GPU split, or fully on GPU with Colab Pro's A100.

---

## Media generation — image, voice/audio (and the local model path)

A2I can create media, not just text. Two paths, matching A2I's usual split
between *works everywhere with no setup* and *runs fully local*.

### In the web app (keyless, no install)

- **🎨 Image** — toggle the star button in the composer, or type
  `/image a red bicycle` / `/imagine …`. Generates a 1024×1024 image you can
  open or save. No API key.
- **🎵 Audio / voice** — toggle the audio button, or type `/audio …`,
  `/speak …`, `/voice …`. Generates a real, downloadable audio file (spoken
  from your text), distinct from the ephemeral browser read-aloud.

Both use free, keyless services and need only a network connection — nothing
to install, consistent with A2I's in-browser story.

### Locally with `transformers` (no external service)

[`you2show/transformers`](https://github.com/you2show/transformers) ships the
pipelines for the media tasks, so you can run them entirely offline once the
weights are downloaded:

```python
from transformers import pipeline

# Text -> speech / music (e.g. Bark, MusicGen)
tts = pipeline("text-to-audio", model="suno/bark-small")
audio = tts("Hello from A2I")            # audio["audio"], audio["sampling_rate"]

# Speech -> text (also served over HTTP, see below)
asr = pipeline("automatic-speech-recognition", model="openai/whisper-base")
text = asr("clip.wav")["text"]
```

For **image generation** the models live in the companion `diffusers`
library (Stable Diffusion / SDXL), which shares the same weights ecosystem:

```python
from diffusers import StableDiffusionPipeline
pipe = StableDiffusionPipeline.from_pretrained("stabilityai/stable-diffusion-2-1")
pipe("a red bicycle").images[0].save("out.png")
```

### Speech-to-text over HTTP

`transformers serve` exposes an OpenAI-compatible **`POST /v1/audio/transcriptions`**
endpoint (alongside `/v1/chat/completions`, `/v1/completions`, `/v1/responses`,
`/v1/models`), so A2I's voice input can be backed by a local Whisper model
instead of the browser recognizer:

```bash
transformers serve                       # → http://127.0.0.1:8000/v1
curl http://127.0.0.1:8000/v1/audio/transcriptions \
  -F model=openai/whisper-base -F file=@clip.wav
```

> Note: `transformers serve` serves chat, completions and transcription over
> HTTP; image and text-to-audio *generation* run through the Python pipelines
> above rather than an HTTP route. The web app covers the keyless HTTP case.

---

## Use them from the A2I web app

Any of the servers above can be added as a brain in
**⚙️ Settings → AI providers**, and the **🔄 Auto** engine will fall back
between them automatically.

