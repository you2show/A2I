#!/usr/bin/env bash
# A2I Core — ONE command to a working local AI (macOS / Linux / WSL).
#
# Sets up Python, downloads an open model if needed, and starts the server.
# Inference runs on NATIVE llama.cpp — not the browser's WebAssembly — so it
# works reliably on any machine, with no external API. Chat opens at:
#
#     http://127.0.0.1:8990
#
# Usage:
#   ./run.sh                        # default model (Qwen2.5 1.5B)
#   A2I_MODEL=llama-3.1-8b ./run.sh # pick a model (see ./download-model.sh list)
#   ./run.sh --knowledge-dir ~/docs # extra args pass through to the server
set -euo pipefail
cd "$(dirname "$0")"

# 1. Find a Python 3 interpreter.
PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
  echo "Error: Python 3 is not installed." >&2
  echo "Install it from https://python.org (or your package manager), then re-run." >&2
  exit 1
fi

# 2. One-time environment setup.
if [ ! -d .venv ]; then
  echo "Setting up Python environment (first run only) ..."
  "$PY" -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  # llama-cpp-python publishes prebuilt CPU wheels at this index (no compiler
  # needed). Fall back to a source build only if no wheel fits this platform.
  if ! .venv/bin/pip install --quiet -r requirements.txt \
        --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu; then
    echo "No prebuilt wheel for this platform — building llama-cpp-python from" >&2
    echo "source (needs a C/C++ compiler; this can take a few minutes) ..." >&2
    .venv/bin/pip install -r requirements.txt
  fi
fi

# 3. Download a model on first run (single-file GGUF; verified after download).
if [ ! -f models/model.gguf ]; then
  echo "No model found — downloading one now (one-time) ..."
  ./download-model.sh "${A2I_MODEL:-default}"
fi

# 4. Start the server. Extra CLI args pass straight through to server.py.
echo
echo "──────────────────────────────────────────────────────"
echo "  A2I Core is starting — open  http://127.0.0.1:8990"
echo "  (native llama.cpp · 100% local · no external API)"
echo "──────────────────────────────────────────────────────"
echo
exec .venv/bin/python server.py "$@"
