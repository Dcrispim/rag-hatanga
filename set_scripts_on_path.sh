
# Obter o caminho absoluto do diretório onde este script está localizado
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts"

echo "export PATH=\$PATH:$SCRIPT_DIR" >> ~/.bashrc 

source ~/.bashrc
