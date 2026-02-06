import { useState, useEffect, useRef } from 'react';
import { useQueryState } from 'nuqs';
import ReactMarkdown from 'react-markdown';
import { api, ChatRequest, ChatHistoryRequest } from '../services/api';
import { storage } from '../utils/storage';
import { ChevronDownIcon } from 'lucide-react';


const BOX_MAX_LENGTH = 200;

interface Message {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
  isTyping?: boolean;
}

export default function ChatTab() {
  const [question, setQuestion] = useQueryState('chat_question');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carregar histórico ao montar o componente
  useEffect(() => {
    loadHistory();
  }, []);

  // Scroll para o final quando mensagens mudarem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = async () => {
    const historyDir = storage.getChatHistoryDir();
    if (!historyDir) {
      return; // Sem histórico configurado, não é erro
    }

    try {
      const request: ChatHistoryRequest = {
        history_dir: historyDir,
      };

      const response = await api.getChatHistory(request);
      
      // Converter histórico para formato de mensagens
      // Inverter ordem: mais antigas primeiro, mais recentes por último
      const historyMessages: Message[] = response.messages
        .slice()
        .reverse()
        .map((msg, idx) => ({
          id: `history-${idx}`,
          question: msg.question,
          answer: msg.answer,
          timestamp: msg.timestamp,
        }));

      setMessages(historyMessages);

      // Verificar se a última pergunta do histórico é a mesma da query param
      if (question && historyMessages.length > 0) {
        const lastMessage = historyMessages[historyMessages.length - 1];
        if (lastMessage.question === question) {
          // A resposta já está no histórico, não precisa fazer nada
          return;
        }
      }
    } catch (err: any) {
      // Erro ao carregar histórico não é crítico, apenas log
      console.error('Erro ao carregar histórico:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const baseDir = storage.getBaseDir();
    if (!baseDir) {
      setError('Configure o BASE_DIR nas configurações primeiro');
      return;
    }

    const currentQuestion = (question || '').trim();
    if (!currentQuestion) {
      return;
    }

    setLoading(true);
    setError(null);

    // Verificar se a última mensagem tem a mesma pergunta
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const isSameQuestion = lastMessage?.question === currentQuestion;

    if (!isSameQuestion) {
      // Nova pergunta: adicionar como mensagem enviada com "digitando..."
      const newMessage: Message = {
        id: `pending-${Date.now()}`,
        question: currentQuestion,
        answer: '',
        timestamp: new Date().toISOString(),
        isTyping: true,
      };
      setMessages(prev => [...prev, newMessage]);
    }

    try {
      const request: ChatRequest = {
        question: currentQuestion,
        base_dir: baseDir,
      };

      // Requisição síncrona (sem webhook)
      const response = await api.chat(request);
      
      if (response.answer) {
        // Atualizar a última mensagem com a resposta
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].question === currentQuestion) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              answer: response.answer || '',
              isTyping: false,
            };
          }
          return updated;
        });

        // Recarregar histórico para garantir sincronização
        setTimeout(() => {
          loadHistory();
        }, 1000);
      } else {
        setError('Resposta vazia recebida');
        // Remover mensagem de "digitando..." se não houve resposta
        setMessages(prev => prev.filter(msg => !msg.isTyping || msg.question !== currentQuestion));
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pergunta');
      // Remover mensagem de "digitando..." em caso de erro
      setMessages(prev => prev.filter(msg => !msg.isTyping || msg.question !== currentQuestion));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Área de mensagens */}
      <div className="flex-1 overflow-auto mb-4 space-y-4 p-4 bg-gray-50 rounded-lg">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-500 py-8">
            Nenhuma mensagem ainda. Faça sua primeira pergunta!
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* Mensagem do usuário (pergunta) */}
            <div className="flex justify-end">
              <QuestionBox question={msg.question} timestamp={msg.timestamp} />
            </div>

            {/* Resposta ou "digitando..." */}
            {msg.isTyping ? (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-gray-200 rounded-lg px-4 py-2">
                  <p className="text-gray-600 italic">digitando...</p>
                </div>
              </div>
            ) : msg.answer ? (
              <AnswerBox answer={msg.answer} timestamp={msg.timestamp} />
            ) : null}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Formulário de entrada */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={question || ''}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Digite sua pergunta..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !(question || '').trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}


const AnswerBox = ({ answer, timestamp }: { answer: string, timestamp: string }) => {
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const [colapsed, setColapsed] = useState(false);
  const toggleColapsed = () => {
    setColapsed(!colapsed);
  };
  return (  
    <div className="flex justify-start">
    <div className="max-w-[80%] bg-white border border-gray-200 rounded-lg px-4 py-2 prose prose-sm max-w-none">
      <ReactMarkdown
        components={{
          p: ({ children }: any) => <p className="mb-2 last:mb-0 text-gray-800">{children}</p>,
          h1: ({ children }: any) => <h1 className="text-lg font-bold mb-2 text-gray-900">{children}</h1>,
          h2: ({ children }: any) => <h2 className="text-base font-bold mb-2 text-gray-900">{children}</h2>,
          h3: ({ children }: any) => <h3 className="text-sm font-bold mb-1 text-gray-900">{children}</h3>,
          ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 text-gray-800">{children}</ul>,
          ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 text-gray-800">{children}</ol>,
          li: ({ children }: any) => <li className="mb-1">{children}</li>,
          code: ({ children }: any) => <code className="bg-gray-100 px-1 rounded text-xs text-gray-900">{children}</code>,
          pre: ({ children }: any) => <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mb-2 text-gray-900">{children}</pre>,
          strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
          em: ({ children }: any) => <em className="italic">{children}</em>,
          blockquote: ({ children }: any) => <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-2">{children}</blockquote>,
        }}
      >
          {colapsed ? answer : answer.slice(0, BOX_MAX_LENGTH) + '...'}
        </ReactMarkdown>
        <p className="text-xs text-gray-500 mt-2">{formatDate(timestamp)}</p>
        <button onClick={toggleColapsed} className="text-xs text-gray-500 mt-2">
          <ChevronDownIcon className={`w-4 h-4 ${colapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};

const QuestionBox = ({ question, timestamp }: { question: string, timestamp: string }) => {
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const [colapsed, setColapsed] = useState(false);
  const toggleColapsed = () => {
    setColapsed(!colapsed);
  };  
  return (
    <div className="flex justify-end">
    <div className="max-w-[80%] bg-blue-600 text-white rounded-lg px-4 py-2 prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        components={{
          p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
          h1: ({ children }: any) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
          h2: ({ children }: any) => <h2 className="text-base font-bold mb-2">{children}</h2>,
          h3: ({ children }: any) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
          ul: ({ children }: any) => <ul className="list-disc list-inside mb-2">{children}</ul>,
          ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
          li: ({ children }: any) => <li className="mb-1">{children}</li>,
          code: ({ children }: any) => <code className="bg-blue-700 px-1 rounded text-xs">{children}</code>,
          pre: ({ children }: any) => <pre className="bg-blue-700 p-2 rounded text-xs overflow-x-auto mb-2">{children}</pre>,
          strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
          em: ({ children }: any) => <em className="italic">{children}</em>,
        }}
      >
          {colapsed ? question : question.slice(0, BOX_MAX_LENGTH) + '...'}
      </ReactMarkdown>
      <p className="text-xs text-blue-100 mt-2">{formatDate(timestamp)}</p>
      <button onClick={toggleColapsed} className="text-xs text-blue-100 mt-2">
        <ChevronDownIcon className={`w-4 h-4 ${colapsed ? 'rotate-180' : ''}`} />
      </button>
      </div>
    </div>
  );
};

export { AnswerBox, QuestionBox };