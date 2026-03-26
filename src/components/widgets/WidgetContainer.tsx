import type { ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';

interface WidgetContainerProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function WidgetContainer({
  title,
  children,
  className = '',
  editMode = false,
}: WidgetContainerProps & { editMode?: boolean }) {
  return (
    <div
      className={`
        rounded-2xl border border-white/10
        bg-slate-900/60 backdrop-blur-xl
        shadow-lg shadow-black/20
        p-4 flex flex-col min-h-0 h-full relative overflow-hidden
        ${editMode ? 'ring-1 ring-blue-400/30' : ''}
        ${className}
      `}
    >
      {editMode && (
        <div className="drag-handle absolute top-0 left-0 right-0 h-10 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center bg-gradient-to-b from-blue-500/20 to-transparent">
          <GripHorizontal size={16} className="text-blue-300/70" />
        </div>
      )}
      <h2 className="text-[0.65rem] font-semibold uppercase tracking-widest text-white/40 mb-3 select-none">
        {title}
      </h2>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
