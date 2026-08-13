#!/usr/bin/env bash
# A2I local-only model library manager.
#
# It downloads published GGUF weights once, stores them on the user's disk, and
# runs them offline through A2I Core. It never calls an inference API and never
# executes scripts shipped by a model repository.
set -euo pipefail

cd "$(dirname "$0")"

# Fields: source URL | name | approximate RAM | license reminder | model card
# Keep this list deliberately small and reviewable. Add a model only after
# reviewing its publisher model card, licence, GGUF compatibility and hash path.
declare -A CATALOG=(
  [qwen-1.5b]="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf|Qwen2.5 1.5B Instruct Q4_K_M|~2 GB|Review Qwen model card and license|https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF"
  [qwen-3b]="https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf|Qwen2.5 3B Instruct Q4_K_M|~4 GB|Review Qwen model card and license|https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF"
  [qwen-7b]="https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf;https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf|Qwen2.5 7B Instruct Q4_K_M|~6 GB|Review Qwen model card and license; downloader joins two official GGUF parts|https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF"
  [qwen-coder-7b]="https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf|Qwen2.5 Coder 7B Instruct Q4_K_M|~6 GB|Review Qwen model card and license|https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF"
  [sea-lion-7b]="https://huggingface.co/aisingapore/sea-lion-7b-instruct-gguf/resolve/main/sea-lion-7b-instruct-Q4_0.gguf|SEA-LION 7B Instruct Q4_0|~6 GB|MIT according to the model card; review safety caveats|https://huggingface.co/aisingapore/SEA-LION-v1-7B-IT-GGUF"
)
ORDER=(qwen-1.5b qwen-3b qwen-7b qwen-coder-7b sea-lion-7b)
LIBRARY="models/library"
ACTIVE="models/model.gguf"

usage() {
  cat <<'EOF'
A2I Local Model Library

Usage:
  ./download-model.sh list
  ./download-model.sh [model-key] [--yes]
  ./download-model.sh activate <model-key>

Default: qwen-3b (the recommended local default for a 12 GB RAM PC).

The first command downloads one GGUF file to your own SSD. After the download,
A2I runs it offline. Read the displayed source, model card and licence before
confirming any asset. This utility refuses non-GGUF files and does not run
repository scripts or Python files.
EOF
}

print_catalog() {
  echo "A2I curated local-only GGUF models"
  echo
  printf "  %-16s %-36s %-9s %s\n" "KEY" "MODEL" "RAM" "MODEL CARD"
  printf "  %-16s %-36s %-9s %s\n" "---" "-----" "---" "----------"
  for key in "${ORDER[@]}"; do
    IFS='|' read -r _url name ram _license card <<<"${CATALOG[$key]}"
    printf "  %-16s %-36s %-9s %s\n" "$key" "$name" "$ram" "$card"
  done
  echo
  echo "Recommended for your 12 GB PC: qwen-3b."
  echo "Optional slower quality mode: qwen-7b or sea-lion-7b (Khmer/ASEAN experiment)."
}

verify_gguf() {
  local path="$1" size
  size=$(wc -c <"$path")
  if [ "$size" -lt 10000000 ] || [ "$(head -c 4 "$path")" != "GGUF" ]; then
    echo "Error: file is not a complete GGUF model. Deleting it." >&2
    rm -f "$path"
    return 1
  fi
}

activate() {
  local key="$1" asset="$LIBRARY/$key.gguf"
  if [ ! -f "$asset" ]; then
    echo "No local asset for '$key'. Download it first." >&2
    exit 1
  fi
  verify_gguf "$asset"
  mkdir -p models
  rm -f "$ACTIVE"
  # A hard link avoids duplicating multi-GB files. Copy only if the filesystem
  # does not support hard links.
  ln "$asset" "$ACTIVE" 2>/dev/null || cp "$asset" "$ACTIVE"
  echo "Activated local model: $key"
  echo "Start A2I Core with: ./run.sh"
}

command="${1:-qwen-3b}"
if [ "$command" = "list" ] || [ "$command" = "--list" ] || [ "$command" = "-l" ]; then
  print_catalog
  exit 0
fi
if [ "$command" = "help" ] || [ "$command" = "--help" ] || [ "$command" = "-h" ]; then
  usage
  exit 0
fi
if [ "$command" = "activate" ]; then
  [ -n "${2:-}" ] || { echo "Specify a model key to activate." >&2; exit 1; }
  activate "$2"
  exit 0
fi

key="$command"
if [ -z "${CATALOG[$key]:-}" ]; then
  echo "Unknown local model: $key" >&2
  print_catalog >&2
  exit 1
fi

IFS='|' read -r url name ram license card <<<"${CATALOG[$key]}"
echo "A2I local-only download"
echo "Model:      $name"
echo "RAM tier:   $ram"
echo "Source:     $url"
echo "Model card: $card"
echo "Licence:    $license"
echo
if [ "${2:-}" != "--yes" ]; then
  read -r -p "I reviewed this source and licence. Download this GGUF to my disk? [y/N] " answer
  case "$answer" in y|Y|yes|YES) ;; *) echo "Cancelled."; exit 0 ;; esac
fi

mkdir -p "$LIBRARY"
tmp="$LIBRARY/.${key}.partial"
asset="$LIBRARY/${key}.gguf"
echo "Downloading GGUF file data. This may take time; it runs offline afterwards."
rm -f "$tmp"
IFS=';' read -r -a parts <<<"$url"
if [ "${#parts[@]}" -eq 1 ]; then
  curl -L --fail --progress-bar -C - -o "$tmp" "${parts[0]}"
else
  echo "This official asset is split into ${#parts[@]} files; downloading and joining locally."
  for index in "${!parts[@]}"; do
    part="$LIBRARY/.${key}.part${index}.partial"
    curl -L --fail --progress-bar -C - -o "$part" "${parts[$index]}"
    cat "$part" >> "$tmp"
    rm -f "$part"
  done
fi
verify_gguf "$tmp"
mv -f "$tmp" "$asset"
checksum=$(sha256sum "$asset" | awk '{print $1}')
created=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '{\n  "id": "%s",\n  "name": "%s",\n  "source": "%s",\n  "model_card": "%s",\n  "license_note": "%s",\n  "sha256": "%s",\n  "downloaded_at": "%s"\n}\n' \
  "$key" "$name" "$url" "$card" "$license" "$checksum" "$created" > "$LIBRARY/${key}.json"
activate "$key"
echo "Receipt: $LIBRARY/${key}.json"
