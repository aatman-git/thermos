import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Map', icon: MapIcon },
  { path: '/priority', label: 'Priority', icon: AlertIcon },
  { path: '/analytics', label: 'Analytics', icon: ChartIcon },
  { path: '/intelligence', label: 'Intel', icon: IntelIcon },
  { path: '/investigator', label: 'AI Inv', icon: BrainIcon },
  { path: '/system', label: 'System', icon: GearIcon },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <>
      {/* Desktop Left Icon Rail */}
      <nav className="hidden md:flex flex-col items-center w-[72px] min-h-0 bg-white/95 border-r border-[var(--color-border)] py-4 gap-2 shrink-0 backdrop-blur-sm z-20">
        {NAV_ITEMS.map((item) => {
          const isActive = item.path === '/dashboard'
            ? location.pathname === '/dashboard' || location.pathname === '/map'
            : location.pathname === item.path;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`
                relative flex flex-col items-center justify-center w-[56px] h-[56px] rounded-[var(--radius-lg)]
                transition-all duration-200 group
                ${isActive
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)] shadow-[inset_0_0_0_1px_rgba(245,197,24,0.25)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] font-medium'
                }
              `}
              title={item.label}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator-desktop"
                  className="absolute left-0 top-[12px] bottom-[12px] w-[3px] rounded-r-full bg-[var(--color-accent)]"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon size={20} active={isActive} />
              <span className="mt-1 text-scale-xs leading-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Mobile Bottom Navigation Bar (<768px, down to 375px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white/95 border-t border-[var(--color-border)] flex items-center justify-around z-40 backdrop-blur-md px-1 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        {NAV_ITEMS.map((item) => {
          const isActive = item.path === '/dashboard'
            ? location.pathname === '/dashboard' || location.pathname === '/map'
            : location.pathname === item.path;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`
                relative flex flex-col items-center justify-center py-1 px-2 rounded-[var(--radius-md)] flex-1
                transition-colors duration-150
                ${isActive
                  ? 'text-[var(--color-text-primary)] font-bold'
                  : 'text-[var(--color-text-secondary)] font-medium'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator-mobile"
                  className="absolute top-0 left-2 right-2 h-[2px] rounded-full bg-[var(--color-accent)]"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon size={18} active={isActive} />
              <span className="text-[10px] leading-tight mt-0.5">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}

/* --- Icon components — crisp SVG --- */
function MapIcon({ size = 20, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function AlertIcon({ size = 20, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ChartIcon({ size = 20, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IntelIcon({ size = 20, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function BrainIcon({ size = 20, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
      <line x1="9" y1="22" x2="15" y2="22" />
      <line x1="10" y1="19" x2="14" y2="19" />
    </svg>
  );
}

function GearIcon({ size = 20, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

