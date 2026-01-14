import { useState, useEffect } from 'react';
import { useQueryState } from 'nuqs';
import { api, ChatHistoryRequest } from '../services/api';
import { storage } from '../utils/storage';

export default function HistoryTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useQueryState('history_start');
  const [endDate, setEndDate] = useQueryState('history_end');

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

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Inicial
          </label>
          <input
            type="datetime-local"
            value={startDate || ''}
            onChange={(e) => setStartDate(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Final
          </label>
          <input
            type="datetime-local"
            value={endDate || ''}
            onChange={(e) => setEndDate(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-500 py-8">
            Nenhuma mensagem encontrada no período selecionado.
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4">
            <div className="mb-2">
              <h3 className="font-bold text-lg">{msg.title}</h3>
              <p className="text-xs text-gray-500">{formatDate(msg.timestamp)}</p>
            </div>
            
            <div className="mb-3">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                <p className="font-semibold text-sm text-blue-800 mb-1">Pergunta:</p>
                <p className="text-gray-800 whitespace-pre-wrap">{msg.question}</p>
              </div>
            </div>
            
            <div>
              <div className="bg-gray-50 border-l-4 border-gray-400 p-3 rounded">
                <p className="font-semibold text-sm text-gray-800 mb-1">Resposta:</p>
                <div className="text-gray-700 whitespace-pre-wrap">{msg.answer}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

