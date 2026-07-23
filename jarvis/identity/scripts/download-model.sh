#!/usr/bin/env bash
# Downloads the speaker-embedding model from the official sherpa-onnx
# GitHub releases (k2-fsa/sherpa-onnx). Model: 3D-Speaker CAM++ trained on
# VoxCeleb (English), 16 kHz, ~28 MB. Runs fully offline after download.
# NOTE: "recongition" below is not a typo here — it is the literal tag name
# in the upstream repository.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p models

URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx"
OUT="models/campplus_en_voxceleb.onnx"

if [ -f "$OUT" ]; then
  echo "Model already present at $OUT"
  exit 0
fi

echo "Downloading speaker model (~28 MB) from k2-fsa/sherpa-onnx releases..."
curl -fL --retry 3 -o "$OUT.tmp" "$URL"
mv "$OUT.tmp" "$OUT"
echo "Saved to $OUT"
