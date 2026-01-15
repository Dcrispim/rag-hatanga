#!/bin/bash
# Wrapper script para rename.py
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd ..&& pwd)"
$ROOT_DIR/.venv/bin/python $ROOT_DIR/src/rename.py "$@"
