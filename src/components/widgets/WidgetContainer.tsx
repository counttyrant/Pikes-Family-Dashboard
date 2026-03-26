import { useState, type ReactNode } from 'react';
import { GripHorizontal, Palette } from 'lucide-react';

const WIDGET_COLOR_PRESETS = [
  { label: 'Theme default', value: '' },
  { label: 'Slate', value: 'rgba(30, 41, 59, 0.7)' },
  { label: 'Blue', value: 'rgba(30, 58, 138, 0.6)' },
  { label: 'Purple', value: 'rgba(88, 28, 135, 0.6)' },
  { label: 'Green', value: 'rgba(20, 83, 45, 0.6)' },
  { label: 'Red', value: 'rgba(127, 29, 29, 0.6)' },
  { label: 'Amber', value: 'rgba(120, 53, 15, 0.6)' },
  { label: 'Teal', value: 'rgba(19, 78, 74, 0.6)' },
  { label: 'Pink', value: 'rgba(131, 24, 67, 0.6)' },
  { label: 'Rose', value: 'rgba(136, 19, 55, 0.6)' },
  { label: 'Indigo', value: 'rgba(49, 46, 129, 0.6)' },
];

interface WidgetContainerProps {
  title: string;
  children: ReactNode;
  className?: string;
  editMode?: boolean;
  widgetColor?: string;
  onColorChange?: (color: string) => void;
}

export function WidgetContainer({
  title,
  children,
  className = '',
  editMode = false,
  widgetColor,
  onColorChange,
}: WidgetContainerProps) {
  const [showPalette, setShowPalette] = useState(false);

  const bgColor = widgetColor || 'var(--theme-card, rgba(30, 41, 59, 0.7))';

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
        backgroundColor: bgColor,
        borderColor: 'color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, transparent)',
        ...(editMode ? { '--tw-ring-color': 'color-mix(in srgb, var(--theme-accent, #3b82f6) 40%, transparent)' } as React.CSSProperties : {}),
      }}
    >
      {editMode && (
        <div
          className="drag-handle absolute top-0 left-0 right-0 h-10 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent), transparent)' }}
        >
          <GripHorizontal size={16} style={{ color: 'var(--theme-accent-light, #60a5fa)', opacity: 0.7 }} />
          {onColorChange && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowPalette(!showPalette); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
              title="Widget color"
            >
              <Palette size={14} style={{ color: 'var(--theme-accent-light, #60a5fa)', opacity: 0.7 }} />
            </button>
          )}
        </div>
      )}

      {/* Color palette popover */}
      {editMode && showPalette && onColorChange && (
        <div
          className="absolute top-10 left-1/2 -translate-x-1/2 z-20 rounded-xl p-2 shadow-xl border"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1.5 flex-wrap max-w-[200px]">
            {WIDGET_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => { onColorChange(preset.value); setShowPalette(false); }}
                className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                  (widgetColor || '') === preset.value ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{
                  backgroundColor: preset.value || 'var(--theme-card, rgba(30, 41, 59, 0.7))',
                }}
                title={preset.label}
              />
            ))}
          </div>
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
