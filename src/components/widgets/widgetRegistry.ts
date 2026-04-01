import {
  Clock as ClockIcon,
  Cloud,
  CalendarDays,
  Timer,
  StickyNote,
  ListChecks,
  CheckSquare,
  Sparkles,
  ChefHat,
  type LucideIcon,
} from 'lucide-react';

export interface WidgetDefinition {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultLayout: { w: number; h: number };
  minW?: number;
  minH?: number;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'clock',
    label: 'Clock',
    description: 'Current time and date',
    icon: ClockIcon,
    defaultLayout: { w: 4, h: 3 },
    minW: 2,
    minH: 2,
  },
  {
    id: 'weather',
    label: 'Weather',
    description: 'Current conditions & 5-day forecast',
    icon: Cloud,
    defaultLayout: { w: 4, h: 3 },
    minW: 3,
    minH: 2,
  },
  {
    id: 'countdown',
    label: 'Upcoming',
    description: 'Countdown timers for events',
    icon: Timer,
    defaultLayout: { w: 4, h: 3 },
    minW: 3,
    minH: 2,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Week view with Google Calendar sync',
    icon: CalendarDays,
    defaultLayout: { w: 12, h: 5 },
    minW: 6,
    minH: 3,
  },
  {
    id: 'chores',
    label: 'Chores',
    description: 'Assign and track household chores',
    icon: ListChecks,
    defaultLayout: { w: 4, h: 4 },
    minW: 3,
    minH: 3,
  },
  {
    id: 'todos',
    label: 'To-Do List',
    description: 'Simple task checklist',
    icon: CheckSquare,
    defaultLayout: { w: 3, h: 4 },
    minW: 2,
    minH: 3,
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Free-form sticky notes',
    icon: StickyNote,
    defaultLayout: { w: 3, h: 3 },
    minW: 2,
    minH: 2,
  },
  {
    id: 'activities',
    label: 'Activities',
    description: 'Kid-friendly activity planner with fun icons',
    icon: Sparkles,
    defaultLayout: { w: 4, h: 5 },
    minW: 3,
    minH: 3,
  },
  {
    id: 'recipes',
    label: 'Recipes',
    description: 'Quick recipe finder with voice input',
    icon: ChefHat,
    defaultLayout: { w: 4, h: 4 },
    minW: 3,
    minH: 3,
  },
];

export function getWidgetDef(id: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}
