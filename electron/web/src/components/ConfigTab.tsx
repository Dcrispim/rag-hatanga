import { useState, useEffect } from 'react';
import { storage, PathAlias } from '../utils/storage';
import { api } from '../services/api';

export default function ConfigTab() {
  const [baseDir, setBaseDir] = useState('');
  const [chatHistoryDir, setChatHistoryDir] = useState('');
  const [templatePath, setTemplatePath] = useState('');
  const [alias, setAlias] = useState('');
  const [baseDirHistory, setBaseDirHistory] = useState<string[]>([]);
  const [chatHistoryDirHistory, setChatHistoryDirHistory] = useState<string[]>([]);
  const [templatePathHistory, setTemplatePathHistory] = useState<string[]>([]);
  const [aliases, setAliases] = useState<PathAlias[]>([]);
  
  // Reindexação
  const [reindexLoading, setReindexLoading] = useState(false);
  const [reindexError, setReindexError] = useState<string | null>(null);
  const [reindexSuccess, setReindexSuccess] = useState<string | null>(null);
  const [reindexPartial, setReindexPartial] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const saved = storage.getBaseDir();
    setBaseDir(saved || '');
    const savedHistory = storage.getChatHistoryDir();
    setChatHistoryDir(savedHistory || '');
    const savedTemplate = storage.getTemplatePath();
    setTemplatePath(savedTemplate || '');
    setBaseDirHistory(storage.getBaseDirHistory());
    setChatHistoryDirHistory(storage.getChatHistoryDirHistory());
    setTemplatePathHistory(storage.getTemplatePathHistory());
    setAliases(storage.getPathAliases());
    setAlias('');
  };

  const handleSave = () => {
    if (baseDir.trim()) {
      storage.setBaseDir(baseDir.trim());
      if (chatHistoryDir.trim()) {
        storage.setChatHistoryDir(chatHistoryDir.trim());
      }
      if (templatePath.trim()) {
        storage.setTemplatePath(templatePath.trim());
      }
      
      // Salvar alias se fornecido
      if (alias.trim() && chatHistoryDir.trim()) {
        storage.addPathAlias(
          alias.trim(), 
          baseDir.trim(), 
          chatHistoryDir.trim(),
          templatePath.trim() || undefined
        );
      }
      
      loadConfig(); // Recarregar para atualizar histórico
    }
  };

  const handleSelectFromHistory = (path: string, type: 'base' | 'chat' | 'template') => {
    if (type === 'base') {
      setBaseDir(path);
    } else if (type === 'chat') {
      setChatHistoryDir(path);
    } else {
      setTemplatePath(path);
    }
  };

  const handleSelectAlias = (selectedAlias: PathAlias) => {
    setBaseDir(selectedAlias.baseDir);
    setChatHistoryDir(selectedAlias.chatHistoryDir);
    setTemplatePath(selectedAlias.templatePath || '');
    setAlias(selectedAlias.alias);
  };

  const handleRemoveAlias = (aliasToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    storage.removePathAlias(aliasToRemove);
    setAliases(storage.getPathAliases());
  };

  const handleReindex = async () => {
    const targetBaseDir = baseDir.trim() || storage.getBaseDir();
    
    if (!targetBaseDir) {
      setReindexError('Configure o BASE_DIR antes de reindexar');
      return;
    }

    setReindexLoading(true);
    setReindexError(null);
    setReindexSuccess(null);

    try {
      const response = await api.reindex({
        base_dir: targetBaseDir,
        partial: reindexPartial,
      });

      if (response.success) {
        setReindexSuccess(response.message || 'Indexação concluída com sucesso');
        if (response.output) {
          console.log('Output da indexação:', response.output);
        }
      } else {
        setReindexError(response.error || response.message || 'Erro ao reindexar');
      }
    } catch (err: any) {
      setReindexError(err.message || 'Erro ao executar reindexação');
    } finally {
      setReindexLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Configurações</h2>
      
      {/* Aliases salvos */}
      {aliases.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aliases Salvos
          </label>
          <div className="grid grid-cols-1 gap-2">
            {aliases.map((a) => (
              <div
                key={a.alias}
                onClick={() => handleSelectAlias(a)}
                className="flex items-center justify-between p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex-1">
                  <span className="font-semibold text-blue-600">{a.alias}</span>
                  <div className="text-xs text-gray-500 mt-1">
                    <div>Base: {a.baseDir}</div>
                    <div>Chat: {a.chatHistoryDir}</div>
                    {a.templatePath && <div>Template: {a.templatePath}</div>}
                  </div>
                </div>
                <button
                  onClick={(e) => handleRemoveAlias(a.alias, e)}
                  className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          BASE_DIR
        </label>
        <input
          type="text"
          value={baseDir}
          onChange={(e) => setBaseDir(e.target.value)}
          placeholder="/caminho/para/base/dir"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Caminho absoluto para o diretório base do projeto
        </p>
        {baseDirHistory.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-600 mb-1">Histórico:</p>
            <div className="flex flex-wrap gap-1">
              {baseDirHistory.map((path, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectFromHistory(path, 'base')}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {path}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chat History Directory
        </label>
        <input
          type="text"
          value={chatHistoryDir}
          onChange={(e) => setChatHistoryDir(e.target.value)}
          placeholder="/caminho/para/chat_history"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Caminho absoluto para o diretório de histórico de chat (ex: BASE_DIR/chat_history)
        </p>
        {chatHistoryDirHistory.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-600 mb-1">Histórico:</p>
            <div className="flex flex-wrap gap-1">
              {chatHistoryDirHistory.map((path, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectFromHistory(path, 'chat')}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {path}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Template Path (Opcional)
        </label>
        <input
          type="text"
          value={templatePath}
          onChange={(e) => setTemplatePath(e.target.value)}
          placeholder="/caminho/para/template.md"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Caminho absoluto para o arquivo template markdown
        </p>
        {templatePathHistory.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-600 mb-1">Histórico:</p>
            <div className="flex flex-wrap gap-1">
              {templatePathHistory.map((path, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectFromHistory(path, 'template')}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {path}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Alias (Opcional)
        </label>
        <input
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Ex: Projeto Ragatanga"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Nome para salvar este conjunto de caminhos para uso futuro
        </p>
      </div>

      <div className="flex justify-end gap-2 mb-6">
        <button
          onClick={handleSave}
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Salvar Configurações
        </button>
      </div>

      {/* Seção de Reindexação */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold mb-4">Reindexação</h3>
        
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={reindexPartial}
              onChange={(e) => setReindexPartial(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">
              Indexação parcial (apenas arquivos novos)
            </span>
          </label>
          <p className="mt-1 text-xs text-gray-500 ml-6">
            Se marcado, apenas arquivos novos serão indexados. Se desmarcado, toda a base será reindexada.
          </p>
        </div>

        {reindexError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {reindexError}
          </div>
        )}

        {reindexSuccess && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {reindexSuccess}
          </div>
        )}

        <button
          onClick={handleReindex}
          disabled={reindexLoading || !baseDir.trim()}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {reindexLoading ? 'Reindexando...' : 'Reindexar'}
        </button>
      </div>
    </div>
  );
}

