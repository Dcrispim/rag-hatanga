const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Importar scripts Node.js
const { executeChat } = require('./scripts/chat');
const { generatePrompt } = require('./scripts/prompt');
const { generateTemplate } = require('./scripts/template');
const { reindex } = require('./scripts/reindex');
const { getChatHistory, savePromptResponse } = require('./scripts/history');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Carregar aplicação web buildada
  const webDistPath = path.join(__dirname, 'web', 'dist', 'index.html');
  
  if (fs.existsSync(webDistPath)) {
    mainWindow.loadFile(webDistPath);
  } else {
    // Se não existe build, mostrar mensagem
    mainWindow.loadURL('data:text/html,<h1>Por favor, execute "npm run build" primeiro</h1>');
  }

  // Abrir DevTools em desenvolvimento (opcional)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handlers IPC

ipcMain.handle('chat', async (event, request) => {
  try {
    const result = await executeChat(request.question, request.base_dir);
    if (result.success) {
      return {
        answer: result.data.message || result.data.answer || '',
        sources: result.data.sources || [],
        status: 'completed'
      };
    } else {
      throw new Error(result.error || 'Erro ao processar chat');
    }
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('generate-prompt', async (event, request) => {
  try {
    const result = await generatePrompt(request.question, request.base_dir);
    if (result.success) {
      return { markdown: result.markdown };
    } else {
      throw new Error(result.error || 'Erro ao gerar prompt');
    }
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('generate-template', async (event, request) => {
  try {
    const result = await generateTemplate(
      request.title,
      request.template_path,
      request.base_dir,
      request.destination
    );
    if (result.success) {
      return { markdown: result.markdown };
    } else {
      throw new Error(result.error || 'Erro ao gerar template');
    }
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('reindex', async (event, request) => {
  try {
    const result = await reindex(request.base_dir || null, request.partial || false);
    return {
      success: result.success,
      message: result.message,
      output: result.output,
      error: result.error
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao executar indexação',
      error: error.message
    };
  }
});

ipcMain.handle('get-chat-history', async (event, request) => {
  try {
    const result = await getChatHistory(
      request.history_dir,
      request.start_date || null,
      request.end_date || null
    );
    if (result.success) {
      return { messages: result.messages };
    } else {
      throw new Error(result.error || 'Erro ao obter histórico');
    }
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('save-prompt-response', async (event, request) => {
  try {
    const result = await savePromptResponse(
      request.question,
      request.answer,
      request.chat_history_dir
    );
    return {
      success: result.success,
      message: result.message,
      filename: result.filename,
      error: result.error
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao salvar resposta',
      error: error.message
    };
  }
});

