export interface ChatRequest {
  question: string;
  base_dir: string;
  webhook_url?: string;
}

export interface ChatResponse {
  answer?: string;
  sources?: string[];
  job_id?: string;
  status: string;
}

export interface PromptRequest {
  question: string;
  base_dir: string;
}

export interface PromptResponse {
  markdown: string;
}

export interface TemplateRequest {
  title: string;
  template_path: string;
  base_dir: string;
  destination?: string;
}

export interface TemplateResponse {
  markdown: string;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  is_processing: boolean;
}

export interface JobStatus {
  job_id: string;
  status: string;
  result?: any;
  error?: string;
}

export interface ChatHistoryRequest {
  history_dir: string;
  start_date?: string;
  end_date?: string;
}

export interface ChatMessage {
  filename: string;
  title: string;
  question: string;
  answer: string;
  timestamp: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

export interface ReindexRequest {
  base_dir?: string;
  partial?: boolean;
}

export interface ReindexResponse {
  success: boolean;
  message: string;
  output?: string;
  error?: string;
}

export interface SavePromptResponseRequest {
  question: string;
  answer: string;
  chat_history_dir: string;
}

export interface SavePromptResponseResponse {
  success: boolean;
  message: string;
  filename?: string;
  error?: string;
}

// Declaração de tipos para a API Electron
declare global {
  interface Window {
    ragatangaAPI: {
      chat: (request: ChatRequest) => Promise<ChatResponse>;
      generatePrompt: (request: PromptRequest) => Promise<PromptResponse>;
      generateTemplate: (request: TemplateRequest) => Promise<TemplateResponse>;
      reindex: (request: ReindexRequest) => Promise<ReindexResponse>;
      getChatHistory: (request: ChatHistoryRequest) => Promise<ChatHistoryResponse>;
      savePromptResponse: (request: SavePromptResponseRequest) => Promise<SavePromptResponseResponse>;
    };
  }
}

export const api = {
  chat: async (request: ChatRequest): Promise<ChatResponse> => {
    if (!window.ragatangaAPI) {
      throw new Error('Ragatanga API não disponível. Certifique-se de estar executando no Electron.');
    }
    try {
      return await window.ragatangaAPI.chat(request);
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao processar chat');
    }
  },
  
  generatePrompt: async (request: PromptRequest): Promise<PromptResponse> => {
    if (!window.ragatangaAPI) {
      throw new Error('Ragatanga API não disponível. Certifique-se de estar executando no Electron.');
    }
    try {
      return await window.ragatangaAPI.generatePrompt(request);
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao gerar prompt');
    }
  },
  
  generateTemplate: async (request: TemplateRequest): Promise<TemplateResponse> => {
    if (!window.ragatangaAPI) {
      throw new Error('Ragatanga API não disponível. Certifique-se de estar executando no Electron.');
    }
    try {
      return await window.ragatangaAPI.generateTemplate(request);
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao gerar template');
    }
  },
  
  getQueueStatus: async (): Promise<QueueStatus> => {
    // Queue status não está implementado no Electron (não há sistema de fila)
    // Retornar valores padrão
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
      is_processing: false
    };
  },
  
  getJobStatus: async (_jobId: string): Promise<JobStatus> => {
    // Job status não está implementado no Electron (não há sistema de fila)
    throw new Error('Sistema de jobs não disponível no Electron');
  },
  
  cancelJob: async (_jobId: string): Promise<{ job_id: string; status: string; message: string }> => {
    // Cancel job não está implementado no Electron (não há sistema de fila)
    throw new Error('Sistema de jobs não disponível no Electron');
  },
  
  getChatHistory: async (request: ChatHistoryRequest): Promise<ChatHistoryResponse> => {
    if (!window.ragatangaAPI) {
      throw new Error('Ragatanga API não disponível. Certifique-se de estar executando no Electron.');
    }
    try {
      return await window.ragatangaAPI.getChatHistory(request);
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao obter histórico');
    }
  },

  reindex: async (request: ReindexRequest): Promise<ReindexResponse> => {
    if (!window.ragatangaAPI) {
      throw new Error('Ragatanga API não disponível. Certifique-se de estar executando no Electron.');
    }
    try {
      return await window.ragatangaAPI.reindex(request);
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao reindexar');
    }
  },

  savePromptResponse: async (request: SavePromptResponseRequest): Promise<SavePromptResponseResponse> => {
    if (!window.ragatangaAPI) {
      throw new Error('Ragatanga API não disponível. Certifique-se de estar executando no Electron.');
    }
    try {
      return await window.ragatangaAPI.savePromptResponse(request);
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao salvar resposta');
    }
  },
};

