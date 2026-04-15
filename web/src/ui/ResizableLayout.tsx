import { ArrowDownCircleIcon, ArrowLeftCircleIcon, ArrowRightCircleIcon, ArrowUpCircleIcon, Columns3, Maximize2, XIcon } from 'lucide-react';
import React, { useState, useRef } from 'react';

interface ResizableLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  initialLeftPct?: number;
  initialRightPct?: number;
  showColapes?: ('left' | 'right' | 'center')[];
  vertical?: boolean;
}

export default function ResizableLayout({
  left,
  center,
  right,
  initialLeftPct = 25,
  initialRightPct = 25,
  vertical = false,
}: ResizableLayoutProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftPct, setLeftPct] = useState(initialLeftPct);
  const [rightPct, setRightPct] = useState(initialRightPct);
  const dragging = useRef<'left' | 'right' | null>(null);
  const [lastResize, setLastResize] = useState<'center' | 'left' | 'right' | null>('center');

  const onMouseMove = (e: MouseEvent) => {
    const container = containerRef.current;
    if (!container || !dragging.current) return;
    const rect = container.getBoundingClientRect();
    const total = rect.width;
    const x = e.clientX - rect.left;

    if (dragging.current === 'left') {
      const newLeft = Math.max(10, Math.min(70, (x / total) * 100));
      setLeftPct(newLeft);
    } else if (dragging.current === 'right') {
      const newRight = Math.max(10, Math.min(70, ((rect.right - e.clientX) / total) * 100));
      setRightPct(newRight);
    }
  };

  const onMouseUp = () => {
    dragging.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  const startDrag = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = side;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const setSize = (side: 'center' | 'left' | 'right', size: number) => {
    if (side === 'center') {

      const centerSize = 100 - size;
      const sideSize = centerSize / 2;
      setLeftPct(sideSize);
      setRightPct(sideSize);
      setLastResize('center');
    } else if (side === 'left') {
      setLeftPct(size);
      setLastResize('left');
    } else if (side === 'right') {
      setRightPct(size);
      setLastResize('right');
    }
  };

  const colapseSide = (side: 'left' | 'right' | 'center') => {
    if (side === 'left') {
      setLeftPct(0);
      setRightPct(50);
    } else if (side === 'right') {
      setRightPct(0);
      setLeftPct(50);
    } else if (side === 'center') {

      setSize('left', 50);
      setSize('right', 50);
    }
  };

  const expandSide = (side: 'left' | 'right' | 'center') => {
    if (side === 'left') {
      setLeftPct(50);
      if (lastResize !== 'center') {
        setRightPct(50);
      }
    } else if (side === 'right') {
      setRightPct(50);
      if (lastResize !== 'center') {
        setLeftPct(50);
      }
    } else if (side === 'center') {
      if (lastResize !== 'left') {
        setSize('left', 50);
        setSize('right', 0);
      }
      if (lastResize !== 'right') {
        setSize('right', 50);
        setSize('left', 0);
      }
    }
  };

  const onResize = (side: 'left' | 'right' | 'center') => {
    if (side === 'left') {
      setSize('left', 50);
      setSize('right', 25);
      
    } else if (side === 'right') {
      setSize('right', 50);
      setSize('left', 25);
     
    } else if (side === 'center') {
      setLeftPct(25);
      setRightPct(25);
    }
  };

  const handleFullscreen = (side: 'left' | 'right' | 'center') => {
    if (side === 'left') {
      setLeftPct(100);
      setRightPct(0);
    } else if (side === 'right') {
      setRightPct(100);
      setLeftPct(0);
    } else if (side === 'center') {
      setSize('left', 0);
      setSize('right', 0);
    }

  };

  const centerPct = Math.max(0, 100 - leftPct - rightPct);

  return (
    <div
      ref={containerRef}
      className={`resizable-layout w-full h-full flex select-none ${vertical ? 'flex-col' : 'flex-row'}`}
    >

      <div
        style={{ width: vertical ? 'auto' : `${leftPct}%`, height: vertical ? `${leftPct}%` : 'auto' }}
        className="resizable-layout-pane h-full overflow-auto relative"
        onDoubleClick={(e) => {
          expandSide('left');
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <SideContent vertical={vertical} onClose={() => colapseSide('left')} onResize={() => onResize('left')} onFullscreen={() => handleFullscreen('left')}>
          {left}
        </SideContent>
      </div>

      <div
        onMouseDown={startDrag('left')}
        className="w-1 cursor-col-resize bg-transparent hover:bg-gray-600/20"
        title="Redimensionar"
      />

      <div style={{
        width: vertical ? 'auto' : `${centerPct}%`,
        height: vertical ? `${centerPct}%` : 'auto',
        borderTop: vertical && leftPct > 0 ? '2px solid' : 'none',
        borderBottom: vertical && rightPct > 0 ? '2px solid' : 'none',
        borderLeft: !vertical && leftPct > 0 ? '2px solid' : 'none',
        borderRight: !vertical && rightPct > 0 ? '2px solid' : 'none',

      }}
        className="resizable-layout-pane h-full overflow-auto relative z-1000 relative "
        onDoubleClick={(e) => {
          expandSide('center');
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <SideContent vertical={vertical} onClose={() => colapseSide('center')} onResize={() => onResize('center')} onFullscreen={() => handleFullscreen('center')}>
          {center}
        </SideContent>
        {
          vertical ? (<>
            {rightPct === 0 && <div className="absolute top-0 left-0 z-1000 w-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300" onClick={() => colapseSide('left')}>
              <ArrowUpCircleIcon className={`size-8 text-white`} />
            </div>}
            {leftPct === 0 && <div className="absolute bottom-0 left-0 z-1000 w-full flex items-center justify-center  opacity-0 hover:opacity-100 transition-opacity duration-300" onClick={() => colapseSide('right')}>
              <ArrowDownCircleIcon className={`size-8 text-white`} />
            </div>}
          </>) : (
            <>
              {rightPct === 0 && <div className="absolute top-0 right-4 z-1000 h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300" onClick={() => colapseSide('left')}>
                <ArrowRightCircleIcon className={`size-8 text-white`} />
              </div>}
              {leftPct === 0 && <div className="absolute top-0 left-4 z-1000 h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300" onClick={() => colapseSide('right')}>
                <ArrowLeftCircleIcon className={`size-8 text-white`} />
              </div>}
            </>
          )
        }
      </div>

      <div
        onMouseDown={startDrag('right')}
        className="w-1 cursor-col-resize bg-transparent hover:bg-gray-600/20"
        title="Redimensionar"
      />


      <div
        style={{ width: vertical ? 'auto' : `${rightPct}%`, height: vertical ? `${rightPct}%` : 'auto' }}
        className="resizable-layout-pane h-full overflow-auto border-l border-gray-700/40 relative"
        onDoubleClick={(e) => {
          expandSide('right');
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <SideContent vertical={vertical} onClose={() => colapseSide('right')} onResize={() => onResize('right')} onFullscreen={() => handleFullscreen('right')}>
          {right}
        </SideContent>
      </div>
    </div>
  );
}



const SideContent = ({ children, vertical, onClose, onResize, onFullscreen }: { children: React.ReactNode, vertical: boolean, onClose: () => void, onResize: () => void, onFullscreen: () => void }) => {
  return (
    <div className={`invisible-scrollbar h-full overflow-auto relative ${vertical ? 'flex-col' : 'flex-row'}`}>
      <div className="w-full h-5 mt-2 mr-2 flex items-center gap-2 justify-end"> 
        <XIcon className="w-4 h-4 text-white cursor-pointer"  xlinkTitle="Fechar" onClick={onClose}/>
        <Columns3 className="w-4 h-4 text-white"  xlinkTitle="Redimensionar" onClick={() => onResize()}/>
        <Maximize2 className="w-4 h-4 text-white"  xlinkTitle="Maximizar" onClick={() => onFullscreen()}/>
        </div>
      <div className="w-full h-auto">{children}</div>
    </div>
  );
};

