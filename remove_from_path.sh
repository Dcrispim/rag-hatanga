#!/bin/bash
# Remove scripts from path

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts"

# Remover linha que corresponde ao padrão do .bashrc
sed -i "\|export PATH=\$PATH:$SCRIPT_DIR|d" ~/.bashrc

source ~/.bashrc