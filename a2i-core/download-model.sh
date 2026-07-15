#!/usr/bin/env bash
# Download an open-weight model (GGUF) for A2I Core.
# The download happens once; after that, everything runs fully offline.
#
# Usage:
#   ./download-model.sh            # default: Qwen2.5 1.5B Instruct (fast, CPU-friendly)
#   ./download-model.sh small      # Qwen2.5 0.5B (very small machines)
#   ./download-model.sh large      # Qwen2.5 7B  (needs ~6GB RAM, much smarter)
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p models

case "${1:-default}" in
  small)
    URL="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"
    ;;
  large)
    URL="https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf"
    ;;
  default)
    URL="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf"
    ;;
  *)
    echo "Unknown size: $1 (use: small | default | large)" >&2
    exit 1
    ;;
esac

echo "Downloading $(basename "$URL") ..."
curl -L --fail --progress-bar -o models/model.gguf "$URL"
echo "Done. Start the server with: ./run.sh"
