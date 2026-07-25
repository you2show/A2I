# វិភាគស៊ីជម្រៅ · Deep analysis of the coding repos — and what A2I should take

Findings from reading the **source** of the forked repos (not their READMEs),
focused on one question: *what can A2I actually adopt?*

---

## 1. Aider — the repo map (`aider/repomap.py`)

The most valuable idea in the whole set. Aider must show an LLM a useful
picture of a repo that will not fit in a context window. It does this by
ranking symbols, not by truncating files.

**How it works**

1. `tree-sitter` extracts **tags** from every file — each is a definition or a
   reference of an identifier (`Tag(rel_fname, fname, line, name, kind)`).
2. Build a directed multigraph: an edge goes **referencer → definer** for each
   identifier, weighted `sqrt(num_refs) × multipliers`.
3. Run **PageRank** over that graph (`networkx`), then distribute each node's
   rank across its out-edges to score individual definitions.
4. Emit the top-ranked definitions until the token budget (`map_tokens`) is
   spent.

**The weighting heuristics are the real craft** (`get_ranked_tags`):

| Signal | Multiplier | Why |
| ------ | ---------- | --- |
| identifier mentioned in the chat | ×10 | follow the user's attention |
| long snake/kebab/camel name (≥8 chars) | ×10 | distinctive names carry meaning |
| leading `_` (private) | ×0.1 | implementation detail |
| defined in >5 places | ×0.1 | generic name like `run`, `get` |
| referenced from a file already in chat | ×50 | strongest relevance signal |

PageRank **personalization** biases the whole walk toward files in the chat or
named by the user. Tags are cached in SQLite (`diskcache`) so the expensive
parse happens once.

**Takeaway for A2I:** our `knowledge.py` / in-browser retrieval is plain
TF-IDF over text chunks. The transferable insight is *weighting by identifier
quality and by what the user just mentioned* — cheap to add, no tree-sitter
needed. Full PageRank needs `tree-sitter` + `networkx`, so it belongs in
**a2i-core** (Python), never in the browser bundle.

## 2. Aider — why its edits actually apply (`coders/editblock_coder.py`)

Aider asks for `SEARCH/REPLACE` blocks:

```
<<<<<<< SEARCH
old code
=======
new code
>>>>>>> REPLACE
```

Models rarely reproduce the original text byte-perfectly, so aider applies a
**fallback cascade** rather than failing:

1. `perfect_replace` — exact line match.
2. `perfect_or_whitespace` — ignore leading/trailing whitespace differences.
3. `replace_part_with_missing_leading_whitespace` — the model dropped
   indentation.
4. `try_dotdotdots` — the model elided the middle with `...`.
5. `replace_closest_edit_distance` — fuzzy match above a similarity threshold.
6. `find_similar_lines` — on total failure, show the user the closest lines.

**Takeaway for A2I:** this is the single best lesson in the repo set —
*robustness comes from graceful degradation, not from a stricter prompt.* It
matches what we already did for the CPU engine (GPU → compat → warmup retry)
and for the Auto provider failover.

## 3. PR-Agent — token-aware compression (`docs/core-abilities/compression_strategy.md`)

For diffs too large for one prompt:

- **Rank by repo language first** — sort changed files by the repo's dominant
  languages, so the important code is considered before docs/config.
- **Additions over deletions** — deleted files collapse to a single list, and
  deletion-only hunks are dropped from patches.
- **Small PR:** expand each hunk by ±3 lines of context.
- **Large PR:** adaptive, token-aware fitting of as many patches as possible.

**Takeaway for A2I:** our context budget (`CONTEXT_CHAR_BUDGET`) currently
truncates in arbitrary order. Prioritising by relevance *before* truncating is
a small change with a real quality gain.

## 4. Qwen2.5/3-Coder — the FIM contract (`examples/`)

Confirms the completion template used in [`INTEGRATIONS.md`](INTEGRATIONS.md):

```
<|fim_prefix|>{prefix}<|fim_suffix|>{suffix}<|fim_middle|>
```

There is also a **repo-level** form that feeds cross-file context into
completion:

```
<|repo_name|>my-project
<|file_sep|>library.py
…file contents…
<|file_sep|>main.py
<|fim_prefix|>…<|fim_suffix|>…<|fim_middle|>
```

**Takeaway for A2I:** `a2i-core`'s new `POST /v1/completions` already passes
`prompt` + `suffix` to llama.cpp, so plain FIM works today. Repo-level FIM is
the natural next step — and it is exactly where an aider-style ranked repo map
would supply the `<|file_sep|>` files.

## 5. Tabby / OpenHands — architecture notes

- **Tabby** needs *two* models: `[model.chat.http]` (`openai/chat`) and
  `[model.completion.http]` (`openai/completion`). A2I Core previously served
  only chat — this analysis is why `/v1/completions` was added.
- **OpenHands** has moved its agent runtime into a separate SDK; this fork
  keeps the server, enterprise, and frontend layers. Integration with A2I is
  therefore purely at the LLM-config level (`[llm] base_url`), which is what
  `INTEGRATIONS.md` documents.

---

## 6. vLLM — the high-performance backend (`vllm/entrypoints/openai/`)

vLLM's OpenAI server exposes **exactly the contract A2I Core now speaks**:

- `POST /v1/chat/completions` (`chat_completion/api_router.py`)
- `POST /v1/completions` (`completion/api_router.py`)
- default port **8000** (`cli_args.py`)

So vLLM is a **drop-in replacement for A2I Core** on machines with a GPU —
same clients, same config, but continuous batching and PagedAttention make
large models (70B) genuinely fast.

```bash
vllm serve Qwen/Qwen2.5-Coder-7B-Instruct     # → http://127.0.0.1:8000/v1
```

**Adopted:** the A2I web app now ships **🚀 vLLM** and **🦙 Ollama** presets
next to A2I Core in *Settings → AI providers*, so the strongest local backend
is one click away. Still zero external API.

## 7. Vane — the researcher agent (`src/lib/agents/search/researcher/`)

Vane implements a proper agent loop with an **action registry**:

- actions are `plan`, `search`, `scrapeURL`, `uploadsSearch`, `done`;
- each action declares `enabled(config)`, so the available tool set is gated
  by query classification, mode, and sources;
- the registry converts enabled actions into tool definitions for the model.

**Adopted.** `a2i-web` now has an `ActionRegistry` with the same shape:
actions declare `enabled(ctx)` and `run(ctx)`, and `gather()` runs every
applicable action **in parallel**, so tools no longer run unconditionally.

Two deliberate differences from vane, both because A2I must work with tiny
local models that cannot be trusted to emit tool calls:

- gating is **declarative**, not model-driven — no function-calling required;
- a failing action returns nothing instead of breaking the turn (each
  `enabled`/`run` is individually guarded).

The immediate win: `looksLikeCode()` gates Wikipedia off for coding
questions and in 💻 Coder mode, so code prompts are no longer polluted with
encyclopedia text — and the freed budget goes to the user's own knowledge
base. Adding a future tool is now one `ActionRegistry.register({…})` call.

## 8. Dify / Flowise / AI SDK / Sweep — the surrounding layers

- **Dify** contributes the production RAG + workflow orchestration model, and
  can use A2I Core as an OpenAI-compatible provider.
- **Flowise** is the visual builder for the same idea.
- **AI SDK** is the unified provider abstraction — conceptually what A2I's
  own `askAuto` failover chain does in miniature.
- **Sweep** is the issue → PR agent, the same family as OpenHands/Aider.

These are *consumers* of A2I Core rather than sources of code to copy: the
value is that one local engine now serves all of them.

---

## 9. Coverage — what was read, and what was not

Being explicit, because depth varied a lot:

| Repo | Depth | What was actually read |
| ---- | ----- | ---------------------- |
| aider | **deep** | `repomap.py` (PageRank + heuristics), `coders/editblock_coder.py` (fallback cascade), `args.py`/`main.py` |
| pr-agent | **deep** | `compression_strategy.md`, settings templates |
| tabby | **deep** | `models-http-api/*.md` (chat + completion config) |
| qwen3-coder | **deep** | `README.md`, `examples/*fim*.py` (FIM + repo-level FIM) |
| vllm | **deep** | `entrypoints/openai/{chat_completion,completion}/api_router.py`, `cli_args.py` |
| vane | **deep** | `agents/search/researcher/` (action registry) |
| **dify** | **deep** | `core/rag/rerank/weight_rerank.py`, `rerank_type.py`, `core/rag/` layout |
| glm-5 | medium | `README.md` (GLM-5.2 capabilities, SGLang serving), `skills/` |
| openhands | medium | layout, `pyproject.toml` — agent runtime is an external SDK |
| sweep | shallow | `README.md`, layout |
| wizardlm | shallow | `README.md`, directory layout |
| transformers | shallow | package layout only |

### dify — hybrid retrieval (`core/rag/rerank/weight_rerank.py`)

The find worth acting on. Dify supports two rerank modes
(`RerankMode`): a dedicated **reranking model**, or a **weighted score** that
blends two signals:

```
score = vector_weight × cosine(query, chunk) + keyword_weight × bm25(query, chunk)
```

So dify does **hybrid retrieval** — dense (embeddings) *and* sparse (BM25) —
with tunable weights and a score threshold, and its RAG stack is fully
layered (`extractor` → `splitter` → `index_processor` → `retrieval` →
`rerank` → `data_post_processor`).

**Takeaway for A2I:** `a2i-core/knowledge.py` scores with plain TF-IDF
cosine. **BM25 is a strictly better sparse ranker** — it saturates term
frequency and normalises by document length, which matters for our uneven
800-char chunks. It is a small, dependency-free change and does not require
embeddings, so it fits A2I's no-API constraint exactly. Dify's *dense* half
needs an embedding model, which A2I Core could serve later via llama.cpp.

### glm-5 — a strong model, not a library

GLM-5.2 is an open flagship (1M context, strong coding, `IndexShare`
attention). It ships no serving code of its own — the README points at
**SGLang**, and it is OpenAI-compatible in practice, so for A2I it is a
*model to serve* (via vLLM/SGLang) rather than code to adopt. Its `skills/`
directory is documentation-only.

### openhands / sweep / wizardlm / transformers — nothing to adopt

- **openhands**: the agent runtime now lives in external packages
  (`openhands-sdk`, `openhands-agent-server` pinned in `pyproject.toml`);
  this fork keeps server/enterprise/frontend. Integration stays at the
  `[llm] base_url` level.
- **sweep**: the README states the project moved to a JetBrains plugin — it
  is effectively archived, so it is not a live integration target.
- **wizardlm**: research repo (Evol-Instruct training method, WizardCoder /
  WizardMath). Relevant as *models to run*, and its Evol-Instruct method
  matters only if A2I ever fine-tunes.
- **transformers**: the underlying library for running original weights;
  A2I uses GGUF via llama.cpp instead, so it is a dependency of the model
  world, not of A2I.

## How the strengths converge into one A2I

| Strength | Source | Where it lives in A2I |
| -------- | ------ | --------------------- |
| Fast local serving, big models | vLLM | provider preset → any GPU box |
| Portable local serving | llama.cpp | `a2i-core` (`run.sh`, one command) |
| Code completion / FIM | Tabby + Qwen Coder | `a2i-core` `/v1/completions` |
| Coding persona & low temperature | Aider / Qwen Coder | 💻 Coder mode |
| Relevance-ranked context | Aider + PR-Agent | `withKnowledge` ranking |
| Graceful degradation | Aider edit cascade | GPU→CPU→compat, `askAuto` failover |
| Multi-provider fallback | AI SDK | 🔄 Auto engine |
| Research/grounding | Vane | Wikipedia + knowledge base |
| RAG & orchestration | Dify / Flowise | consume A2I Core as provider |

## Ranked recommendations for A2I

| # | Change | Where | Effort | Value |
| - | ------ | ----- | ------ | ----- |
| ~~1~~ | ~~Rank context by relevance before the char budget~~ | ~~`a2i-web`~~ | — | ✅ **done** |
| ~~2~~ | ~~Weight retrieval by identifier quality~~ | ~~`a2i-core/knowledge.py`~~ | — | ✅ **done** |
| ~~3~~ | ~~Repo-level FIM for `/v1/completions`~~ | ~~`a2i-core/fim.py`~~ | — | ✅ **done** |
| ~~4~~ | ~~PageRank repo map~~ | ~~`a2i-core/repomap.py`~~ | — | ✅ **done** (no deps) |
| ~~5~~ | ~~Action registry with capability gating (Vane pattern)~~ | ~~`a2i-web`~~ | — | ✅ **done** |
| 6 | BM25 instead of plain TF-IDF (dify's sparse half) | `a2i-core/knowledge.py` | S | High |
| 7 | SEARCH/REPLACE edit format with a fallback cascade | future A2I agent | L | Only if A2I edits files |

Items 1–2 are cheap and improve answer quality immediately; 3–4 turn A2I Core
into a genuine coding backend; 5 matters only once A2I writes to disk.
