const STORAGE_KEYS = {
  BASE_DIR: 'ragatanga_base_dir',
  TEMPLATE_PATH: 'ragatanga_template_path',
  CHAT_HISTORY_DIR: 'ragatanga_chat_history_dir',
  ACTIVE_JOB_ID: 'ragatanga_active_job_id',
  ACTIVE_JOB_QUESTION: 'ragatanga_active_job_question',
  BASE_DIR_HISTORY: 'ragatanga_base_dir_history',
  CHAT_HISTORY_DIR_HISTORY: 'ragatanga_chat_history_dir_history',
  TEMPLATE_PATH_HISTORY: 'ragatanga_template_path_history',
  PATH_ALIASES: 'ragatanga_path_aliases',
} as const;

export interface PathAlias {
  alias: string;
  baseDir: string;
  chatHistoryDir: string;
  templatePath?: string;
}

export const storage = {
  getBaseDir: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.BASE_DIR);
  },
  
  
  getTemplatePath: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.TEMPLATE_PATH);
  },
  
  setTemplatePath: (path: string): void => {
    localStorage.setItem(STORAGE_KEYS.TEMPLATE_PATH, path);
    // Adicionar ao histórico
    const history = storage.getTemplatePathHistory();
    if (!history.includes(path)) {
      history.unshift(path);
      // Manter apenas os últimos 20
      const limited = history.slice(0, 20);
      localStorage.setItem(STORAGE_KEYS.TEMPLATE_PATH_HISTORY, JSON.stringify(limited));
    }
  },

  getTemplatePathHistory: (): string[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATE_PATH_HISTORY);
    return stored ? JSON.parse(stored) : [];
  },
  
  getActiveJobId: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_JOB_ID);
  },
  
  setActiveJobId: (jobId: string | null): void => {
    if (jobId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_JOB_ID, jobId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_JOB_ID);
    }
  },
  
  getActiveJobQuestion: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_JOB_QUESTION);
  },
  
  setActiveJobQuestion: (question: string | null): void => {
    if (question) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_JOB_QUESTION, question);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_JOB_QUESTION);
    }
  },
  
  getChatHistoryDir: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY_DIR);
  },
  
  setChatHistoryDir: (path: string): void => {
    localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY_DIR, path);
    // Adicionar ao histórico
    const history = storage.getChatHistoryDirHistory();
    if (!history.includes(path)) {
      history.unshift(path);
      // Manter apenas os últimos 20
      const limited = history.slice(0, 20);
      localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY_DIR_HISTORY, JSON.stringify(limited));
    }
  },

  getBaseDirHistory: (): string[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.BASE_DIR_HISTORY);
    return stored ? JSON.parse(stored) : [];
  },

  getChatHistoryDirHistory: (): string[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY_DIR_HISTORY);
    return stored ? JSON.parse(stored) : [];
  },

  setBaseDir: (path: string): void => {
    localStorage.setItem(STORAGE_KEYS.BASE_DIR, path);
    // Adicionar ao histórico
    const history = storage.getBaseDirHistory();
    if (!history.includes(path)) {
      history.unshift(path);
      // Manter apenas os últimos 20
      const limited = history.slice(0, 20);
      localStorage.setItem(STORAGE_KEYS.BASE_DIR_HISTORY, JSON.stringify(limited));
    }
  },

  getPathAliases: (): PathAlias[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.PATH_ALIASES);
    return stored ? JSON.parse(stored) : [];
  },

  addPathAlias: (alias: string, baseDir: string, chatHistoryDir: string, templatePath?: string): void => {
    const aliases = storage.getPathAliases();
    // Remover alias existente com mesmo nome se houver
    const filtered = aliases.filter((a: PathAlias) => a.alias !== alias);
    filtered.push({ alias, baseDir, chatHistoryDir, templatePath });
    localStorage.setItem(STORAGE_KEYS.PATH_ALIASES, JSON.stringify(filtered));
  },

  removePathAlias: (alias: string): void => {
    const aliases = storage.getPathAliases();
    const filtered = aliases.filter((a: PathAlias) => a.alias !== alias);
    localStorage.setItem(STORAGE_KEYS.PATH_ALIASES, JSON.stringify(filtered));
  },

  getPathAlias: (alias: string): PathAlias | null => {
    const aliases = storage.getPathAliases();
    return aliases.find((a: PathAlias) => a.alias === alias) || null;
  },
};

