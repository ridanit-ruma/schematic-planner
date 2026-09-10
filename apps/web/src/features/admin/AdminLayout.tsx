import { NavLink, Outlet } from 'react-router';

import { cn } from '@/lib/utils';

/**
 * The instance rather than a workspace: who is on it, who may join, and what it
 * is being used for. Reached only by whoever owns it, which is whoever made the
 * first account.
 */
export function AdminLayout() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Instance</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Everything about this deployment rather than about one workspace.
      </p>

      <div className="mt-4 flex items-center gap-1 overflow-x-auto border-b border-rule">
        <Tab to="/admin" end>
          Usage
        </Tab>
        <Tab to="/admin/invitations">Invitations</Tab>
        <Tab to="/admin/people">People</Tab>
      </div>

      <div className="mt-6">
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
        '-mb-px shrink-0 border-b-2 px-2.5 pb-2 text-sm transition-colors',
        'border-transparent text-ink-muted hover:text-ink',
        '[&.active]:border-accent [&.active]:font-medium [&.active]:text-ink',
      )}
    >
      {children}
    </NavLink>
  );
}
