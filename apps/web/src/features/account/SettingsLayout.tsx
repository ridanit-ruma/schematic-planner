import { NavLink, Outlet } from 'react-router';

import { cn } from '@/lib/utils';

const TABS = [
  { to: '/settings', label: 'Account', end: true },
  { to: '/settings/agents', label: 'Agents', end: false },
] as const;

/** Your account and the keys your agents hold — both belong to you, not to a workspace. */
export function SettingsLayout() {
  return (
    <>
      <nav className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-2xl gap-1 px-6">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              // `end` on the index tab so only the longest match lights up.
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'border-b-2 px-2 py-2.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-accent text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </>
  );
}
