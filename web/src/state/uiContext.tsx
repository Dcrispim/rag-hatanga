import React, { createContext, useContext, useReducer } from 'react';

type ChatMessage = {
  filename: string;
  title: string;
  question: string;
  answer: string;
  timestamp: string;
};

type State = {
  ui: { darkMode: boolean; leftOpen: boolean; rightOpen: boolean };
  config: { baseDir: string; chatHistoryDir: string; retrieverK: number; chatSpan: number };
  prompt: { question: string; generatedMarkdown: string | null; loadingPrompt: boolean; error?: string | null };
  history: { items: ChatMessage[]; loadingHistory: boolean };
  index: { loadingIndex: boolean; indexOutput?: string | null };
  browse: { browseLoading: boolean; items?: any[]; currentPath?: string | null };
  save: { loadingSave: boolean };
};

const initialState: State = {
  ui: { darkMode: true, leftOpen: true, rightOpen: true },
  config: { baseDir: '', chatHistoryDir: '', retrieverK: 16, chatSpan: 2 },
  prompt: { question: '', generatedMarkdown: null, loadingPrompt: false, error: null },
  history: { items: [], loadingHistory: false },
  index: { loadingIndex: false, indexOutput: null },
  browse: { browseLoading: false, items: [], currentPath: null },
  save: { loadingSave: false },
};

type Action =
  | { type: 'setConfig'; payload: Partial<State['config']> }
  | { type: 'setQuestion'; payload: string }
  | { type: 'setGenerated'; payload: string | null }
  | { type: 'setLoadingPrompt'; payload: boolean }
  | { type: 'setHistory'; payload: ChatMessage[] }
  | { type: 'setLoadingHistory'; payload: boolean }
  | { type: 'setIndexOutput'; payload: string | null }
  | { type: 'setLoadingIndex'; payload: boolean }
  | { type: 'setSaveLoading'; payload: boolean }
  | { type: 'toggleRight'; payload?: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setConfig':
      return { ...state, config: { ...state.config, ...action.payload } };
    case 'setQuestion':
      return { ...state, prompt: { ...state.prompt, question: action.payload } };
    case 'setGenerated':
      return { ...state, prompt: { ...state.prompt, generatedMarkdown: action.payload } };
    case 'setLoadingPrompt':
      return { ...state, prompt: { ...state.prompt, loadingPrompt: action.payload } };
    case 'setHistory':
      return { ...state, history: { ...state.history, items: action.payload } };
    case 'setLoadingHistory':
      return { ...state, history: { ...state.history, loadingHistory: action.payload } };
    case 'setIndexOutput':
      return { ...state, index: { ...state.index, indexOutput: action.payload } };
    case 'setLoadingIndex':
      return { ...state, index: { ...state.index, loadingIndex: action.payload } };
    case 'setSaveLoading':
      return { ...state, save: { ...state.save, loadingSave: action.payload } };
    case 'toggleRight':
      return { ...state, ui: { ...state.ui, rightOpen: action.payload ?? !state.ui.rightOpen } };
    default:
      return state;
  }
}

const UIContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <UIContext.Provider value={{ state, dispatch }}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}

