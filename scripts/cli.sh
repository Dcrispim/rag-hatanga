#!/bin/bash
# Wrapper script para src/cli.py
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd ..&& pwd)"
$ROOT_DIR/.venv/bin/python $ROOT_DIR/src/cli.py "$@"

