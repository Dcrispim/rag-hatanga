import { useEffect } from 'react';
import { useQueryState } from 'nuqs';
import ChatTab from './components/ChatTab';
import PromptTab from './components/PromptTab';
import ConfigTab from './components/ConfigTab';
import { storage } from './utils/storage';

type Tab = 'chat' | 'prompt' | 'config';

export default function App() {
  const [tabStr, setTabStr] = useQueryState('tab');
  
  // Converter tab de/para string
  const currentTab: Tab = (['chat', 'prompt', 'config'].includes(tabStr || '') 
    ? tabStr as Tab 
    : 'chat');
  const setCurrentTab = (tab: Tab) => {
    setTabStr(tab === 'chat' ? null : tab);
  };

  useEffect(() => {
    const saved = storage.getBaseDir();
    if (!saved) {
      // Se não há BASE_DIR configurado, abrir aba de configurações
      setCurrentTab('config');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">Ragatanga RAG</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setCurrentTab('chat')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'chat'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setCurrentTab('prompt')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'prompt'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Gerar Prompt
            </button>
            <button
              onClick={() => setCurrentTab('config')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'config'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Configurações
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow p-6 h-[calc(100vh-200px)]">
          {currentTab === 'chat' && <ChatTab />}
          {currentTab === 'prompt' && <PromptTab />}
          {currentTab === 'config' && <ConfigTab />}
        </div>
      </div>
    </div>
  );
}

