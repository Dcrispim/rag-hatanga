#!/bin/bash
# Wrapper script para backend/main.py
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd ..&& pwd)"
$ROOT_DIR/backend/venv/bin/python $ROOT_DIR/backend/main.py "$@"

