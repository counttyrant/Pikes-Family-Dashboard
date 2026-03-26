import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Type, Trash2, Undo2 } from 'lucide-react';
import { syncLocalStorageToCloud } from '../../services/cloudSync';

const TEXT_KEY = 'pfd-notes';
const DRAW_KEY = 'pfd-notes-drawing';

export function Notes() {
  const [mode, setMode] = useState<'text' | 'draw'>('text');
  const [text, setText] = useState(() => localStorage.getItem(TEXT_KEY) ?? '');
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const strokeColor = useRef('#ffffff');
  const strokeWidth = useRef(3);
  const undoStack = useRef<string[]>([]);

  const handleTextChange = (value: string) => {
    setText(value);
    clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => {
      localStorage.setItem(TEXT_KEY, value);
      syncLocalStorageToCloud(TEXT_KEY).catch(() => {});
    }, 500);
  };

  // Load saved drawing
  const loadDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const saved = localStorage.getItem(DRAW_KEY);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = saved;
    }
  }, []);

  // Resize canvas to fit container
  useEffect(() => {
    if (mode !== 'draw') return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      // Save current content
      const data = canvas.toDataURL();
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        // Restore content
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, width, height);
        img.src = data;
      }
    };

    resize();
    loadDrawing();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mode, loadDrawing]);

  const saveDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    localStorage.setItem(DRAW_KEY, canvas.toDataURL());
    syncLocalStorageToCloud(DRAW_KEY).catch(() => {});
  }, []);

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStack.current.push(canvas.toDataURL());
    if (undoStack.current.length > 20) undoStack.current.shift();
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    pushUndo();
    isDrawing.current = true;
    lastPoint.current = getPos(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing.current || !lastPoint.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = strokeColor.current;
    ctx.lineWidth = strokeWidth.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPoint.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
    lastPoint.current = null;
    saveDrawing();
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width, height } = canvas.getBoundingClientRect();
      ctx.drawImage(img, 0, 0, width, height);
      saveDrawing();
    };
    img.src = prev;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    pushUndo();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveDrawing();
  };

  const penColors = ['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899'];

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Mode toggle + tools */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setMode('text')}
          className={`p-1.5 rounded-lg transition-colors ${mode === 'text' ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'}`}
          title="Text mode"
        >
          <Type size={14} />
        </button>
        <button
          onClick={() => setMode('draw')}
          className={`p-1.5 rounded-lg transition-colors ${mode === 'draw' ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'}`}
          title="Draw mode"
        >
          <Pencil size={14} />
        </button>

        {mode === 'draw' && (
          <>
            <div className="w-px h-4 bg-white/10 mx-1" />
            {penColors.map((c) => (
              <button
                key={c}
                onClick={() => { strokeColor.current = c; }}
                className="w-4 h-4 rounded-full transition-transform hover:scale-125"
                style={{ backgroundColor: c, boxShadow: strokeColor.current === c ? '0 0 0 2px white' : 'none' }}
              />
            ))}
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button onClick={handleUndo} className="p-1 text-white/40 hover:text-white/80 transition-colors" title="Undo">
              <Undo2 size={14} />
            </button>
            <button onClick={handleClear} className="p-1 text-white/40 hover:text-red-400 transition-colors" title="Clear">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Content area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {mode === 'text' ? (
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Type notes here…"
            className="w-full h-full bg-transparent text-white/90 text-sm resize-none
                       focus:outline-none placeholder-white/30 leading-relaxed"
          />
        ) : (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 touch-none cursor-crosshair"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        )}
      </div>
    </div>
  );
}
