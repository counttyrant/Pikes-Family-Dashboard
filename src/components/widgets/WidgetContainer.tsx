import type { ReactNode } from 'react';

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
        p-4 flex flex-col min-h-0 h-full
        ${className}
      `}
    >
      {editMode && <div className="drag-handle absolute top-0 left-0 right-0 h-6 cursor-grab active:cursor-grabbing" />}
      <h2 className="text-[0.65rem] font-semibold uppercase tracking-widest text-white/40 mb-3 select-none">
        {title}
      </h2>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
