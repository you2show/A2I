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

Base URL: **`http://127.0.0.1:8990/v1`** — any non-empty API key string works.

---

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

## Models — Qwen3-Coder, WizardLM, transformers

- [`you2show/qwen3-coder`](https://github.com/you2show/qwen3-coder) and
  [`you2show/wizardlm`](https://github.com/you2show/wizardlm) document the
  model families. To serve one from A2I Core, drop a GGUF build at
  `a2i-core/models/model.gguf` (or `./run.sh --model /path/to.gguf`).
- [`you2show/transformers`](https://github.com/you2show/transformers) is the
  library for running/fine-tuning the original weights.
- Prefer Ollama? Run it, then add it in the A2I web app:
  **⚙️ Settings → AI providers → `http://127.0.0.1:11434/v1`**.

---

## Use them from the A2I web app

Any of the servers above can be added as a brain in
**⚙️ Settings → AI providers**, and the **🔄 Auto** engine will fall back
between them automatically.
