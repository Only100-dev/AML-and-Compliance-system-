// ─── Phase 5: Multi-Theme Design System ──────────────────────────────────────

export type ThemeId = 'convertease' | 'anarisk-navy' | 'anarisk-dual' | 'mega-lotus';

export interface DesignTheme {
  id: ThemeId;
  name: string;
  description: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarAccent: string;
  accentColor: string;
  accentBg: string;
  hasSecondarySidebar: boolean;
  greeting: string;
  cardBg: string;
  headerBg: string;
  footerText: string;
}

export const THEMES: Record<ThemeId, DesignTheme> = {
  convertease: {
    id: 'convertease',
    name: 'ConvertEase (Default)',
    description: 'Dark slate with emerald accents — standard IC-OS theme',
    sidebarBg: 'bg-slate-900',
    sidebarText: 'text-white',
    sidebarAccent: 'bg-sidebar-accent',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-500/20',
    hasSecondarySidebar: false,
    greeting: 'Welcome back, Compliance Manager',
    cardBg: 'bg-slate-900/60 border-slate-700/50',
    headerBg: 'bg-slate-900',
    footerText: 'IC-OS v5.0 • UAE Data Residency Enforced • me-central-1',
  },
  'anarisk-navy': {
    id: 'anarisk-navy',
    name: 'Anarisk Navy',
    description: 'Deep navy with blue accents — Anarisk enterprise theme',
    sidebarBg: 'bg-[#1E293B]',
    sidebarText: 'text-slate-100',
    sidebarAccent: 'bg-[#334155]',
    accentColor: 'text-blue-400',
    accentBg: 'bg-blue-500/20',
    hasSecondarySidebar: false,
    greeting: 'Hello, Elux Space',
    cardBg: 'bg-[#1E293B]/80 border-[#334155]',
    headerBg: 'bg-[#1E293B]',
    footerText: 'Anarisk Navy • Enterprise Risk Analytics • PDPL Compliant',
  },
  'anarisk-dual': {
    id: 'anarisk-dual',
    name: 'Anarisk Dual',
    description: 'Navy + secondary sidebar — Anarisk dual-panel theme',
    sidebarBg: 'bg-[#1E293B]',
    sidebarText: 'text-slate-100',
    sidebarAccent: 'bg-[#334155]',
    accentColor: 'text-blue-400',
    accentBg: 'bg-blue-500/20',
    hasSecondarySidebar: true,
    greeting: 'Hello, Elux Space',
    cardBg: 'bg-[#1E293B]/80 border-[#334155]',
    headerBg: 'bg-[#1E293B]',
    footerText: 'Anarisk Dual • Dual-Panel Risk Analytics • PDPL Compliant',
  },
  'mega-lotus': {
    id: 'mega-lotus',
    name: 'Mega Lotus',
    description: 'Light theme with blue accents — Mega Lotus clean design',
    sidebarBg: 'bg-white border-r border-slate-200',
    sidebarText: 'text-slate-800',
    sidebarAccent: 'bg-slate-100',
    accentColor: 'text-blue-600',
    accentBg: 'bg-blue-100',
    hasSecondarySidebar: false,
    greeting: 'Welcome to Mega Lotus',
    cardBg: 'bg-white border-slate-200',
    headerBg: 'bg-white border-b border-slate-200',
    footerText: 'Mega Lotus • Insurance Platform • UAE Compliant',
  },
};

export const THEME_IDS: ThemeId[] = ['convertease', 'anarisk-navy', 'anarisk-dual', 'mega-lotus'];
