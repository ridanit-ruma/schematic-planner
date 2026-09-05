import { LogOut, Plug } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, useParams } from 'react-router';

import { Wordmark } from './Wordmark';
import { Button } from './ui/button';
import { ThemeToggle } from './ui/theme';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const { workspaceId } = useParams();
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-11 shrink-0 items-center gap-5 border-b border-rule bg-surface px-4">
        <Link to="/" className="text-ink">
          <Wordmark />
        </Link>

        {workspaceId !== undefined ? (
          <nav className="flex items-center gap-1">
            <Tab to={`/w/${workspaceId}`} end>
              Plans
            </Tab>
            <Tab to={`/w/${workspaceId}/agents`}>
              <Plug className="size-3.5" />
              Agents
            </Tab>
          </nav>
        ) : null}

        <div className="flex-1" />

        {user !== null ? <span className="text-xs text-ink-muted">{user.email}</span> : null}
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sign out">
          <LogOut className="size-4" />
        </Button>
      </header>

      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}

/**
 * `end` is set on the index tab so that only the longest matching route lights
 * up. A prefix comparison would leave two tabs active at once.
 */
function Tab({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end ?? false}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-medium transition-colors',
          isActive
            ? 'border-accent text-ink'
            : 'border-transparent text-ink-muted hover:text-ink',
        )
      }
    >
      {children}
    </NavLink>
  );
}
