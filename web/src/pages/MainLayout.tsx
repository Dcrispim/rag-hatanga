import { useState } from 'react';
import ResizableLayout from '../ui/ResizableLayout';
import HistoryTab from '../components/HistoryTab';
import PromptTab from '../components/PromptTab';
import ConfigTab from '../components/ConfigTab';
import { ToastProvider } from '../ui/Toast';
import { UIProvider } from '../state/uiContext';
import { CogIcon } from 'lucide-react';

export default function MainLayout() {
  const [rightOpen, setRightOpen] = useState(true);

  // Prompt first (left), then History (center)
  const left = (
    <div className="h-full bg-[#0b1220] text-gray-100 p-6">
      <div className="h-full">
        <PromptTab />
      </div>
    </div>
  );

  const center = (
    <div className="h-full text-gray-200 p-4">
      <div className="h-full">
        <HistoryTab />
      </div>
    </div>
  );

  // Config will be rendered as a fixed sidebar (collapsible)
  const right = ( <div className="p-4 overflow-auto h-full">
    <ConfigTab />
  </div>)

  return (
    <ToastProvider>
      <UIProvider>
        <div className="min-h-screen bg-[#071024] text-gray-100">
        <header className="bg-[#0b1220] border-b border-gray-800">
          <div className="w-full px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Ragatanga — Prompt Studio</h1>
           <div className="flex items-center gap-2">
           <div className="text-sm text-gray-400">Dark mode</div>
            {!rightOpen && (
            <button
              onClick={() => setRightOpen(true)}
              className="bg-violet-600 text-white px-2 py-1 rounded-l-md z-50"
              title="Abrir Configurações"
            >
              <CogIcon/>
            </button>
          )}
           </div>
          </div>
        </header>

        <main className="w-full px-0 py-0 h-[calc(100vh-88px)]">
          <ResizableLayout left={left} center={center} right={right} initialLeftPct={55} initialRightPct={60}  showColapes={['right','center','left']} />
       
        </main>
      </div>
      </UIProvider>
    </ToastProvider>
  );
}
