# Documentação do Projeto RAG Hatanga

Bem-vindo à documentação completa do projeto RAG Hatanga. Esta documentação está organizada em três pilares principais que cobrem todas as partes do sistema.

## Estrutura da Documentação

### 📚 [Módulo src/](src.md)

Documentação completa do módulo `src/`, incluindo:

- **Indexação RAG** (`index.py`): Sistema de indexação de documentos Markdown em vectorstore FAISS
- **Geração de Prompts** (`prompt_preview.py`): Geração de prompts com contexto para LLMs externos
- **Chat Interativo** (`chat.py`): Chat completo usando modelos locais (Ollama)
- **Constantes e Variáveis de Ambiente**: Configuração do sistema
- **Estrutura BASE_DIR**: Organização de arquivos e diretórios do sistema RAG

**Destaques:**
- Explicação da diferença entre chat (modelos locais) e prompt (LLMs externos)
- Documentação completa da estrutura BASE_DIR
- Guia de uso de `.ragignore`, `.rag_priorities` e histórico de chat

### 🔧 [Backend](backend.md)

Documentação da API REST FastAPI, incluindo:

- **Endpoints da API**: Todos os endpoints disponíveis com exemplos
- **Sistema de Fila de Jobs**: Processamento assíncrono de requisições
- **Modelos Pydantic**: Estruturas de dados para requisições e respostas
- **Integração com src/**: Como o backend executa os scripts Python

**Endpoints principais:**
- `/api/chat` - Chat interativo
- `/api/prompt` - Geração de prompts
- `/api/template` - Templates de prompts
- `/api/chat/history` - Histórico de conversas
- `/api/reindex` - Reindexação de documentos

### 🎨 [Frontend](frontend.md)

Documentação da aplicação web React, incluindo:

- **Componentes React**: Estrutura e funcionalidades de cada componente
- **Serviços de API**: Cliente HTTP e interfaces TypeScript
- **Gerenciamento de Estado**: Estado local, localStorage e sincronização com URL
- **Fluxos Principais**: Como cada funcionalidade funciona end-to-end

**Componentes principais:**
- `ChatTab` - Interface de chat
- `PromptTab` - Geração de prompts
- `ConfigTab` - Configurações do sistema
- `HistoryTab` - Visualização de histórico
- `TemplateTab` - Gerenciamento de templates

## Conceitos Fundamentais

### Diferença entre Chat e Prompt

**Chat (`chat.py`):**
- Usa **modelos locais** via Ollama (ex: `llama3.1`)
- Gera respostas completas usando LLM local
- Salva histórico automaticamente e reindexa
- Ideal para uso local, privacidade, sem custos de API

**Prompt (`prompt_preview.py`):**
- **Não chama modelo LLM** - apenas gera o prompt
- Recupera contexto e formata prompt Markdown
- Ideal para uso com LLMs externos (GPT-4, Claude, etc.)
- Permite revisar contexto antes de enviar para LLM externo

### Estrutura BASE_DIR

O diretório `BASE_DIR` contém toda a estrutura do sistema RAG:

```
BASE_DIR/
├── .rag_indexeds          # Arquivos já indexados
├── .ragignore             # Arquivos a ignorar
├── .rag_priorities        # Prioridades e aliases
├── index.faiss            # Índice vetorial FAISS
├── index.pkl               # Metadados do índice
├── chat_history/           # Histórico de conversas
│   ├── *_message.md        # Mensagens individuais
│   └── font-refs.json      # Referências de fontes
└── [documentos .md]        # Documentos a indexar
```

Veja [src.md](src.md#estrutura-do-base_dir) para detalhes completos.

## Guias Rápidos

### Inicialização do Projeto

```bash
# Executar script de setup
./setup.sh

# Isso cria:
# - .venv (raiz) para src/
# - backend/venv para backend/
# - Instala node_modules em web/
```

### Executar Backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

### Executar Frontend

```bash
cd web
pnpm install
pnpm dev
```

### Indexar Documentos

```bash
# Ativar venv
source .venv/bin/activate

# Indexação completa
python src/index.py

# Indexação incremental
python src/index.py --partial
```

### Usar Chat

```bash
source .venv/bin/activate
python src/chat.py

# Ou pergunta única
python src/chat.py -q "Sua pergunta"
```

### Gerar Prompt

```bash
source .venv/bin/activate
python src/prompt_preview.py -q "Sua pergunta"

# Salvar em arquivo
python src/prompt_preview.py -q "Pergunta" -o output.md

# Copiar para clipboard
python src/prompt_preview.py -q "Pergunta" --copy
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Modelos Ollama
LLM_MODEL=llama3.1
LLM_TEMPERATURE=0
EMBEDDINGS_MODEL=nomic-embed-text

# Configuração RAG
RETRIEVER_K=4

# Diretório base (opcional, sobrescreve constants.py)
BASE_DIR=/caminho/para/documentos
```

## Arquivos de Configuração

### `.ragignore`

Lista arquivos/pastas a ignorar na indexação:

```
# Comentários são permitidos
*.tmp
temp/
docs/old/
```

### `.rag_priorities`

Organiza contexto por prioridades:

```
# Formato: priority, path, alias
0, docs/conceitos/, Conceitos Fundamentais
1, docs/exemplos/, Exemplos Práticos
2, docs/referencias/, Referências
```

## Arquitetura Geral

```
┌─────────────┐
│  Frontend   │  React + TypeScript
│   (Web)     │  Interface gráfica
└──────┬──────┘
       │ HTTP/REST
┌──────▼──────┐
│   Backend   │  FastAPI
│  (Python)   │  API REST + Fila de Jobs
└──────┬──────┘
       │ Subprocess
┌──────▼──────┐
│  Módulo     │  Python Scripts
│    src/     │  index.py, chat.py, prompt_preview.py
└──────┬──────┘
       │
┌──────▼──────┐
│  BASE_DIR   │  Documentos + Índices
│  (Disco)    │  FAISS + Histórico
└─────────────┘
```

## Próximos Passos

1. Leia [src.md](src.md) para entender o sistema de indexação e RAG
2. Consulte [backend.md](backend.md) para integrar com a API
3. Explore [frontend.md](frontend.md) para customizar a interface

## Contribuindo

Ao adicionar novas funcionalidades:

1. Atualize a documentação correspondente
2. Adicione exemplos de uso
3. Documente variáveis de ambiente novas
4. Atualize este README se necessário

## Suporte

Para dúvidas ou problemas:
- Consulte a documentação específica do módulo
- Verifique os exemplos de código
- Revise a estrutura BASE_DIR e arquivos de configuração

