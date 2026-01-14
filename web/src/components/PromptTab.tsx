import { useState } from 'react';
import { useQueryState } from 'nuqs';
import ReactMarkdown from 'react-markdown';
import { api, PromptRequest, TemplateRequest } from '../services/api';
import { storage } from '../utils/storage';

export default function PromptTab() {
  const [question, setQuestion] = useQueryState('prompt_question');
  const [markdown, setMarkdown] = useQueryState('prompt_markdown');
  const [templateTitle, setTemplateTitle] = useQueryState('template_title');
  const [templateDestination, setTemplateDestination] = useQueryState('template_destination');
  const [templateMarkdown, setTemplateMarkdown] = useQueryState('template_markdown');
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveAnswer, setSaveAnswer] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const baseDir = storage.getBaseDir();
    if (!baseDir) {
      setError('Configure o BASE_DIR nas configurações primeiro');
      return;
    }

    setLoading(true);
    setError(null);
    setMarkdown(null);

    try {
      const request: PromptRequest = {
        question: question || '',
        base_dir: baseDir,
      };

      const response = await api.generatePrompt(request);
      setMarkdown(response.markdown);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (markdown) {
      navigator.clipboard.writeText(markdown);
      setCopied(true);
    }
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const baseDir = storage.getBaseDir();
    if (!baseDir) {
      setTemplateError('Configure o BASE_DIR nas configurações primeiro');
      return;
    }

    const templatePath = storage.getTemplatePath();
    if (!templatePath) {
      setTemplateError('Configure o Template Path nas configurações primeiro');
      return;
    }

    if (!(templateTitle || '').trim()) {
      setTemplateError('Digite um título');
      return;
    }

    setTemplateLoading(true);
    setTemplateError(null);
    setTemplateMarkdown(null);

    try {
      const request: TemplateRequest = {
        title: (templateTitle || '').trim(),
        template_path: templatePath,
        base_dir: baseDir,
        destination: (templateDestination || '').trim() || undefined,
      };

      const response = await api.generateTemplate(request);
      setTemplateMarkdown(response.markdown);
    } catch (err: any) {
      setTemplateError(err.message || 'Erro ao gerar template');
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleTemplateCopy = () => {
    if (templateMarkdown) {
      navigator.clipboard.writeText(templateMarkdown);
      setTemplateCopied(true);
    }
    setTimeout(() => {
      setTemplateCopied(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Seção de Gerar Prompt */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Gerar Prompt com Contexto</h3>
        <form onSubmit={handleSubmit} className="mb-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pergunta (Markdown)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <textarea
                value={question || ''}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Digite a pergunta em markdown para gerar o prompt..."
                className="flex-1 min-h-[200px] px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
                disabled={loading}
              />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-gray-700 mb-2">Preview</div>
              <div className="flex-1 min-h-[200px] overflow-auto p-4 bg-gray-50 border border-gray-300 rounded-md">
                {question && question.trim() ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }: any) => <p className="mb-2 last:mb-0 text-gray-800">{children}</p>,
                      h1: ({ children }: any) => <h1 className="text-xl font-bold mb-2 text-gray-900">{children}</h1>,
                      h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 text-gray-900">{children}</h2>,
                      h3: ({ children }: any) => <h3 className="text-base font-bold mb-1 text-gray-900">{children}</h3>,
                      ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 text-gray-800">{children}</ul>,
                      ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 text-gray-800">{children}</ol>,
                      li: ({ children }: any) => <li className="mb-1">{children}</li>,
                      code: ({ children }: any) => <code className="bg-gray-200 px-1 rounded text-xs text-gray-900">{children}</code>,
                      pre: ({ children }: any) => <pre className="bg-gray-200 p-2 rounded text-xs overflow-x-auto mb-2 text-gray-900">{children}</pre>,
                      strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }: any) => <em className="italic">{children}</em>,
                      blockquote: ({ children }: any) => <blockquote className="border-l-4 border-gray-400 pl-4 italic mb-2 text-gray-700">{children}</blockquote>,
                    }}
                  >
                    {question}
                  </ReactMarkdown>
                ) : (
                  <p className="text-gray-400 italic">Preview aparecerá aqui...</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !(question || '').trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Gerando...' : 'Gerar Prompt'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {markdown && markdown.trim() && (
        <div className="flex-1 flex flex-col">
          <div className="mb-2 flex justify-end gap-2">
            <button
              onClick={() => setSaveModalOpen(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              Salvar Resposta
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-gray-50 rounded-md">
            <ReactMarkdown
              components={{
                p: ({ children }: any) => <p className="mb-2 last:mb-0 text-gray-800">{children}</p>,
                h1: ({ children }: any) => <h1 className="text-xl font-bold mb-2 text-gray-900">{children}</h1>,
                h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 text-gray-900">{children}</h2>,
                h3: ({ children }: any) => <h3 className="text-base font-bold mb-1 text-gray-900">{children}</h3>,
                ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 text-gray-800">{children}</ul>,
                ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 text-gray-800">{children}</ol>,
                li: ({ children }: any) => <li className="mb-1">{children}</li>,
                code: ({ children }: any) => <code className="bg-gray-200 px-1 rounded text-xs text-gray-900">{children}</code>,
                pre: ({ children }: any) => <pre className="bg-gray-200 p-2 rounded text-xs overflow-x-auto mb-2 text-gray-900">{children}</pre>,
                strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
                em: ({ children }: any) => <em className="italic">{children}</em>,
                blockquote: ({ children }: any) => <blockquote className="border-l-4 border-gray-400 pl-4 italic mb-2 text-gray-700">{children}</blockquote>,
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      )}
      </div>

      {/* Seção de Gerar Template */}
      <div className="flex-1 flex flex-col">
        <h3 className="text-lg font-semibold mb-4">Gerar Prompt do Template</h3>
        <form onSubmit={handleTemplateSubmit} className="mb-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título (substituirá TITLE_STRING no template)
            </label>
            <input
              type="text"
              value={templateTitle || ''}
              onChange={(e) => setTemplateTitle(e.target.value)}
              placeholder="Ex: Magia Arcana"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={templateLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Template Path: {storage.getTemplatePath() || 'Não configurado (configure nas Configurações)'}
            </p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destino (Opcional - deixe vazio para usar padrão: BASE_DIR/generated_prompts/titulo.md)
            </label>
            <input
              type="text"
              value={templateDestination || ''}
              onChange={(e) => setTemplateDestination(e.target.value)}
              placeholder="/caminho/absoluto/para/destino.md"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={templateLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Caminho absoluto onde o prompt gerado será salvo. Se vazio, será salvo em BASE_DIR/generated_prompts/
            </p>
          </div>
          <button
            type="submit"
            disabled={templateLoading || !(templateTitle || '').trim() || !storage.getTemplatePath()}
            className="w-full px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {templateLoading ? 'Gerando...' : 'Gerar Prompt do Template'}
          </button>
        </form>

        {templateError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {templateError}
          </div>
        )}

        {templateMarkdown && templateMarkdown.trim() && (
          <div className="flex-1 flex flex-col">
            <div className="mb-2 flex justify-end">
              <button
                onClick={handleTemplateCopy}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
              >
                {templateCopied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50 rounded-md">
              <ReactMarkdown
                components={{
                  p: ({ children }: any) => <p className="mb-2 last:mb-0 text-gray-800">{children}</p>,
                  h1: ({ children }: any) => <h1 className="text-xl font-bold mb-2 text-gray-900">{children}</h1>,
                  h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 text-gray-900">{children}</h2>,
                  h3: ({ children }: any) => <h3 className="text-base font-bold mb-1 text-gray-900">{children}</h3>,
                  ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 text-gray-800">{children}</ul>,
                  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 text-gray-800">{children}</ol>,
                  li: ({ children }: any) => <li className="mb-1">{children}</li>,
                  code: ({ children }: any) => <code className="bg-gray-200 px-1 rounded text-xs text-gray-900">{children}</code>,
                  pre: ({ children }: any) => <pre className="bg-gray-200 p-2 rounded text-xs overflow-x-auto mb-2 text-gray-900">{children}</pre>,
                  strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
                  em: ({ children }: any) => <em className="italic">{children}</em>,
                  blockquote: ({ children }: any) => <blockquote className="border-l-4 border-gray-400 pl-4 italic mb-2 text-gray-700">{children}</blockquote>,
                }}
              >
                {templateMarkdown}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Salvar Resposta */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Salvar Resposta</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pergunta
              </label>
              <textarea
                value={question || ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                rows={3}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resposta
              </label>
              <textarea
                value={saveAnswer}
                onChange={(e) => setSaveAnswer(e.target.value)}
                placeholder="Digite a resposta aqui..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={10}
              />
            </div>

            {saveError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                {saveSuccess}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSaveModalOpen(false);
                  setSaveAnswer('');
                  setSaveError(null);
                  setSaveSuccess(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const chatHistoryDir = storage.getChatHistoryDir();
                  if (!chatHistoryDir) {
                    setSaveError('Configure o Chat History Directory nas configurações primeiro');
                    return;
                  }

                  if (!saveAnswer.trim()) {
                    setSaveError('Digite uma resposta');
                    return;
                  }

                  setSaveLoading(true);
                  setSaveError(null);
                  setSaveSuccess(null);

                  try {
                    const response = await api.savePromptResponse({
                      question: question || '',
                      answer: saveAnswer,
                      chat_history_dir: chatHistoryDir,
                    });

                    if (response.success) {
                      setSaveSuccess(response.message || 'Resposta salva com sucesso!');
                      setTimeout(() => {
                        setSaveModalOpen(false);
                        setSaveAnswer('');
                        setSaveError(null);
                        setSaveSuccess(null);
                      }, 2000);
                    } else {
                      setSaveError(response.error || response.message || 'Erro ao salvar resposta');
                    }
                  } catch (err: any) {
                    setSaveError(err.message || 'Erro ao salvar resposta');
                  } finally {
                    setSaveLoading(false);
                  }
                }}
                disabled={saveLoading || !saveAnswer.trim()}
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saveLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

