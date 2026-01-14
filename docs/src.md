# Documentação do Módulo src/

O módulo `src/` contém os componentes principais do sistema RAG (Retrieval-Augmented Generation), incluindo indexação, geração de prompts e chat interativo.

## Visão Geral

O módulo `src/` é responsável por:
- **Indexação** de documentos Markdown em um vectorstore FAISS
- **Geração de prompts** com contexto para uso em LLMs externas
- **Chat interativo** usando modelos locais (Ollama)

## Componentes Principais

### 1. `index.py` - Sistema de Indexação

O `index.py` é responsável por criar e manter o índice vetorial dos documentos.

#### Funcionalidades

- **Carregamento de documentos**: Carrega todos os arquivos `.md` do diretório `BASE_DIR`
- **Filtragem**: Usa `.ragignore` para excluir arquivos/pastas específicos
- **Indexação incremental**: Modo `--partial` para indexar apenas arquivos novos
- **Rastreamento**: Mantém `.rag_indexeds` com lista de arquivos já indexados

#### Uso

```bash
# Indexação completa
python src/index.py

# Indexação parcial (apenas novos arquivos)
python src/index.py --partial
```

#### Processo de Indexação

1. Carrega lista de arquivos já indexados (`.rag_indexeds`)
2. Carrega regras de exclusão (`.ragignore`)
3. Filtra documentos novos ou não indexados
4. Divide documentos em chunks (800 caracteres, overlap 150)
5. Gera embeddings usando Ollama (`nomic-embed-text`)
6. Salva vectorstore FAISS (`index.faiss` e `index.pkl`)
7. Atualiza `.rag_indexeds` com novos arquivos

### 2. `prompt_preview.py` - Geração de Prompts com Contexto

O `prompt_preview.py` gera prompts completos com contexto recuperado do RAG, **sem chamar o modelo LLM**. É projetado para uso com LLMs externas (GPT-4, Claude, etc.).

#### Funcionalidades

- **Recuperação de contexto**: Busca documentos relevantes usando similaridade semântica
- **Organização por prioridades**: Usa `.rag_priorities` para organizar contexto por seções
- **Formatação Markdown**: Gera prompt formatado em Markdown com contexto estruturado
- **Referências**: Inclui lista de arquivos fonte usados no contexto

#### Uso

```bash
# Gerar prompt e exibir
python src/prompt_preview.py -q "Sua pergunta aqui"

# Salvar em arquivo
python src/prompt_preview.py -q "Sua pergunta" -o output.md

# Copiar para clipboard
python src/prompt_preview.py -q "Sua pergunta" --copy
```

#### Sistema de Prioridades

O arquivo `.rag_priorities` permite organizar o contexto por seções priorizadas:

```
# Formato: priority, path, alias
0, docs/conceitos/, Conceitos Fundamentais
1, docs/exemplos/, Exemplos Práticos
2, docs/referencias/, Referências
```

- **Priority**: Número menor = maior prioridade (0 é mais prioritário)
- **Path**: Caminho relativo ou absoluto para agrupar documentos
- **Alias**: Nome alternativo para exibição no prompt

Documentos são agrupados por entrada e ordenados por prioridade. Documentos sem match vão para seção "Outros".

### 3. `chat.py` - Chat Interativo com Modelos Locais

O `chat.py` implementa um sistema de chat completo usando **modelos locais via Ollama**. Diferente do `prompt_preview.py`, ele gera respostas completas usando o LLM local.

#### Funcionalidades

- **Chat interativo**: Loop de perguntas e respostas
- **Modelo local**: Usa Ollama para gerar respostas (padrão: `llama3.1`)
- **Histórico automático**: Salva conversas em `chat_history/`
- **Reindexação automática**: Reindexa após cada resposta para incluir histórico
- **Geração de títulos**: Cria títulos contextuais para cada conversa
- **Modo JSON**: Suporta saída estruturada para integração

#### Uso

```bash
# Chat interativo
python src/chat.py

# Pergunta única
python src/chat.py -q "Sua pergunta"

# Modo JSON (para integração)
python src/chat.py -q "Sua pergunta" --json
```

#### Fluxo de Processamento

1. Usuário faz pergunta
2. Sistema recupera contexto relevante do vectorstore
3. Gera resposta usando LLM local (Ollama)
4. Gera título contextual baseado na pergunta/resposta
5. Salva em `chat_history/` como arquivo Markdown
6. Reindexa o RAG para incluir nova conversa
7. Recarrega vectorstore atualizado

### 4. `unit.py` - Geração de Prompts com Template

O `unit.py` combina template Markdown com geração de prompt RAG para criar prompts estruturados.

#### Funcionalidades

- **Template personalizado**: Usa `prompt_base.md` ou template customizado
- **Substituição de variáveis**: Substitui `TITLE_STRING` pelo título fornecido
- **Geração de contexto**: Adiciona contexto RAG ao template
- **Salvamento ou clipboard**: Salva em arquivo ou copia para clipboard

#### Uso

```bash
# Gerar prompt com template padrão
python src/unit.py "Título do Capítulo"

# Usar template customizado
python src/unit.py "Título" template.md

# Salvar em destino específico
python src/unit.py "Título" template.md destino.md
```

## Constantes e Variáveis de Ambiente

### `constants.py`

Define a constante `BASE_DIR` que indica o diretório raiz dos documentos:

```python
BASE_DIR = "/mnt/d/Documents/Vaults/Ragatanga"
```

O `BASE_DIR` pode ser sobrescrito pela variável de ambiente `BASE_DIR`.

### Variáveis de Ambiente

As seguintes variáveis podem ser configuradas via arquivo `.env`:

#### Para `chat.py` e `prompt_preview.py`:

- **`LLM_MODEL`**: Modelo Ollama para LLM (padrão: `llama3.1`)
- **`LLM_TEMPERATURE`**: Temperatura do modelo (padrão: `0`)
- **`EMBEDDINGS_MODEL`**: Modelo para embeddings (padrão: `nomic-embed-text`)
- **`RETRIEVER_K`**: Número de documentos a recuperar (padrão: `4`)

#### Para `index.py`:

- **`BASE_DIR`**: Diretório base dos documentos (sobrescreve `constants.py`)

## Estrutura do BASE_DIR

O diretório `BASE_DIR` contém a estrutura completa do sistema RAG:

```
BASE_DIR/
├── .rag_indexeds          # Lista de arquivos já indexados (um por linha)
├── .ragignore             # Arquivos/pastas a ignorar na indexação
├── .rag_priorities         # Prioridades e aliases para organização do contexto
├── index.faiss            # Índice vetorial FAISS (binário)
├── index.pkl              # Metadados do índice FAISS
├── chat_history/           # Diretório de histórico de conversas
│   ├── YYYYMMDD_HHMMSS_microseconds_message.md  # Mensagens individuais
│   └── font-refs.json      # Referências de fontes por mensagem
└── [seus documentos .md]  # Documentos Markdown a serem indexados
```

### Arquivos de Configuração

#### `.rag_indexeds`

Lista de arquivos já indexados, um por linha. Usado para indexação incremental.

```
/mnt/d/Documents/Vaults/Ragatanga/docs/conceito1.md
/mnt/d/Documents/Vaults/Ragatanga/docs/conceito2.md
```

#### `.ragignore`

Similar ao `.gitignore`, lista arquivos/pastas a ignorar. Suporta comentários com `#`:

```
# Ignorar arquivos temporários
*.tmp
temp/

# Ignorar diretório específico
docs/old/
```

#### `.rag_priorities`

Define prioridades e aliases para organização do contexto no prompt:

```
# Formato: priority, path, alias
# Priority: número menor = maior prioridade (0 é mais prioritário)
# Path: caminho relativo ou absoluto
# Alias: nome alternativo (opcional)

0, docs/conceitos/, Conceitos Fundamentais
1, docs/exemplos/, Exemplos Práticos
2, docs/referencias/, Referências
-1, docs/temp/, Temporários  # Priority -1 = não usar no contexto
```

### Diretório `chat_history/`

Armazena histórico de conversas do chat:

#### Arquivos `*_message.md`

Cada conversa é salva como um arquivo Markdown com formato:

```markdown
# Título Gerado Automaticamente

# Pergunta

Sua pergunta aqui

# Resposta

Resposta gerada pelo modelo
```

#### `font-refs.json`

Mapeia cada arquivo de mensagem para suas fontes (arquivos usados no contexto):

```json
{
  "20240101_120000_123456_message.md": [
    "docs/conceito1.md",
    "docs/exemplo1.md"
  ],
  "20240101_130000_789012_message.md": [
    "docs/conceito2.md"
  ]
}
```

## Diferenças entre Chat e Prompt

### `chat.py` - Modelos Locais

- **Uso**: Chat interativo com respostas completas
- **Modelo**: Ollama local (ex: `llama3.1`)
- **Processamento**: Gera resposta completa usando LLM local
- **Histórico**: Salva automaticamente e reindexa
- **Ideal para**: Uso local, privacidade, sem custos de API

### `prompt_preview.py` - LLMs Externas

- **Uso**: Geração de prompts com contexto para LLMs externas
- **Modelo**: Nenhum (apenas gera o prompt)
- **Processamento**: Apenas recupera contexto e formata prompt
- **Histórico**: Não salva automaticamente
- **Ideal para**: Usar com GPT-4, Claude, ou outros serviços externos

## Integração com CLI

O módulo `src/` também pode ser acessado via `cli.py`, que fornece uma interface unificada:

```bash
# Via CLI
python src/cli.py --base-dir /path/to/docs chat -q "Pergunta"
python src/cli.py --base-dir /path/to/docs prompt -q "Pergunta"
python src/cli.py --base-dir /path/to/docs index --partial
```

O CLI suporta webhooks para execução assíncrona e integração com o backend.

