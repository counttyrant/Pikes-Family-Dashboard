import { useState, useMemo, type ReactNode } from 'react';
import { GripHorizontal, Palette, Maximize2, Minimize2 } from 'lucide-react';

const WIDGET_COLOR_PRESETS = [
  { label: 'Theme default', value: '' },
  { label: 'Transparent', value: 'transparent' },
  { label: 'Glass', value: 'rgba(255, 255, 255, 0.05)' },
  { label: 'Smoke', value: 'rgba(0, 0, 0, 0.3)' },
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

/** Parse rgba string and return [r, g, b, a] or null */
function parseRgba(val: string): [number, number, number, number] | null {
  const m = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1];
}

/** Build rgba string */
function toRgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

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
  const [isExpanded, setIsExpanded] = useState(false);

  const bgColor = widgetColor || 'var(--theme-card, rgba(30, 41, 59, 0.7))';
  const isTransparent = widgetColor === 'transparent' || (!!widgetColor && parseRgba(widgetColor)?.[3] === 0);

  // Current opacity for slider (0-100)
  const currentOpacity = useMemo(() => {
    if (!widgetColor || widgetColor === 'transparent') return 0;
    const parsed = parseRgba(widgetColor);
    return parsed ? Math.round(parsed[3] * 100) : 70;
  }, [widgetColor]);

  return (
    <>
    <div
      className={`
        rounded-2xl backdrop-blur-xl
        p-4 flex flex-col min-h-0 h-full relative overflow-hidden group
        ${isTransparent ? '' : 'border shadow-lg shadow-black/20'}
        ${editMode ? 'ring-1' : ''}
        ${className}
      `}
      style={{
        backgroundColor: bgColor,
        ...(isTransparent ? {} : { borderColor: 'color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, transparent)' }),
        ...(editMode ? { '--tw-ring-color': 'color-mix(in srgb, var(--theme-accent, #3b82f6) 40%, transparent)' } as React.CSSProperties : {}),
      }}
    >
      {/* Full-screen expand button */}
      <button
        onClick={() => setIsExpanded(true)}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/20 opacity-0 group-hover:opacity-100 hover:bg-black/40 transition-all z-10"
        title="Full screen"
      >
        <Maximize2 size={14} />
      </button>

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
                onClick={() => { onColorChange(preset.value); }}
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
          {/* Opacity slider */}
          {widgetColor && widgetColor !== '' && widgetColor !== 'transparent' && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-[0.6rem] text-white/50 w-12">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={currentOpacity}
                  onChange={(e) => {
                    const parsed = parseRgba(widgetColor);
                    if (parsed) {
                      const newAlpha = +e.target.value / 100;
                      onColorChange(toRgba(parsed[0], parsed[1], parsed[2], Math.round(newAlpha * 100) / 100));
                    }
                  }}
                  className="flex-1 h-1 accent-blue-500 cursor-pointer"
                />
                <span className="text-[0.6rem] text-white/50 w-7 text-right">{currentOpacity}%</span>
              </div>
            </div>
          )}
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

    {/* Full-screen overlay */}
    {isExpanded && (
      <div className="fixed inset-0 z-50 p-4 flex flex-col" style={{ backgroundColor: bgColor }}>
        <button
          onClick={() => setIsExpanded(false)}
          className="absolute top-4 right-4 p-2 rounded-lg bg-black/30 hover:bg-black/50 transition-colors z-10"
          title="Exit full screen"
        >
          <Minimize2 size={20} />
        </button>
        <h2
          className="text-sm font-semibold uppercase tracking-widest mb-2 select-none"
          style={{ color: 'color-mix(in srgb, var(--theme-accent-light, #60a5fa) 50%, rgba(255,255,255,0.4))' }}
        >
          {title}
        </h2>
        <div className="flex-1 overflow-auto mt-4">{children}</div>
      </div>
    )}
    </>
  );
}
