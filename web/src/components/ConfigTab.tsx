import { useState, useEffect } from 'react';
import { storage, PathAlias } from '../utils/storage';
import PathInput from './PathInput';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { api } from '../services/api';

export default function ConfigTab() {

  const [currentTab, setCurrentTab] = useState('paths');
  const [baseDir, setBaseDir] = useState('');
  const [chatHistoryDir, setChatHistoryDir] = useState('');
  const [templatePath, setTemplatePath] = useState('');
  const [alias, setAlias] = useState('');
  const [baseDirHistory, setBaseDirHistory] = useState<string[]>([]);
  const [chatHistoryDirHistory, setChatHistoryDirHistory] = useState<string[]>([]);
  const [templatePathHistory, setTemplatePathHistory] = useState<string[]>([]);
  const [aliases, setAliases] = useState<PathAlias[]>([]);
  const [presetsCollapsed, setPresetsCollapsed] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [parentPath, setParentPath] = useState('');
  
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
    // set default parent path as parent of baseDir
    const computeParent = (p: string | null) => {
      if (!p) return '';
      const cleaned = p.replace(/\/+$/g, '');
      const segments = cleaned.split('/');
      if (segments.length <= 1) return '/';
      return segments.slice(0, -1).join('/') || '/';
    };
    setParentPath(computeParent(saved || ''));
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
      setChatHistoryDir(path+'/chat_history');
      setTemplatePath(path+'/prompt.md');
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
    setCurrentTab('paths');
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
    } catch (err: unknown) {
      setReindexError(err instanceof Error ? err.message : 'Erro ao executar reindexação');
    } finally {
      setReindexLoading(false);
    }
  };

  const aliasesPanel = (
    <div className="flex flex-col min-h-0 pr-1">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <label className="block text-sm font-medium text-gray-200">Aliases salvos</label>
        <button
          type="button"
          onClick={() => setPresetsCollapsed((s) => !s)}
          className="text-sm text-gray-300 bg-gray-800/40 px-2 py-1 rounded-md hover:bg-gray-800/60"
        >
          {presetsCollapsed ? 'Mostrar' : 'Ocultar'}
        </button>
      </div>

      {!presetsCollapsed && (
        <div className="flex flex-col gap-3 overflow-y-auto min-h-0 flex-1">
          {aliases.length === 0 ? (
            <p className="text-xs text-gray-500">Nenhum alias salvo. Salve uma configuração com nome para listar aqui.</p>
          ) : (
            aliases.map((a) => (
              <article
                key={a.alias}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectAlias(a)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectAlias(a);
                  }
                }}
                className="rounded-xl border border-gray-700/50 bg-gray-900/50 shadow-md p-4 cursor-pointer transition-all duration-200 hover:border-violet-500/40 hover:bg-gray-800/40 hover:shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-violet-400 truncate">{a.alias}</h3>
                    <dl className="text-xs text-gray-400 mt-2 space-y-1">
                      <div>
                        <dt className="text-gray-500 inline">Base: </dt>
                        <dd className="inline break-all">{a.baseDir}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 inline">Chat: </dt>
                        <dd className="inline break-all">{a.chatHistoryDir}</dd>
                      </div>
                      {a.templatePath && (
                        <div>
                          <dt className="text-gray-500 inline">Template: </dt>
                          <dd className="inline break-all">{a.templatePath}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveAlias(a.alias, e)}
                    className="shrink-0 px-2 py-1 text-xs bg-red-700/15 text-red-400 rounded-md hover:bg-red-700/25"
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );

  const pathsPanel = (
    <div className="flex flex-col min-h-0 overflow-y-auto pr-1">
      <PathInput
        label="BASE_DIR"
        value={baseDir.replace('//', '/')}
        onChange={(newBaseDirPath) => {
          const newBaseDir = newBaseDirPath.replace('//', '/');
          setBaseDir(newBaseDir.replace('//', '/'));
          setChatHistoryDir(newBaseDir+'/chat_history');
          setTemplatePath(newBaseDir+'/prompt.md');
        }}
        placeholder="/caminho/para/base/dir"
        description="Caminho absoluto para o diretório base do projeto"
        history={baseDirHistory}
        onSelectFromHistory={(path) => handleSelectFromHistory(path, 'base')}
        selectDirectory={true}
      />

      <PathInput
        label="CHAT_HISTORY_DIR"
        value={chatHistoryDir.replace('//', '/')}
        onChange={setChatHistoryDir}
        placeholder="/caminho/para/chat_history"
        description="Caminho absoluto para o diretório de histórico de chat (ex: BASE_DIR/chat_history)"
        history={chatHistoryDirHistory}
        onSelectFromHistory={(path) => handleSelectFromHistory(path, 'chat')}
        selectDirectory={true}
      />

      <PathInput
        label="TEMPLATE_PATH"
        value={templatePath.replace('//', '/')}
        onChange={setTemplatePath}
        placeholder="/caminho/para/template.md"
        description="Caminho absoluto para o arquivo template markdown"
        history={templatePathHistory}
        selectFile={true}
        onSelectFromHistory={(path) => handleSelectFromHistory(path, 'template')}
      />

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Alias (opcional)</label>
        <Input
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Ex: Projeto Ragatanga"
        />
        <p className="mt-1 text-xs text-gray-500">
          Nome para salvar este conjunto de caminhos para uso futuro
        </p>
      </div>

      <div className="flex justify-end gap-2 mb-2">
        <Button onClick={handleSave} variant="primary">
          Salvar Configurações
        </Button>
      </div>
    </div>
  );

  const actionsPanel = (
    <div className="flex flex-col min-h-0 overflow-y-auto pl-1">
      <div className="border-t border-gray-800 pt-4 sm:border-t-0 sm:pt-0">
        <h3 className="text-lg font-semibold mb-4">Criar Repositório</h3>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-200 mb-2">Parent Path</label>
          <PathInput
            label=""
            value={parentPath || baseDir}
            onChange={(v) => setParentPath(v)}
            placeholder="/caminho/para/pasta/pai"
            selectDirectory={true}
          />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-200 mb-2">Nome do Repositório</label>
          <Input type="text" value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="Nome do repo" />
        </div>
        <div className="flex gap-2 mb-6">
          <Button
            onClick={async () => {
              const parent = (parentPath || baseDir).trim();
              const name = repoName.trim() || '';
              if (!parent) {
                setReindexError('Selecione/defina o parent path primeiro');
                return;
              }
              if (!name) {
                setReindexError('Digite o nome do repositório');
                return;
              }
              setReindexLoading(true);
              setReindexError(null);
              try {
                const res = await api.createRepo({ parent_path: parent, name });
                if (res.success) {
                  setReindexSuccess(res.message || 'Repositório criado');
                  storage.setBaseDir(res.path || '');
                  storage.setChatHistoryDir(((res.path || '') + '/chat_history').replace('//', '/'));
                  loadConfig();
                } else {
                  setReindexError(res.error || res.message || 'Erro ao criar repositório');
                }

                setBaseDir(res.path || '');
                setChatHistoryDir(((res.path || '') + '/chat_history').replace('//', '/'));
                setTemplatePath((res.path || '') + '/prompt.md');
                setCurrentTab('paths');

              } catch (err: unknown) {
                setReindexError(err instanceof Error ? err.message : 'Erro ao criar repositório');
              } finally {
                setReindexLoading(false);
              }
            }}
            variant="primary"
            disabled={reindexLoading}
          >
            {reindexLoading ? 'Criando...' : 'Criar Repositório'}
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-lg font-semibold mb-4">Reindexação</h3>

        <div className="mb-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={reindexPartial}
              onChange={(e) => setReindexPartial(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-300">Indexação parcial (apenas arquivos novos)</span>
          </label>
          <p className="mt-1 text-xs text-gray-500 ml-6">
            Se marcado, apenas arquivos novos serão indexados. Se desmarcado, toda a base será reindexada.
          </p>
        </div>

        {reindexError && (
          <div className="mb-4 p-3 bg-red-950/50 border text-red-300 rounded-lg text-sm">
            {reindexError}
          </div>
        )}

        {reindexSuccess && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 rounded-lg text-sm">
            {reindexSuccess}
          </div>
        )}

        <button
          type="button"
          onClick={handleReindex}
          disabled={reindexLoading || !baseDir.trim()}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {reindexLoading ? 'Reindexando...' : 'Reindexar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <h2 className="text-xl font-bold mb-3 shrink-0">Configurações</h2>
      <Tabs defaultValue="paths" className="flex flex-1 min-h-0 w-full flex-col" value={currentTab}  onValueChange={(value) => setCurrentTab(value)}>
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="aliases">Aliases</TabsTrigger>
          <TabsTrigger value="paths">Caminhos</TabsTrigger>
          <TabsTrigger value="actions">Ações</TabsTrigger>
        </TabsList>
        <TabsContent value="aliases" className="flex flex-col">
          {aliasesPanel}
        </TabsContent>
        <TabsContent value="paths" className="flex flex-col">
          {pathsPanel}
        </TabsContent>
        <TabsContent value="actions" className="flex flex-col">
          {actionsPanel}
        </TabsContent>
      </Tabs>
    </div>
  );
}

