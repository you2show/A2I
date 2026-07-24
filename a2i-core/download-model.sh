#!/usr/bin/env bash
# Download a famous open-weight model (GGUF) for A2I Core.
#
# Every model here is a well-known open model that runs 100% locally through
# llama.cpp — no OpenAI, no Anthropic, no external inference API. The only
# network activity is this one-time weight download; after it, A2I Core runs
# fully offline on your own machine.
#
# Usage:
#   ./download-model.sh                 # default: Qwen2.5 1.5B (fast, CPU-friendly)
#   ./download-model.sh list            # show every available model
#   ./download-model.sh llama-3.1-8b    # Meta Llama 3.1 8B (famous, powerful)
#   ./download-model.sh qwen-7b         # Qwen2.5 7B
#
# Backwards-compatible aliases: small | default | large
set -euo pipefail

cd "$(dirname "$0")"

# Catalog of famous open-weight models. Each is a single-file q4_k_m GGUF so a
# plain `curl` download is reliable (no multi-shard assembly needed), keeping
# "one-time download" robust. Fields: url|human name|approx RAM.
#
# For an even bigger model, download any GGUF yourself and run:
#   ./run.sh --model /path/to/your-model.gguf
declare -A CATALOG=(
  [qwen-0.5b]="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf|Qwen2.5 0.5B Instruct|~1 GB"
  [qwen-1.5b]="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf|Qwen2.5 1.5B Instruct|~2 GB"
  [qwen-3b]="https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf|Qwen2.5 3B Instruct|~4 GB"
  [qwen-7b]="https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf|Qwen2.5 7B Instruct|~6 GB"
  [llama-3.2-3b]="https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf|Meta Llama 3.2 3B Instruct|~4 GB"
  [llama-3.1-8b]="https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf|Meta Llama 3.1 8B Instruct|~7 GB"
  [mistral-7b]="https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf|Mistral 7B Instruct v0.3|~6 GB"
  [gemma-2-2b]="https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf|Google Gemma 2 2B Instruct|~3 GB"
  [gemma-2-9b]="https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf|Google Gemma 2 9B Instruct|~8 GB"
  [qwen-coder-7b]="https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf|Qwen2.5 Coder 7B (code)|~6 GB"
)

# Order used when listing, and for the compatibility aliases.
ORDER=(qwen-0.5b qwen-1.5b qwen-3b llama-3.2-3b mistral-7b qwen-7b qwen-coder-7b gemma-2-2b gemma-2-9b llama-3.1-8b)

# Friendly aliases kept for backwards compatibility with older docs/scripts.
declare -A ALIAS=(
  [small]=qwen-0.5b
  [default]=qwen-1.5b
  [large]=qwen-7b
)

print_catalog() {
  echo "Available models (all open-weight, run 100% locally, no external API):"
  echo
  printf "  %-16s %-32s %s\n" "KEY" "MODEL" "RAM"
  printf "  %-16s %-32s %s\n" "---" "-----" "---"
  for key in "${ORDER[@]}"; do
    IFS='|' read -r _url name ram <<<"${CATALOG[$key]}"
    printf "  %-16s %-32s %s\n" "$key" "$name" "$ram"
  done
  echo
  echo "Aliases: small=qwen-0.5b  default=qwen-1.5b  large=qwen-7b"
  echo "Usage:   ./download-model.sh <key>   (e.g. ./download-model.sh llama-3.1-8b)"
}

# Verify the downloaded file is a real GGUF, not an HTML error page or a
# truncated transfer. This is what makes the "one-time download" trustworthy:
# a silent failure would otherwise surface much later as a confusing crash.
verify_gguf() {
  local path="$1"
  local size
  size=$(wc -c <"$path")
  if [ "$size" -lt 10000000 ]; then
    echo "Error: downloaded file is only ${size} bytes — the download failed" >&2
    echo "(often a network/proxy error page). Deleting it; please retry." >&2
    rm -f "$path"
    return 1
  fi
  # GGUF files begin with the ASCII magic "GGUF".
  if [ "$(head -c 4 "$path")" != "GGUF" ]; then
    echo "Error: downloaded file is not a valid GGUF model (bad magic bytes)." >&2
    echo "Deleting it; please retry." >&2
    rm -f "$path"
    return 1
  fi
}

# Resolve the requested key (default + aliases + direct keys).
requested="${1:-default}"

if [ "$requested" = "list" ] || [ "$requested" = "--list" ] || [ "$requested" = "-l" ]; then
  print_catalog
  exit 0
fi

key="${ALIAS[$requested]:-$requested}"

if [ -z "${CATALOG[$key]:-}" ]; then
  echo "Unknown model: $requested" >&2
  echo >&2
  print_catalog >&2
  exit 1
fi

IFS='|' read -r URL NAME RAM <<<"${CATALOG[$key]}"

mkdir -p models
OUT="models/model.gguf"

echo "Model:  $NAME"
echo "RAM:    $RAM"
echo "Source: $URL"
echo "Downloading $(basename "$URL") (one-time) ..."

# -C - resumes a partial download; --fail turns HTTP errors into a curl error
# so we never save a provider error page as "model.gguf".
curl -L --fail --progress-bar -C - -o "$OUT" "$URL"

verify_gguf "$OUT"

echo "Done — $NAME is ready. Start the server with: ./run.sh"
