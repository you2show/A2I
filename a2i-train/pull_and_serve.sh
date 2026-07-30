#!/usr/bin/env bash
# Pull a finished Kaggle kernel's output (a trained LoRA adapter) and serve it
# in A2I via vLLM — no GGUF merge needed. See a2i-train/README.md.
#
# Auth uses your EXISTING Kaggle credentials (see the kaggle-cli docs:
# https://github.com/you2show/kaggle-cli): `kaggle auth login`, or the
# KAGGLE_API_TOKEN env var, or ~/.kaggle/access_token, or ~/.kaggle/kaggle.json.
# This script never stores, prints, or asks for your token.
#
# Usage:
#   ./pull_and_serve.sh [KERNEL] [DEST]
#     KERNEL   Kaggle kernel ref        (default: you2show/notebook75c11cd48c)
#     DEST     download folder          (default: ./kaggle-out)
#   Env overrides:
#     BASE=<hf-model>   base model for the adapter (default: the SEA-LION bucket)
#     NAME=<lora-name>  name to expose the adapter as   (default: khmer)
#     SERVE=0           download only, print the serve command instead of running
set -euo pipefail

KERNEL="${1:-you2show/notebook75c11cd48c}"
DEST="${2:-./kaggle-out}"
BASE="${BASE:-you2show/Llama-SEA-LION-v3-8B-IT-bucket}"
NAME="${NAME:-khmer}"
SERVE="${SERVE:-1}"

command -v kaggle >/dev/null 2>&1 || {
  echo "kaggle CLI មិនមាន — ដំឡើង៖ pip install kaggle" >&2; exit 1; }

echo "→ ទាញ output ពី kernel៖ $KERNEL"
mkdir -p "$DEST"
kaggle kernels output "$KERNEL" -p "$DEST"

# Locate the LoRA adapter (the folder holding adapter_config.json).
CFG="$(find "$DEST" -name adapter_config.json -print -quit 2>/dev/null || true)"
if [ -z "$CFG" ]; then
  echo "រកមិនឃើញ LoRA adapter ក្នុង $DEST" >&2
  echo "ត្រូវប្រាកដ notebook បាន Save & Run All ចប់ (output នៅ /kaggle/working)។" >&2
  exit 1
fi
ADAPTER="$(cd "$(dirname "$CFG")" && pwd)"
echo "✓ Adapter៖ $ADAPTER"

SERVE_CMD="vllm serve \"$BASE\" --enable-lora --lora-modules \"$NAME=$ADAPTER\""
if [ "$SERVE" = "1" ]; then
  command -v vllm >/dev/null 2>&1 || {
    echo "vllm មិនមាន — ដំឡើង៖ pip install vllm (ត្រូវ GPU)" >&2
    echo "ឬ download-only៖ SERVE=0 $0 ..." >&2; exit 1; }
  echo "→ Serve៖ base=$BASE  lora=$NAME"
  echo "  A2I web → ⚙️ Settings → AI providers → http://127.0.0.1:8000/v1  (model៖ $NAME)"
  exec vllm serve "$BASE" --enable-lora --lora-modules "$NAME=$ADAPTER"
else
  echo "Download only. ដើម្បី serve៖"
  echo "  $SERVE_CMD"
fi
