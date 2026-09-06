import { NavLink, Outlet } from 'react-router';

import { cn } from '@/lib/utils';

/**
 * Your account and the keys your agents hold. Both belong to you rather than to
 * a workspace, so they are one screen with two tabs and not two rows in a rail
 * that changes with the workspace you happen to have open.
 */
export function SettingsLayout() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Account</h1>

      <div className="mt-4 flex items-center gap-1 border-b border-rule">
        <Tab to="/settings" end>
          Account
        </Tab>
        <Tab to="/settings/agents">MCP keys</Tab>
      </div>

      <div className="mt-6 space-y-6">
        <Outlet />
      </div>
    </div>
  );
}

function Tab({ to, end, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink
      to={to}
      end={end ?? false}
      className={cn(
        // The underline sits on the tab rather than in the rule below it, so the
        // active tab reads as attached to what it opens.
        '-mb-px border-b-2 px-2.5 pb-2 text-sm transition-colors',
        'border-transparent text-ink-muted hover:text-ink',
        '[&.active]:border-accent [&.active]:font-medium [&.active]:text-ink',
      )}
    >
      {children}
    </NavLink>
  );
}
