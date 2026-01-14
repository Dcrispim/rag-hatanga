#!/bin/bash

echo "Verificando dependências do sistema para Electron..."
echo ""

MISSING_DEPS=()

# Verificar bibliotecas principais
check_lib() {
    if ! ldconfig -p | grep -q "$1"; then
        MISSING_DEPS+=("$1")
        echo "❌ $1 não encontrada"
    else
        echo "✅ $1 encontrada"
    fi
}

echo "Verificando bibliotecas necessárias:"
check_lib "libnss3.so"
check_lib "libasound.so.2"
check_lib "libatk-bridge-2.0.so.0"
check_lib "libdrm.so.2"
check_lib "libxkbcommon.so.0"
check_lib "libgbm.so.1"

echo ""
if [ ${#MISSING_DEPS[@]} -eq 0 ]; then
    echo "✅ Todas as dependências estão instaladas!"
    echo ""
    echo "Se ainda houver erros, tente verificar o Electron diretamente:"
    echo "  ldd node_modules/electron/dist/electron | grep 'not found'"
else
    echo "❌ Faltam ${#MISSING_DEPS[@]} dependência(s)"
    echo ""
    echo "Para instalar no Ubuntu/Debian/WSL, execute:"
    echo ""
    echo "  sudo apt-get update"
    echo "  sudo apt-get install -y \\"
    echo "    libnss3 \\"
    echo "    libatk-bridge2.0-0 \\"
    echo "    libdrm2 \\"
    echo "    libxkbcommon0 \\"
    echo "    libxcomposite1 \\"
    echo "    libxdamage1 \\"
    echo "    libxfixes3 \\"
    echo "    libxrandr2 \\"
    echo "    libgbm1 \\"
    echo "    libasound2 \\"
    echo "    libxss1 \\"
    echo "    libgtk-3-0"
    echo ""
    echo "Ou instale apenas as principais:"
    echo "  sudo apt-get install -y libnss3 libasound2"
fi



