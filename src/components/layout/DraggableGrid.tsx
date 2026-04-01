import { useMemo, useEffect, type ReactNode } from 'react';
import {
  Responsive,
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from 'react-grid-layout';
import type { WidgetLayout } from '../../types';

/* -------------------------------------------------------------------------- */
/*  Inline CSS for react-grid-layout                                          */
/*  (package styles may not auto-import with all bundlers)                    */
/* -------------------------------------------------------------------------- */

const GRID_CSS = `
.react-grid-layout {
  position: relative;
  transition: height 200ms ease;
}
.react-grid-item {
  transition: all 200ms ease;
  transition-property: left, top, width, height;
}
.react-grid-item img {
  pointer-events: none;
  user-select: none;
}
.react-grid-item.cssTransforms {
  transition-property: transform, width, height;
}
.react-grid-item.resizing {
  transition: none;
  z-index: 1;
  will-change: width, height;
}
.react-grid-item.react-draggable-dragging {
  transition: none;
  z-index: 3;
  will-change: transform;
}
.react-grid-item.dropping {
  visibility: hidden;
}
.react-grid-item > .react-resizable-handle {
  position: absolute;
  width: 44px;
  height: 44px;
  touch-action: none;
}
.react-grid-item > .react-resizable-handle::after {
  content: "";
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 8px;
  height: 8px;
  border-right: 2px solid rgba(255, 255, 255, 0.5);
  border-bottom: 2px solid rgba(255, 255, 255, 0.5);
}
.react-resizable-handle-se {
  bottom: 0;
  right: 0;
  cursor: se-resize;
}
.react-grid-item.react-grid-placeholder {
  background: rgba(59, 130, 246, 0.2);
  border: 2px dashed rgba(59, 130, 246, 0.5);
  border-radius: 0.75rem;
  opacity: 1;
}
/* Prevent scroll/swipe interference when dragging widgets */
.rgl-edit-mode .react-grid-item {
  touch-action: none;
}
`;

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */

interface DraggableGridProps {
  layouts: WidgetLayout[];
  onLayoutChange: (layouts: WidgetLayout[]) => void;
  children: ReactNode;
  editMode: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function DraggableGrid({
  layouts,
  onLayoutChange,
  children,
  editMode,
}: DraggableGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  // Inject styles once
  useEffect(() => {
    const id = 'rgl-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = GRID_CSS;
    document.head.appendChild(style);
  }, []);

  // Build responsive layouts — same layout for every breakpoint
  const gridLayouts = useMemo(() => {
    const layout: LayoutItem[] = layouts.map((l) => ({
      ...l,
      static: !editMode,
    }));
    return {
      lg: layout,
      md: layout,
      sm: layout,
      xs: layout,
      xxs: layout,
    };
  }, [layouts, editMode]);

  // Convert Layout (readonly LayoutItem[]) → WidgetLayout[]
  const handleLayoutChange = (currentLayout: Layout) => {
    onLayoutChange(
      currentLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative no-swipe ${editMode ? 'rgl-edit-mode ring-2 ring-blue-500/30 ring-inset rounded-xl' : ''}`}
    >
      {editMode && (
        <div className="absolute top-2 left-2 z-20 bg-blue-600/80 text-white text-xs font-medium px-2 py-1 rounded-md backdrop-blur-sm pointer-events-none">
          Edit Mode &mdash; drag &amp; resize widgets
        </div>
      )}
      {mounted && (
        <Responsive
          className="layout"
          width={width}
          layouts={gridLayouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          dragConfig={{ enabled: editMode }}
          resizeConfig={{ enabled: editMode }}
          onLayoutChange={handleLayoutChange}
          margin={[12, 12] as const}
          containerPadding={[12, 12] as const}
        >
          {children}
        </Responsive>
      )}
    </div>
  );
}
