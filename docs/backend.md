# Documentação do Backend

O backend é uma API REST construída com FastAPI que fornece endpoints para interagir com o sistema RAG, incluindo chat, geração de prompts, indexação e gerenciamento de histórico.

## Arquitetura

### Tecnologias

- **FastAPI**: Framework web moderno e rápido para Python
- **Uvicorn**: Servidor ASGI para executar a aplicação
- **Pydantic**: Validação de dados e modelos
- **Threading**: Processamento assíncrono de jobs

### Estrutura de Arquivos

```
backend/
├── main.py          # Aplicação FastAPI principal
├── models.py        # Modelos Pydantic para requisições/respostas
├── job_queue.py     # Sistema de fila de jobs
└── requirements.txt # Dependências Python
```

## Endpoints da API

### 1. Chat

#### `POST /api/chat`

Endpoint principal para fazer perguntas ao sistema RAG.

**Request Body:**
```json
{
  "question": "Sua pergunta aqui",
  "base_dir": "/caminho/para/base_dir",
  "webhook_url": "https://exemplo.com/webhook" // Opcional
}
```

**Response (Síncrono):**
```json
{
  "answer": "Resposta gerada pelo modelo",
  "sources": ["doc1.md", "doc2.md"],
  "status": "completed"
}
```

**Response (Assíncrono com webhook_url):**
```json
{
  "job_id": "uuid-do-job",
  "status": "queued"
}
```

**Comportamento:**
- Se `webhook_url` não for fornecido: executa síncronamente e retorna resposta imediata
- Se `webhook_url` for fornecido: adiciona à fila e retorna `job_id` imediatamente

### 2. Geração de Prompt

#### `POST /api/prompt`

Gera um prompt Markdown completo com contexto recuperado, **sem chamar o modelo LLM**. Ideal para uso com LLMs externos.

**Request Body:**
```json
{
  "question": "Sua pergunta",
  "base_dir": "/caminho/para/base_dir"
}
```

**Response:**
```json
{
  "markdown": "# Prompt Final (RAG Preview)\n\n## Pergunta\n..."
}
```

O markdown gerado inclui:
- Pergunta formatada
- Contexto recuperado organizado por prioridades
- Prompt renderizado completo
- Lista de arquivos de referência

### 3. Template de Prompt

#### `POST /api/template`

Gera um prompt usando um template Markdown personalizado combinado com contexto RAG.

**Request Body:**
```json
{
  "title": "Título do Capítulo",
  "template_path": "/caminho/para/template.md",
  "base_dir": "/caminho/para/base_dir",
  "destination": "/caminho/destino.md" // Opcional
}
```

**Response:**
```json
{
  "markdown": "Prompt gerado com template..."
}
```

O template deve conter `TITLE_STRING` que será substituído pelo título fornecido.

### 4. Histórico de Chat

#### `POST /api/chat/history`

Retorna histórico de conversas filtrado por período.

**Request Body:**
```json
{
  "history_dir": "/caminho/para/chat_history",
  "start_date": "2024-01-01T00:00:00Z", // Opcional, ISO format
  "end_date": "2024-12-31T23:59:59Z"    // Opcional, ISO format
}
```

**Response:**
```json
{
  "messages": [
    {
      "filename": "20240101_120000_123456_message.md",
      "title": "Título da Conversa",
      "question": "Pergunta feita",
      "answer": "Resposta gerada",
      "timestamp": "2024-01-01T12:00:00"
    }
  ]
}
```

As mensagens são ordenadas por timestamp (mais recente primeiro).

### 5. Reindexação

#### `POST /api/reindex`

Reindexa os documentos do BASE_DIR.

**Request Body:**
```json
{
  "base_dir": "/caminho/para/base_dir", // Opcional, usa padrão se não fornecido
  "partial": false // true para indexação incremental
}
```

**Response:**
```json
{
  "success": true,
  "message": "Indexação concluída com sucesso",
  "output": "Saída do processo de indexação..."
}
```

### 6. Salvar Resposta de Prompt

#### `POST /api/prompt/save-response`

Salva uma pergunta e resposta manualmente no histórico de chat.

**Request Body:**
```json
{
  "question": "Pergunta feita",
  "answer": "Resposta fornecida",
  "chat_history_dir": "/caminho/para/chat_history"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Resposta salva com sucesso",
  "filename": "20240101_120000_123456_message.md"
}
```

**Nota**: Headings na pergunta e resposta são incrementados automaticamente (h1 vira h2, etc.) para manter hierarquia no arquivo.

### 7. Status da Fila

#### `GET /api/queue/status`

Retorna status geral da fila de jobs.

**Response:**
```json
{
  "pending": 2,
  "processing": 1,
  "completed": 10,
  "failed": 1,
  "total": 14,
  "is_processing": true
}
```

### 8. Status de Job

#### `GET /api/queue/job/{job_id}`

Retorna status de um job específico.

**Response:**
```json
{
  "job_id": "uuid-do-job",
  "status": "completed",
  "result": {
    "question": "Pergunta",
    "message": "Resposta",
    "sources": ["doc1.md"]
  },
  "error": null
}
```

**Status possíveis:**
- `pending`: Aguardando processamento
- `processing`: Sendo processado
- `completed`: Concluído com sucesso
- `failed`: Falhou
- `cancelled`: Cancelado

### 9. Cancelar Job

#### `POST /api/queue/job/{job_id}/cancel`

Cancela um job que ainda não foi concluído.

**Response:**
```json
{
  "job_id": "uuid-do-job",
  "status": "cancelled",
  "message": "Job cancelado com sucesso"
}
```

### 10. Webhook Interno

#### `POST /api/webhook`

Endpoint interno para receber callbacks do CLI quando jobs completam.

**Query Parameters:**
- `job_id`: ID do job

**Request Body:**
```json
{
  "status": "success",
  "result": { ... },
  "error": null,
  "job_id": "uuid-do-job"
}
```

Este endpoint é usado internamente pelo sistema. Se o job tiver um `webhook_url` externo, ele também será chamado após atualizar o status interno.

## Sistema de Fila de Jobs

### Arquitetura

O sistema usa uma fila thread-safe para processar jobs sequencialmente:

```python
from job_queue import JobQueue, JobStatus

job_queue = JobQueue()
```

### Estados do Job

1. **PENDING**: Job adicionado à fila, aguardando processamento
2. **PROCESSING**: Job sendo executado
3. **COMPLETED**: Job concluído com sucesso
4. **FAILED**: Job falhou durante execução
5. **CANCELLED**: Job cancelado pelo usuário

### Processamento

- Jobs são processados **sequencialmente** (um por vez)
- Cada job executa o CLI (`src/cli.py`) em background
- O CLI chama o webhook interno quando completa
- O backend atualiza o status e chama webhook externo se configurado

### Thread de Processamento

Uma thread daemon processa a fila continuamente:

```python
def process_queue():
    while True:
        if not job_queue.queue.empty():
            # Processa próximo job
            ...
        else:
            time.sleep(0.5)  # Aguarda novos jobs
```

## Modelos Pydantic

### ChatRequest
```python
class ChatRequest(BaseModel):
    question: str
    base_dir: str
    webhook_url: Optional[str] = None
```

### ChatResponse
```python
class ChatResponse(BaseModel):
    answer: Optional[str] = None
    sources: Optional[list] = None
    job_id: Optional[str] = None
    status: str
```

### PromptRequest
```python
class PromptRequest(BaseModel):
    question: str
    base_dir: str
```

### PromptResponse
```python
class PromptResponse(BaseModel):
    markdown: str
```

### TemplateRequest
```python
class TemplateRequest(BaseModel):
    title: str
    template_path: str
    base_dir: str
    destination: Optional[str] = None
```

### ChatHistoryRequest
```python
class ChatHistoryRequest(BaseModel):
    history_dir: str
    start_date: Optional[str] = None  # ISO format
    end_date: Optional[str] = None    # ISO format
```

### ChatMessage
```python
class ChatMessage(BaseModel):
    filename: str
    title: str
    question: str
    answer: str
    timestamp: str
```

### ReindexRequest
```python
class ReindexRequest(BaseModel):
    base_dir: Optional[str] = None
    partial: bool = False
```

### SavePromptResponseRequest
```python
class SavePromptResponseRequest(BaseModel):
    question: str
    answer: str
    chat_history_dir: str
```

## Integração com src/

O backend executa os scripts do módulo `src/` via subprocess:

### Execução de Comandos

```python
VENV_PYTHON = PROJECT_ROOT / ".venv" / "bin" / "python"
CLI_SCRIPT = PROJECT_ROOT / "src" / "cli.py"

cmd = [str(VENV_PYTHON), str(CLI_SCRIPT), "--base-dir", base_dir]
```

### Variáveis de Ambiente

O backend define `BASE_DIR` como variável de ambiente antes de executar comandos:

```python
env = dict(**os.environ, BASE_DIR=str(base_dir_path))
```

## CORS

O backend permite CORS de todas as origens (configuração de desenvolvimento):

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Nota**: Em produção, especificar origens permitidas.

## Validação de Paths

Todos os paths fornecidos são validados para prevenir path traversal:

```python
def validate_path(path: str) -> Path:
    resolved = Path(path).resolve()
    if not resolved.exists():
        raise ValueError(f"Path não existe: {path}")
    return resolved
```

## Execução

### Desenvolvimento

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

### Produção

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Ou usando o script direto:

```bash
python backend/main.py
```

## Timeouts

- **Chat síncrono**: 5 minutos
- **Reindexação**: 10 minutos
- **Webhook externo**: 10 segundos

## Logging

O backend usa `print()` para logging. Em produção, considerar usar o módulo `logging` do Python.

