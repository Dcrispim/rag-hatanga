import { useRef, useState, useEffect } from 'react';
import { api, BrowseItem } from '../services/api';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface PathInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  history?: string[];
  onSelectFromHistory?: (path: string) => void;
  selectDirectory?: boolean;
  selectFile?: boolean;
}

export default function PathInput({
  label,
  value,
  onChange,
  placeholder,
  description,
  history = [],
  onSelectFromHistory,
  selectDirectory = true,
  selectFile = false,
}: PathInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pathSegments, setPathSegments] = useState<string[]>([]);
  const [previousPathSegments, setPreviousPathSegments] = useState<string[]>([]);
  const [currentItems, setCurrentItems] = useState<BrowseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootPath, setRootPath] = useState<string>('');
  const [currentDir, setCurrentDir] = useState<string>('');
  const [openCurrentInput, setOpenCurrentInput] = useState(false);
  const isRevertingRef = useRef(false);
  const [showHistory, setShowHistory] = useState(false);

  // Inicializar rootPath quando o modal abre
  useEffect(() => {
    if (isModalOpen && !rootPath) {
      // Tentar usar o valor atual como root, ou usar um path padrão
      if (value) {
        // Se value é um path absoluto, usar o diretório pai
        // Se não, usar o próprio value como root
        setRootPath(value);
      } else {
        // Usar home directory como padrão (será ajustado pelo backend)
        setRootPath('/');
      }
    }
  }, [isModalOpen, value, rootPath]);

  // Carregar itens quando pathSegments ou rootPath mudarem
  useEffect(() => {
    if (isModalOpen && !isRevertingRef.current) {
      loadItems();
    }
    // Resetar flag de reversão após processar
    if (isRevertingRef.current) {
      isRevertingRef.current = false;
    }
  }, [isModalOpen, pathSegments, rootPath]);

  const getCurrentPath = (): string => {
    if (pathSegments.length === 0) {
      return rootPath || '/';
    }
    if (rootPath.startsWith('/')) {
      return rootPath + '/' + pathSegments.join('/');
    }
    return pathSegments.join('/');
  };

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const currentPath = getCurrentPath();

      const response = await api.browse({
        type: selectFile ? 'file' : 'dir',
        path: currentPath || '/',
      });

      setCurrentItems(response.items);
      // Atualizar rootPath se necessário (primeira vez)
      if (!rootPath && response.current_path) {
        setRootPath(response.current_path);
      }
      // Se carregou com sucesso, atualizar previousPathSegments
      setPreviousPathSegments([...pathSegments]);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar diretório');
      setCurrentItems([]);
      // Reverter pathSegments para o estado anterior em caso de erro
      // Usar ref para evitar loop infinito
      isRevertingRef.current = true;
      setPathSegments([...previousPathSegments]);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseClick = async () => {
    // Abrir modal ao invés de usar File System Access API
    setIsModalOpen(true);
    // Inicializar pathSegments a partir do value atual
    let initialSegments: string[] = [];
    if (value) {
      // Se value é um path absoluto, extrair o diretório pai
      if (value.startsWith('/')) {
        const segments = value.split('/').filter(s => s);
        // Se termina com / ou não tem extensão, é um diretório
        if (value.endsWith('/') || !value.includes('.')) {
          initialSegments = segments;
          setRootPath('/');
        } else {
          // É um arquivo, remover o último segmento
          initialSegments = segments.slice(0, -1);
          setRootPath('/');
        }
      } else {
        // Path relativo
        const segments = value.split('/').filter(s => s);
        if (value.includes('.')) {
          // É um arquivo
          initialSegments = segments.slice(0, -1);
        } else {
          // É um diretório
          initialSegments = segments;
        }
        setRootPath('');
      }
    } else {
      initialSegments = [];
      setRootPath('/');
    }
    setPathSegments(initialSegments);
    setPreviousPathSegments(initialSegments);
  };

  const handleItemClick = (item: BrowseItem) => {
    if (item.is_directory) {
      // Navegar para o diretório - salvar estado anterior antes de mudar
      setPreviousPathSegments([...pathSegments]);
      setPathSegments([...pathSegments, item.name]);
    } else {
      // Selecionar arquivo
      let finalPath: string;
      const newSegments = [...pathSegments, item.name];
      if (rootPath.startsWith('/')) {
        finalPath = rootPath + '/' + newSegments.join('/');
      } else {
        finalPath = newSegments.join('/');
      }
      onChange(finalPath);
      setIsModalOpen(false);
    }
  };

  const handleNavigateUp = () => {
    if (pathSegments.length > 0) {
      setPreviousPathSegments([...pathSegments]);
      setPathSegments(pathSegments.slice(0, -1));
    }
  };

  const handleSelectCurrentDir = () => {
    if (selectDirectory) {
      let finalPath: string;
      if (pathSegments.length === 0) {
        finalPath = rootPath || '/';
      } else {
        if (rootPath.startsWith('/')) {
          finalPath = rootPath + '/' + pathSegments.join('/');
        } else {
          finalPath = pathSegments.join('/');
        }
      }
      onChange(finalPath);
      setIsModalOpen(false);
    }
  };

  const handleConfirmCurrentDir = async () => {
    const name = currentDir.trim();
    if (!name) {
      setOpenCurrentInput(false);
      setCurrentDir('');
      return;
    }
    const parentPath = getCurrentPath();
    setOpenCurrentInput(false);
    setCurrentDir('');
    setError(null);
    setLoading(true);
    try {
      const targetPath = parentPath.endsWith('/') ? parentPath + name : parentPath + '/' + name;
      const exists = currentItems.some((item) => item.is_directory && item.name === name);
      if (!exists) {
        try {
          await api.browse({ type: 'dir', path: targetPath });
        } catch {
          await api.createDirectory({ parent_path: parentPath, name });
        }
      }
      setPreviousPathSegments([...pathSegments]);
      setPathSegments([...pathSegments, name]);
    } catch (err: any) {
      setError(err.message || 'Erro ao acessar/criar diretório');
      isRevertingRef.current = true;
      setPathSegments([...previousPathSegments]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      if (selectDirectory) {
        const firstFile = files[0];
        if (firstFile.webkitRelativePath) {
          const directoryName = firstFile.webkitRelativePath.split('/')[0];
          onChange(directoryName);
        }
      } else if (selectFile) {
        onChange(files[0].name);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          <Button
            type="button"
            onClick={handleBrowseClick}
            className="px-3 py-2"
            variant="ghost"
            title={selectDirectory ? 'Selecionar diretório' : 'Selecionar arquivo'}
          >
            {selectDirectory ? '📁' : '📄'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            {...(selectDirectory && { webkitdirectory: '', directory: '' })}
            {...(selectFile && !selectDirectory && {})}
          />
        </div>
        {description && (
          <p className="mt-1 text-xs text-gray-500">
            {description}
          </p>
        )}
        {showHistory && (
          <div className="mt-2">
            <p className="text-xs text-gray-600 mb-1">Histórico:</p>
            <div className="flex flex-wrap gap-1">
              {history.map((path, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectFromHistory?.(path)}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {path}
                </button>
              ))}
             
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="mt-2 text-xs text-gray-500 hover:text-gray-700"
        >
          {showHistory ? 'Ocultar histórico' : 'Mostrar histórico'}
        </button>
      </div>

      {/* Modal de navegação */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                {selectDirectory ? 'Selecionar Diretório' : 'Selecionar Arquivo'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Breadcrumb */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => {
                    setPreviousPathSegments([...pathSegments]);
                    setPathSegments([]);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {rootPath || '/'}
                </button>
                {pathSegments.map((segment, idx) => (
                  <span key={idx} className="flex items-center gap-2">
                    <span className="text-gray-400">/</span>
                    <button
                      onClick={() => {
                        setPreviousPathSegments([...pathSegments]);
                        setPathSegments(pathSegments.slice(0, idx + 1));
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {segment}
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-2">
                  {openCurrentInput ? (
                    <>
                      <Input
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => {
                          if (!currentDir.trim()) {
                            setOpenCurrentInput(false);
                            setCurrentDir('');
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleConfirmCurrentDir();
                          }
                          if (e.key === 'Escape') {
                            setOpenCurrentInput(false);
                            setCurrentDir('');
                          }
                        }}
                        type="text"
                        value={currentDir}
                        onChange={(e) => setCurrentDir(e.target.value)}
                        placeholder="Nome da pasta"
                        className="w-40"
                        autoFocus
                      />
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmCurrentDir();
                        }}
                        variant="primary"
                        className="px-2 py-1 text-sm"
                      >
                        Criar diretório
                      </Button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenCurrentInput(true);
                      }}
                      className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                      title="Criar novo diretório"
                    >
                      + Nova pasta
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading && (
                <div className="text-center py-8 text-gray-500">
                  Carregando...
                </div>
              )}
              {error && (
                <div className="text-center py-8 text-red-500">
                  {error}
                </div>
              )}
              {!loading && !error && currentItems.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Diretório vazio
                </div>
              )}
              {!loading && !error && currentItems.length > 0 && (
                <div className="space-y-1">
                  {pathSegments.length > 0 && (
                    <button
                      onClick={handleNavigateUp}
                      className="w-full text-left px-4 py-2 rounded hover:bg-gray-100 flex items-center gap-2"
                    >
                      <span className="text-xl">📂</span>
                      <span className="text-blue-600">.. (voltar)</span>
                    </button>
                  )}
                  {currentItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleItemClick(item)}
                      className="w-full text-left px-4 py-2 rounded hover:bg-gray-100 flex items-center gap-2"
                    >
                      <span className="text-xl">
                        {item.is_directory ? '📂' : '📄'}
                      </span>
                      <span className={item.is_directory ? 'text-blue-600' : 'text-gray-700'}>
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {selectDirectory && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSelectCurrentDir}
                  className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Selecionar Diretório Atual
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
