import React, { createContext, useContext, useState } from 'react';

type Toast = { id: string; message: string; type?: 'success' | 'error' | 'info' };

const ToastContext = createContext<{
  push: (t: Omit<Toast, 'id'>) => void;
}>({
  push: () => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((s) => [...s, { id, ...t }]);
    setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id));
    }, 3500);
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm px-4 py-2 rounded shadow-lg text-sm ${
              t.type === 'success' ? 'bg-green-600 text-white' : t.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

