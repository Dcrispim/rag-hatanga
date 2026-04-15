import { useState, useEffect } from 'react';
import { useQueryState } from 'nuqs';
import { api, ChatHistoryRequest } from '../services/api';
import { storage } from '../utils/storage';
import Input from '../ui/Input';

export default function HistoryTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useQueryState('history_start');
  const [endDate, setEndDate] = useQueryState('history_end');
  const [expanded, setExpanded] = useState<Record<number, { q: boolean; a: boolean }>>({});

  const loadHistory = async () => {
    const historyDir = storage.getChatHistoryDir();
    if (!historyDir) {
      setError('Configure o diretório de histórico nas configurações primeiro');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: ChatHistoryRequest = {
        history_dir: historyDir,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };

      const response = await api.getChatHistory(request);
      setMessages(response.messages);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR');
  };

  const toggleExpand = (idx: number, which: 'q' | 'a') => {
    setExpanded((s) => {
      const prev = s[idx] || { q: false, a: false };
      return { ...s, [idx]: { ...prev, [which === 'q' ? 'q' : 'a']: !prev[which === 'q' ? 'q' : 'a'] } };
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Inicial
          </label>
          <Input
            type="datetime-local"
            value={startDate || ''}
            onChange={(e) => setStartDate(e.target.value || null)}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Final
          </label>
          <Input
            type="datetime-local"
            value={endDate || ''}
            onChange={(e) => setEndDate(e.target.value || null)}
          />
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Carregando...' : 'Filtrar'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border  text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-500 py-8">
            Nenhuma mensagem encontrada no período selecionado.
          </div>
        )}

        {messages.map((msg, idx) => {
          const qExpanded = expanded[idx]?.q || false;
          const aExpanded = expanded[idx]?.a || false;
          const qText = msg.question || '';
          const aText = msg.answer || '';
          return (
            <div key={idx} className="border border-gray-700/40 rounded-lg p-4">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg">{msg.title}</h3>
                  <p className="text-xs text-gray-400">{formatDate(msg.timestamp)}</p>
                </div>
              </div>

              <div className="mb-3">
                <div className="bg-blue-900/30 border-l-4 border-blue-600 p-3 rounded">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-blue-300 mb-1">Pergunta:</p>
                    {qText.length > 250 && (
                      <button
                        onClick={() => toggleExpand(idx, 'q')}
                        className="text-sm text-blue-300 hover:underline ml-2"
                        aria-label={qExpanded ? 'Recolher pergunta' : 'Expandir pergunta'}
                      >
                        {qExpanded ? '▾' : '▸'}
                      </button>
                    )}
                  </div>
                  <p className="text-gray-200 whitespace-pre-wrap">
                    {qExpanded ? qText : qText.length > 250 ? `${qText.slice(0, 250)}...` : qText}
                  </p>
                </div>
              </div>

              <div>
                <div className="bg-slate-900/40 border-l-4 border-slate-700 p-3 rounded">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-slate-200 mb-1">Resposta:</p>
                    {aText.length > 250 && (
                      <button
                        onClick={() => toggleExpand(idx, 'a')}
                        className="text-sm text-slate-200 hover:underline ml-2"
                        aria-label={aExpanded ? 'Recolher resposta' : 'Expandir resposta'}
                      >
                        {aExpanded ? '▾' : '▸'}
                      </button>
                    )}
                  </div>
                  <div className="text-gray-200 whitespace-pre-wrap">
                    {aExpanded ? aText : aText.length > 250 ? `${aText.slice(0, 250)}...` : aText}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

