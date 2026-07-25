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

## Ranked recommendations for A2I

| # | Change | Where | Effort | Value |
| - | ------ | ----- | ------ | ----- |
| 1 | Rank context by relevance before applying the char budget | `a2i-web/index.html` | S | High |
| 2 | Weight retrieval by identifier quality + user-mentioned terms | `a2i-core/knowledge.py` | S | High |
| 3 | Repo-level FIM (`<|repo_name|>`/`<|file_sep|>`) for `/v1/completions` | `a2i-core/server.py` | M | High for Tabby |
| 4 | tree-sitter + PageRank repo map | `a2i-core` (new module) | L | High, Python-only |
| 5 | SEARCH/REPLACE edit format with a fallback cascade | future A2I agent | L | Only if A2I edits files |

Items 1–2 are cheap and improve answer quality immediately; 3–4 turn A2I Core
into a genuine coding backend; 5 matters only once A2I writes to disk.
