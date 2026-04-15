import React, { useState, useEffect } from 'react';
import { useQueryState } from 'nuqs';
import ReactMarkdown from 'react-markdown';
import { api, PromptRequest, TemplateRequest } from '../services/api';
import { storage } from '../utils/storage';
import {
  applyPromptQueryPairToParams,
  buildPromptQueryPair,
  generateShareQuery,
  getInitialPromptTextFromSearch,
} from '../utils/promptShareQuery';
import Input from '../ui/Input';
import Button from '../ui/Button';

export default function PromptTab() {
  const [text, setText] = useState(() => getInitialPromptTextFromSearch());
  const [markdown, setMarkdown] = useState('');
  const [templateTitle, setTemplateTitle] = useQueryState('template_title');
  const [templateDestination, setTemplateDestination] = useQueryState('template_destination');
  const [templateMarkdown, setTemplateMarkdown] = useQueryState('template_markdown');
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveAnswer, setSaveAnswer] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [retrieverK, setRetrieverK] = useState<number>(16);
  const [chatSpanHours, setChatSpanHours] = useState<number>(2);

  /** Após 2s sem edição, sincroniza `prompt_question` na URL (sem navegar). */
  useEffect(() => {
    const id = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
  
      params.delete('q');
  
      const hasText = !!text.trim();
  
      if (!hasText) {
        params.delete('prompt_question');
      } else {
        let finalText = text;
  
        // 🔥 regra de truncamento (se necessário)
        if (finalText.length > 5000) {
          finalText =
            '--- [Texto truncado] ---\n\n' +
            finalText.substring(0, 2000);
        }
  
        const safeText = finalText.substring(0, 5000);
  
        const pair = buildPromptQueryPair(safeText, 'prompt_question');
        applyPromptQueryPairToParams(params, pair);
      }
  
      const search = params.toString();
  
      const next =
        window.location.pathname +
        (search ? `?${search}` : '') +
        window.location.hash;
  
      window.history.replaceState(null, '', next);
    }, 2000);
  
    return () => window.clearTimeout(id);
  }, [text]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const baseDir = storage.getBaseDir();
    if (!baseDir) {
      setError('Configure o BASE_DIR nas configurações primeiro');
      return;
    }

    setLoading(true);
    setError(null);
    setMarkdown('');

    try {
      const request: PromptRequest = {
        question: text || '',
        base_dir: baseDir,
        retriever_k: showAdvanced ? retrieverK : undefined,
        chat_span: showAdvanced ? chatSpanHours : undefined,
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

  const handleShare = async () => {
    const query = generateShareQuery(text);
    const url = `${window.location.origin}${window.location.pathname}?${query}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // ignore
    }
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

  const [promptCollapsed, setPromptCollapsed] = useState<boolean>(false);
  // set collapsed on new markdown
  useEffect(() => {
    if (markdown && markdown.length > 600) {
      setPromptCollapsed(true);
    } else {
      setPromptCollapsed(false);
    }
  }, [markdown]);

  const truncateMarkdown = (md: string, limit: number) => {
    if (!md || md.length <= limit) return md;
    const lines = md.split(/\r?\n/);
    const out: string[] = [];
    let len = 0;
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const addLen = line.length + 1; // account for newline
      const startsFence = line.trim().startsWith('```');
      if (!inFence && startsFence) {
        // start fence
        if (len + addLen <= limit) {
          out.push(line);
          len += addLen;
          inFence = true;
          continue;
        } else {
          // not enough room for fence line; stop and append ellipsis
          return out.join('\n') + '\n...';
        }
      }

      if (inFence) {
        // inside fenced block
        if (len + addLen <= limit) {
          out.push(line);
          len += addLen;
          if (startsFence) {
            inFence = false; // closing fence
          }
          continue;
        } else {
          // truncated inside fence: include partial and close fence
          const remaining = Math.max(0, limit - len);
          if (remaining > 0) {
            out.push(line.slice(0, remaining));
          }
          out.push('```'); // ensure closed
          return out.join('\n') + '\n...';
        }
      } else {
        // not in fence
        if (len + addLen <= limit) {
          out.push(line);
          len += addLen;
          continue;
        } else {
          // need to truncate this line
          const remaining = Math.max(0, limit - len);
          if (remaining > 0) {
            out.push(line.slice(0, remaining));
            return out.join('\n') + '...';
          } else {
            return out.join('\n') + '...';
          }
        }
      }
    }
    // end, if still in fence close it
    if (inFence) out.push('```');
    return out.join('\n');
  };
  // collapse by default if large
  if (!promptCollapsed && markdown && markdown.length > 600) {
    // initialize collapsed true only on first render with content
    // but avoid setting state during render - instead set default in useState is enough
  }

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
                value={text} 
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite a pergunta em markdown para gerar o prompt..."
                className="ui-textarea min-h-[200px] text-sm h-full"
                disabled={loading}
              />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-gray-700 mb-2">Preview</div>
              <div className="ui-panel h-full overflow-auto p-4 bg-white">
                {text && text.trim() ? (
                  <ReactMarkdown
                   className="text-gray-100 bg-gray-100  px-4"
                    components={{
                      p: ({ children }: any) => <p className="mb-2 last:mb-0 text-gray-900">{children}</p>,
                      h1: ({ children }: any) => <h1 className="text-xl font-bold mb-2 text-gray-900">{children}</h1>,
                      h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 text-gray-900">{children}</h2>,
                      h3: ({ children }: any) => <h3 className="text-base font-bold mb-1 text-gray-900">{children}</h3>,
                      ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 text-gray-800">{children}</ul>,
                      ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 text-gray-800">{children}</ol>,
                      line: ({ _children }: any) => <hr className="my-4 border-gray-200 h-px"/>,
                      
                      li: ({ children }: any) => <li className="mb-1">{children}</li>,
                      code: ({ children }: any) => <code className="bg-gray-200 px-1 rounded text-xs text-gray-900">{children}</code>,
                      pre: ({ children }: any) => <pre className="bg-gray-200 p-2 rounded text-xs overflow-x-auto mb-2 text-gray-900">{children}</pre>,
                      strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }: any) => <em className="italic">{children}</em>,
                      blockquote: ({ children }: any) => <blockquote className="border-l-4  border-gray-400 pl-4 italic mb-2 text-gray-700">{children}</blockquote>,
                    }}
                  >
                    {text}
                  </ReactMarkdown>
                ) : (
                  <p className="text-gray-400 italic">Preview aparecerá aqui...</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Configurações Avançadas */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Configurações Avançadas</span>
          </label>
          
          {showAdvanced && (
            <div className="mt-3 ml-6 p-4 bg-gray-50 border border-gray-200 rounded-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RETRIEVER_K (Número de documentos a recuperar)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={retrieverK}
                  onChange={(e) => setRetrieverK(parseInt(e.target.value) || 16)}
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Padrão: 16. Aumente para recuperar mais documentos do contexto.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horas de Contexto de Conversa
                </label>
                <Input
                  type="number"
                  min={0}
                  max={168}
                  step={0.5}
                  value={chatSpanHours}
                  onChange={(e) => setChatSpanHours(parseFloat(e.target.value) || 2)}
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Padrão: 2 horas. Inclui mensagens do histórico de chat dentro deste intervalo como contexto adicional.
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 flex-wrap">
          <Button
            type="button"
            onClick={handleShare}
            disabled={!text.trim()}
            variant="ghost"
          >
            {shareCopied ? 'Link copiado' : 'Compartilhar'}
          </Button>
          <Button
            type="submit"
            disabled={loading || !text.trim()}
            variant="primary"
          >
            {loading ? 'Gerando...' : 'Gerar Prompt'}
          </Button>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border  text-red-700 rounded">
          {error}
        </div>
      )}

      {markdown && markdown.trim() && (
        <div className="flex-1 flex flex-col">
          <div className="mb-2 flex justify-between items-center gap-2">
            <div className="flex gap-2">
              <Button onClick={() => setSaveModalOpen(true)} className="bg-green-600 hover:bg-green-700" variant="primary">
                Salvar Resposta
              </Button>
              <Button onClick={handleCopy} className="ml-2" variant="ghost">
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            {markdown && markdown.length > 600 && (
              <button
                onClick={() => setPromptCollapsed((s) => !s)}
                className="text-sm text-gray-300 bg-gray-800/20 px-2 py-1 rounded"
              >
                {promptCollapsed ? 'Expandir prompt' : 'Colapsar prompt (600c)'}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4 bg-gray-50 rounded-md max-h-[50vh]">
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
              {promptCollapsed ? (markdown ? truncateMarkdown(markdown, 600) : '') : (markdown || '')}
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
          <div className="mb-4 p-3 bg-red-100 border  text-red-700 rounded">
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
                value={text}
                readOnly
                className="ui-textarea bg-slate-800"
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
                className="ui-textarea min-h-[160px]"
                rows={10}
              />
            </div>

            {saveError && (
              <div className="mb-4 p-3 bg-red-100 border  text-red-700 rounded">
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                {saveSuccess}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setSaveModalOpen(false);
                  setSaveAnswer('');
                  setSaveError(null);
                  setSaveSuccess(null);
                }}
                variant="ghost"
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  const chatHistoryDir = storage.getChatHistoryDir();
                  if (!chatHistoryDir) {
                    setSaveError('Configure o Chat History Directory nas configurações primeiro');
                    return;
                  }

                  const baseDir = storage.getBaseDir();
                  if (!baseDir) {
                    setSaveError('Configure o BASE_DIR nas configurações primeiro');
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
                      question: text || '',
                      answer: saveAnswer,
                      chat_history_dir: chatHistoryDir,
                      base_dir: baseDir,
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
                variant="primary"
              >
                {saveLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

