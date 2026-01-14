import { useState, useEffect } from 'react';
import { useQueryState } from 'nuqs';
import { api, TemplateRequest } from '../services/api';
import { storage } from '../utils/storage';

export default function TemplateTab() {
  const [title, setTitle] = useQueryState('template_title');
  const [templatePathQuery, setTemplatePathQuery] = useQueryState('template_path');
  const [markdown, setMarkdown] = useQueryState('template_markdown');
  
  // Template path: priorizar query param, depois localStorage
  const templatePath = templatePathQuery || storage.getTemplatePath() || '';
  const setTemplatePath = (path: string) => {
    setTemplatePathQuery(path || null);
    if (path) {
      storage.setTemplatePath(path);
    }
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = storage.getTemplatePath();
    if (saved && !templatePath) {
      setTemplatePath(saved);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const baseDir = storage.getBaseDir();
    if (!baseDir) {
      setError('Configure o BASE_DIR nas configurações primeiro');
      return;
    }

    if (!(templatePath || '').trim()) {
      setError('Configure o caminho do template');
      return;
    }

    setLoading(true);
    setError(null);
    setMarkdown(null);

    try {
      const request: TemplateRequest = {
        title: (title || '').trim(),
        template_path: (templatePath || '').trim(),
        base_dir: baseDir,
      };

      const response = await api.generateTemplate(request);
      setMarkdown(response.markdown);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar template');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplatePathChange = (path: string) => {
    setTemplatePath(path);
    storage.setTemplatePath(path);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown as string);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Caminho do Template (MD)
        </label>
        <input
          type="text"
          value={templatePath}
          onChange={(e) => handleTemplatePathChange(e.target.value)}
          placeholder="/caminho/para/template.md"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Caminho absoluto para o arquivo template markdown (salvo no localStorage)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Título (substituirá TITLE_STRING no template)
          </label>
          <input
            type="text"
            value={title || ''}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Magia Arcana"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !(title || '').trim() || !(templatePath || '').trim()}
          className="w-full px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Gerando...' : 'Gerar Prompt do Template'}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {markdown && markdown.trim() && (
        <div className="flex-1 flex flex-col">
          <div className="mb-2 flex justify-end">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              Copiar
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-gray-50 rounded-md">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {markdown}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

