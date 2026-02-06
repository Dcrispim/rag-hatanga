#!/bin/bash
# Script para executar backend e frontend simultaneamente usando caminhos absolutos

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_SCRIPT="$ROOT_DIR/scripts/backend_main.sh"
WEB_DIR="$ROOT_DIR/web"
CONCURRENTLY="$WEB_DIR/node_modules/.bin/concurrently"

# Verificar se concurrently está instalado
if [ ! -f "$CONCURRENTLY" ]; then
    echo "Erro: concurrently não encontrado. Execute: cd web && pnpm add -D concurrently"
    exit 1
fi

# Executar backend e frontend simultaneamente
"$CONCURRENTLY" \
    --names "backend,frontend" \
    --prefix-colors "blue,green" \
    "bash $BACKEND_SCRIPT" \
    "cd $WEB_DIR && pnpm start --port 3001"

