const API_BASE = '/api';

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

export const api = {
  chat: async (request: ChatRequest): Promise<ChatResponse> => {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao processar chat');
    }
    
    return response.json();
  },
  
  generatePrompt: async (request: PromptRequest): Promise<PromptResponse> => {
    const response = await fetch(`${API_BASE}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao gerar prompt');
    }
    
    return response.json();
  },
  
  generateTemplate: async (request: TemplateRequest): Promise<TemplateResponse> => {
    const response = await fetch(`${API_BASE}/template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao gerar template');
    }
    
    return response.json();
  },
  
  getQueueStatus: async (): Promise<QueueStatus> => {
    const response = await fetch(`${API_BASE}/queue/status`);
    
    if (!response.ok) {
      throw new Error('Erro ao obter status da fila');
    }
    
    return response.json();
  },
  
  getJobStatus: async (_jobId: string): Promise<JobStatus> => {
    const response = await fetch(`${API_BASE}/queue/job/${jobId}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: `Erro ${response.status}` }));
      const errorMessage = response.status === 404 
        ? `404: ${error.detail || 'Job não encontrado'}`
        : error.detail || 'Erro ao obter status do job';
      throw new Error(errorMessage);
    }
    
    return response.json();
  },
  
  cancelJob: async (jobId: string): Promise<{ job_id: string; status: string; message: string }> => {
    const response = await fetch(`${API_BASE}/queue/job/${jobId}/cancel`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: `Erro ${response.status}` }));
      const errorMessage = response.status === 404 
        ? `404: ${error.detail || 'Job não encontrado'}`
        : error.detail || 'Erro ao cancelar job';
      throw new Error(errorMessage);
    }
    
    return response.json();
  },
  
  getChatHistory: async (request: ChatHistoryRequest): Promise<ChatHistoryResponse> => {
    const response = await fetch(`${API_BASE}/chat/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao obter histórico');
    }
    
    return response.json();
  },

  reindex: async (request: ReindexRequest): Promise<ReindexResponse> => {
    const response = await fetch(`${API_BASE}/reindex`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao reindexar');
    }
    
    return response.json();
  },

  savePromptResponse: async (request: SavePromptResponseRequest): Promise<SavePromptResponseResponse> => {
    const response = await fetch(`${API_BASE}/prompt/save-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao salvar resposta');
    }
    
    return response.json();
  },
};

