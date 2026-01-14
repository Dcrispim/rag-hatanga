# Ragatanga RAG - Electron Application

Aplicação Electron que integra o frontend React com os scripts Python do backend.

## Estrutura

```
electron/
├── main.js              # Processo principal do Electron
├── preload.js           # Script de preload para IPC seguro
├── package.json          # Dependências do Electron
├── web/                  # Aplicação React (cópia do web/)
│   └── dist/            # Build da aplicação (gerado com npm run build)
└── scripts/             # Scripts Node.js que encapsulam chamadas Python
    ├── chat.js          # Wrapper para chat
    ├── prompt.js        # Wrapper para prompt_preview.py
    ├── template.js      # Wrapper para unit.py
    ├── reindex.js       # Wrapper para index.py
    └── history.js       # Processamento de histórico
```

## Instalação

### 1. Dependências do Sistema (Linux/WSL)

O Electron requer bibliotecas do sistema. As principais que geralmente faltam são:

**Instalação mínima (recomendada):**
```bash
sudo apt-get update
sudo apt-get install -y libnss3 libasound2
```

**Instalação completa (todas as dependências):**
```bash
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libxss1 \
  libgtk-3-0
```

**Verificar dependências:**
```bash
cd electron
./check-dependencies.sh
```

### 2. Dependências do Node.js

Instalar dependências do Electron (usa `--legacy-peer-deps` para evitar conflitos):
```bash
cd electron
npm install
```

Isso automaticamente instalará as dependências do web também (via postinstall script).

### 3. Buildar a Aplicação Web

```bash
cd web
npm run build
```

**Nota:** Se encontrar erros de instalação, você pode precisar usar `npm install --legacy-peer-deps` manualmente.

## Execução

```bash
cd electron
npm run dev
```

Ou:

```bash
npm start
```

## Desenvolvimento

Para desenvolvimento, você pode executar o web em modo dev separadamente e depois buildar:

```bash
# Terminal 1: Desenvolvimento web
cd electron/web
npm run dev

# Terminal 2: Build e execução Electron
cd electron
npm run build  # Builda o web
npm run dev    # Executa Electron
```

## Arquitetura

- **Main Process**: Gerencia a janela Electron e handlers IPC
- **Renderer Process**: Aplicação React (web)
- **Preload Script**: Expõe API segura via `contextBridge`
- **Scripts Node.js**: Encapsulam chamadas Python via `child_process.spawn`

Todos os scripts Python são chamados com caminhos absolutos para:
- `.venv/bin/python` (venv do projeto)
- `src/` (scripts Python isolados)

## Notas

- O diretório `src/` permanece isolado e é chamado apenas via linha de comando
- Não há integração a nível de função - apenas chamadas de subprocess
- A aplicação funciona offline (sem servidor FastAPI)
- Sistema de fila/jobs não está implementado no Electron (execução direta)

