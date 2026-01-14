#!/bin/bash

# Script de Inicialização do Projeto RAG Hatanga
# Cria venvs para src (.venv na raiz) e backend, e instala dependências Node.js para web

set -e  # Parar em caso de erro

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para imprimir mensagens
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se Python 3 está disponível
if ! command -v python3 &> /dev/null; then
    error "Python 3 não está instalado. Por favor, instale Python 3 primeiro."
    exit 1
fi

info "Python 3 encontrado: $(python3 --version)"

# Obter diretório do script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# ============================================
# 1. Configurar venv para src/ (usa .venv na raiz)
# ============================================
info "Configurando venv para src/ (usando .venv na raiz)..."

SRC_VENV="$SCRIPT_DIR/.venv"
if [ -d "$SRC_VENV" ]; then
    warn "Venv .venv já existe na raiz"
else
    info "Criando venv .venv na raiz..."
    python3 -m venv "$SRC_VENV"
    info "Venv .venv criada com sucesso na raiz"
fi

# Instalar dependências se requirements.txt existir
SRC_REQUIREMENTS="$SCRIPT_DIR/src/requirements.txt"
if [ -f "$SRC_REQUIREMENTS" ]; then
    info "Instalando dependências de src/requirements.txt..."
    source "$SRC_VENV/bin/activate"
    pip install --upgrade pip > /dev/null 2>&1
    pip install -r "$SRC_REQUIREMENTS"
    deactivate
    info "Dependências de src/ instaladas com sucesso"
else
    warn "src/requirements.txt não encontrado. Pulando instalação de dependências para src/"
fi

# ============================================
# 2. Configurar venv para backend/
# ============================================
info "Configurando venv para backend/..."

BACKEND_VENV="$SCRIPT_DIR/backend/venv"
if [ -d "$BACKEND_VENV" ]; then
    warn "Venv para backend/ já existe em $BACKEND_VENV"
else
    info "Criando venv para backend/..."
    python3 -m venv "$BACKEND_VENV"
    info "Venv criada com sucesso para backend/"
fi

# Instalar dependências do backend
BACKEND_REQUIREMENTS="$SCRIPT_DIR/backend/requirements.txt"
if [ -f "$BACKEND_REQUIREMENTS" ]; then
    info "Instalando dependências de backend/requirements.txt..."
    source "$BACKEND_VENV/bin/activate"
    pip install --upgrade pip > /dev/null 2>&1
    pip install -r "$BACKEND_REQUIREMENTS"
    deactivate
    info "Dependências de backend/ instaladas com sucesso"
else
    error "backend/requirements.txt não encontrado!"
    exit 1
fi

# ============================================
# 3. Instalar dependências Node.js para web/
# ============================================
info "Configurando dependências Node.js para web/..."

WEB_DIR="$SCRIPT_DIR/web"
if [ ! -d "$WEB_DIR" ]; then
    error "Diretório web/ não encontrado!"
    exit 1
fi

cd "$WEB_DIR"

# Verificar se pnpm está disponível
if command -v pnpm &> /dev/null; then
    info "Usando pnpm para instalar dependências..."
    pnpm install
    info "Dependências Node.js instaladas com sucesso usando pnpm"
else
    warn "pnpm não encontrado. Tentando usar npm..."
    if command -v npm &> /dev/null; then
        info "Usando npm para instalar dependências..."
        npm install
        info "Dependências Node.js instaladas com sucesso usando npm"
    else
        error "Nem pnpm nem npm foram encontrados. Por favor, instale um deles primeiro."
        exit 1
    fi
fi

cd "$SCRIPT_DIR"

# ============================================
# Resumo final
# ============================================
echo ""
info "========================================="
info "Inicialização concluída com sucesso!"
info "========================================="
info "Venvs criadas:"
info "  - .venv (raiz, para src/)"
info "  - backend/venv"
info "Dependências Node.js instaladas em web/"
echo ""
info "Para ativar uma venv, use:"
info "  source .venv/bin/activate         # Para src/ (raiz)"
info "  source backend/venv/bin/activate  # Para backend/"

