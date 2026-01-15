#!/bin/bash
# Wrapper script para src/prompt_preview.py
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd ..&& pwd)"
$ROOT_DIR/.venv/bin/python $ROOT_DIR/src/prompt_preview.py "$@"

