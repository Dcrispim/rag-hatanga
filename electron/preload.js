const { contextBridge, ipcRenderer } = require('electron');

// Expor API segura para o renderer process
contextBridge.exposeInMainWorld('ragatangaAPI', {
  chat: async (request) => {
    return await ipcRenderer.invoke('chat', request);
  },
  
  generatePrompt: async (request) => {
    return await ipcRenderer.invoke('generate-prompt', request);
  },
  
  generateTemplate: async (request) => {
    return await ipcRenderer.invoke('generate-template', request);
  },
  
  reindex: async (request) => {
    return await ipcRenderer.invoke('reindex', request);
  },
  
  getChatHistory: async (request) => {
    return await ipcRenderer.invoke('get-chat-history', request);
  },
  
  savePromptResponse: async (request) => {
    return await ipcRenderer.invoke('save-prompt-response', request);
  }
});

