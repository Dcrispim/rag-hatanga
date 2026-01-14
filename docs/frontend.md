# Documentação do Frontend

O frontend é uma aplicação web React construída com TypeScript, Vite e TailwindCSS que fornece uma interface gráfica para interagir com o sistema RAG.

## Tecnologias

- **React 18**: Biblioteca UI
- **TypeScript**: Tipagem estática
- **Vite**: Build tool e dev server
- **TailwindCSS**: Estilização
- **React Markdown**: Renderização de Markdown
- **nuqs**: Gerenciamento de query strings na URL

## Estrutura de Arquivos

```
web/
├── src/
│   ├── App.tsx              # Componente principal com navegação por tabs
│   ├── main.tsx             # Entry point da aplicação
│   ├── index.css            # Estilos globais
│   ├── components/          # Componentes React
│   │   ├── ChatTab.tsx      # Aba de chat interativo
│   │   ├── PromptTab.tsx    # Aba de geração de prompts
│   │   ├── ConfigTab.tsx    # Aba de configurações
│   │   ├── HistoryTab.tsx   # Aba de histórico
│   │   ├── TemplateTab.tsx  # Aba de templates
│   │   └── ConfigModal.tsx  # Modal de configurações
│   ├── services/
│   │   └── api.ts           # Cliente API e interfaces TypeScript
│   └── utils/
│       └── storage.ts        # Utilitários de localStorage
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Componentes Principais

### App.tsx

Componente raiz que gerencia a navegação por abas usando query strings.

**Funcionalidades:**
- Navegação entre abas (chat, prompt, config)
- Persistência de tab na URL via `nuqs`
- Redirecionamento automático para config se BASE_DIR não estiver configurado

**Tabs disponíveis:**
- `chat`: Chat interativo
- `prompt`: Geração de prompts
- `config`: Configurações

### ChatTab.tsx

Aba principal para chat interativo com o sistema RAG.

**Funcionalidades:**
- Interface de chat com histórico de mensagens
- Suporte a perguntas via query string (`?chat_question=...`)
- Carregamento automático de histórico ao montar
- Scroll automático para última mensagem
- Indicador de "digitando..." durante processamento
- Exibição de fontes/referências para cada resposta
- Suporte a jobs assíncronos com polling de status

**Estados:**
- `loading`: Processando pergunta
- `error`: Erro na requisição
- `messages`: Lista de mensagens (pergunta + resposta)

**Fluxo:**
1. Usuário digita pergunta e submete
2. Adiciona mensagem com "digitando..." ao estado
3. Chama API `/api/chat`
4. Se síncrono: atualiza mensagem com resposta
5. Se assíncrono: inicia polling do job status
6. Quando completa: atualiza mensagem com resposta
7. Recarrega histórico para incluir nova conversa

### PromptTab.tsx

Aba para geração de prompts com contexto RAG.

**Funcionalidades:**
- Geração de prompt Markdown com contexto
- Preview do prompt gerado
- Copiar prompt para clipboard
- Geração de template com prompt base
- Modal para salvar resposta manualmente
- Suporte a query strings para pergunta e markdown

**Duas seções principais:**

#### 1. Geração de Prompt Simples
- Campo de pergunta
- Botão "Gerar Prompt"
- Preview do markdown gerado
- Botão "Copiar"

#### 2. Geração de Template
- Campo de título
- Campo de destino (opcional)
- Botão "Gerar Template"
- Preview do template gerado
- Botão "Copiar"

**Modal de Salvar Resposta:**
- Permite salvar pergunta + resposta manualmente
- Útil quando usando LLM externo e querendo salvar no histórico

### ConfigTab.tsx

Aba de configurações do sistema.

**Configurações principais:**
- **BASE_DIR**: Diretório base dos documentos
- **Chat History Dir**: Diretório de histórico de conversas
- **Template Path**: Caminho do template Markdown padrão

**Funcionalidades:**
- Histórico de paths usados (últimos 20)
- Aliases de configuração (salvar conjunto de paths com nome)
- Reindexação do RAG (completa ou parcial)
- Validação de paths antes de salvar

**Aliases:**
Permite salvar configurações nomeadas para alternar rapidamente entre diferentes projetos:

```typescript
interface PathAlias {
  alias: string;
  baseDir: string;
  chatHistoryDir: string;
  templatePath?: string;
}
```

### HistoryTab.tsx

Aba para visualizar histórico de conversas.

**Funcionalidades:**
- Lista todas as conversas do histórico
- Filtro por período (start_date, end_date)
- Exibição de título, pergunta e resposta
- Ordenação por data (mais recente primeiro)
- Renderização de Markdown nas respostas

### TemplateTab.tsx

Aba para gerenciar templates de prompts.

**Funcionalidades:**
- Visualização de templates
- Criação/edição de templates
- Uso de templates na geração de prompts

## Serviços

### api.ts

Cliente HTTP para comunicação com o backend.

**Interfaces TypeScript:**
- `ChatRequest`, `ChatResponse`
- `PromptRequest`, `PromptResponse`
- `TemplateRequest`, `TemplateResponse`
- `ChatHistoryRequest`, `ChatHistoryResponse`
- `QueueStatus`, `JobStatus`
- `ReindexRequest`, `ReindexResponse`
- `SavePromptResponseRequest`, `SavePromptResponseResponse`

**Métodos:**
- `chat()`: Enviar pergunta ao chat
- `generatePrompt()`: Gerar prompt com contexto
- `generateTemplate()`: Gerar template com prompt base
- `getChatHistory()`: Obter histórico de conversas
- `getQueueStatus()`: Status da fila de jobs
- `getJobStatus()`: Status de um job específico
- `cancelJob()`: Cancelar um job
- `reindex()`: Reindexar documentos
- `savePromptResponse()`: Salvar resposta manualmente

**Tratamento de Erros:**
Todos os métodos lançam exceções com mensagens de erro apropriadas para tratamento no UI.

## Utilitários

### storage.ts

Gerenciamento de localStorage para persistência de configurações.

**Funcionalidades principais:**
- Armazenar BASE_DIR, Chat History Dir, Template Path
- Histórico de paths usados (últimos 20)
- Aliases de configuração
- Job ID e pergunta ativa (para polling)

**Chaves de Storage:**
- `ragatanga_base_dir`: Diretório base atual
- `ragatanga_chat_history_dir`: Diretório de histórico
- `ragatanga_template_path`: Caminho do template
- `ragatanga_active_job_id`: ID do job sendo processado
- `ragatanga_active_job_question`: Pergunta do job ativo
- `ragatanga_base_dir_history`: Histórico de BASE_DIRs
- `ragatanga_chat_history_dir_history`: Histórico de Chat History Dirs
- `ragatanga_template_path_history`: Histórico de Template Paths
- `ragatanga_path_aliases`: Lista de aliases salvos

**Métodos principais:**
- `getBaseDir()`, `setBaseDir()`
- `getChatHistoryDir()`, `setChatHistoryDir()`
- `getTemplatePath()`, `setTemplatePath()`
- `getPathAliases()`, `addPathAlias()`, `removePathAlias()`, `getPathAlias()`
- `getActiveJobId()`, `setActiveJobId()`
- `getActiveJobQuestion()`, `setActiveJobQuestion()`

## Gerenciamento de Estado

### Estado Local

Cada componente gerencia seu próprio estado usando hooks do React:
- `useState`: Estado local do componente
- `useEffect`: Efeitos colaterais (carregar dados, atualizar UI)
- `useQueryState` (nuqs): Estado sincronizado com URL

### Persistência

Configurações são persistidas em `localStorage` via `storage.ts`:
- Sobrevivem a refresh da página
- Histórico de valores usados
- Aliases de configuração

### Sincronização com URL

Usa `nuqs` para sincronizar estado com query strings:
- `?tab=chat`: Aba ativa
- `?chat_question=...`: Pergunta no chat
- `?prompt_question=...`: Pergunta no prompt
- `?prompt_markdown=...`: Markdown gerado

Isso permite:
- Compartilhar links com estado específico
- Navegação com botão voltar/avançar
- Refresh sem perder contexto

## Fluxos Principais

### Fluxo de Chat

1. Usuário digita pergunta e submete
2. `ChatTab` valida BASE_DIR configurado
3. Chama `api.chat()` com pergunta e BASE_DIR
4. Se síncrono:
   - Atualiza mensagem com resposta
   - Recarrega histórico
5. Se assíncrono (webhook_url):
   - Salva job_id e pergunta no storage
   - Inicia polling de `getJobStatus()`
   - Quando completa: atualiza mensagem e limpa storage

### Fluxo de Geração de Prompt

1. Usuário digita pergunta
2. `PromptTab` chama `api.generatePrompt()`
3. Recebe markdown formatado
4. Exibe preview renderizado
5. Usuário pode copiar ou salvar resposta manualmente

### Fluxo de Template

1. Usuário digita título e opcionalmente destino
2. `PromptTab` chama `api.generateTemplate()`
3. Backend usa template + contexto RAG
4. Retorna markdown completo
5. Usuário pode copiar ou salvar

### Fluxo de Reindexação

1. Usuário vai em Config
2. Clica "Reindexar"
3. Escolhe completo ou parcial
4. `ConfigTab` chama `api.reindex()`
5. Exibe progresso e resultado

## Estilização

### TailwindCSS

Usa classes utilitárias do Tailwind para estilização:
- Layout responsivo
- Cores e espaçamentos consistentes
- Componentes reutilizáveis

### Componentes Visuais

- **Cards**: Containers com sombra e borda
- **Buttons**: Estilos consistentes (primary, secondary, danger)
- **Inputs**: Campos de formulário estilizados
- **Modals**: Overlays para ações secundárias
- **Tabs**: Navegação por abas

## Build e Deploy

### Desenvolvimento

```bash
cd web
pnpm install
pnpm dev
```

Acessa em `http://localhost:5173` (porta padrão do Vite).

### Build de Produção

```bash
pnpm build
```

Gera arquivos estáticos em `web/dist/`.

### Deploy

Os arquivos em `dist/` podem ser servidos por qualquer servidor web estático:
- Nginx
- Apache
- Servidor de arquivos estáticos
- CDN (Cloudflare, AWS S3, etc.)

## Integração com Backend

### CORS

O backend permite CORS de todas as origens em desenvolvimento. Em produção, configurar origens permitidas.

### Proxy (Opcional)

Se necessário, configurar proxy no Vite para desenvolvimento:

```typescript
// vite.config.ts
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
}
```

## Tratamento de Erros

### Erros de API

Todos os métodos de `api.ts` lançam exceções que são capturadas nos componentes:

```typescript
try {
  const response = await api.chat(request);
  // Sucesso
} catch (err: any) {
  setError(err.message || 'Erro desconhecido');
}
```

### Validação

Componentes validam configurações antes de fazer requisições:
- BASE_DIR deve estar configurado
- Pergunta não pode estar vazia
- Paths devem ser válidos

### Feedback Visual

- Mensagens de erro em vermelho
- Indicadores de loading durante processamento
- Mensagens de sucesso quando apropriado

