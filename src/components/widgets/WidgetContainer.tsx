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
        rounded-2xl border backdrop-blur-xl
        shadow-lg shadow-black/20
        p-4 flex flex-col min-h-0 h-full relative overflow-hidden
        ${editMode ? 'ring-1' : ''}
        ${className}
      `}
      style={{
        backgroundColor: 'var(--theme-card, rgba(30, 41, 59, 0.7))',
        borderColor: 'color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, transparent)',
        ...(editMode ? { '--tw-ring-color': 'color-mix(in srgb, var(--theme-accent, #3b82f6) 40%, transparent)' } as React.CSSProperties : {}),
      }}
    >
      {editMode && (
        <div
          className="drag-handle absolute top-0 left-0 right-0 h-10 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center"
          style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent), transparent)' }}
        >
          <GripHorizontal size={16} style={{ color: 'var(--theme-accent-light, #60a5fa)', opacity: 0.7 }} />
        </div>
      )}
      <h2
        className="text-[0.65rem] font-semibold uppercase tracking-widest mb-3 select-none"
        style={{ color: 'color-mix(in srgb, var(--theme-accent-light, #60a5fa) 50%, rgba(255,255,255,0.4))' }}
      >
        {title}
      </h2>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
