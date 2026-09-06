import { ArrowLeft, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Spinner } from '@/components/ui/feedback';
import { Tooltip } from '@/components/ui/tooltip';
import { plans, type PlanNavigation } from '@/lib/api';
import { cn } from '@/lib/utils';

const COLLAPSED_KEY = 'plan-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The rest of the workspace, beside the plan you are reading. A plan is
 * addressed on its own so that its link survives a rename, which leaves the
 * canvas with no way back to its neighbours — this is that way back.
 */
export function PlanSidebar({ planId }: { planId: string }) {
  const [nav, setNav] = useState<PlanNavigation | null>(null);
  const [failed, setFailed] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    plans
      .navigation(planId)
      .then((next) => {
        if (!live) return;
        setNav(next);
        setFailed(false);
        // Only the project you are in starts open — opening all of them would
        // bury the current plan on a large workspace — and anything you opened
        // by hand stays open as you move between plans.
        setOpen((current) => new Set([...current, next.projectId]));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [planId]);

  const toggleCollapsed = (): void => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* A remembered preference is a convenience, not a requirement. */
    }
  };

  if (collapsed) {
    return (
      <aside className="flex w-9 shrink-0 flex-col items-center gap-1 border-r border-rule bg-surface py-2">
        <Tooltip content="Show plans" side="right">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="grid size-7 place-items-center rounded-[2px] text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <PanelLeftOpen className="size-4" />
            <span className="sr-only">Show plans</span>
          </button>
        </Tooltip>
        {/* The way out stays reachable with the rail folded away. */}
        {nav === null ? null : (
          <Tooltip content={`Leave for ${nav.workspace.name}`} side="right">
            <Link
              to={`/workspace/${nav.workspace.slug}`}
              className="grid size-7 place-items-center rounded-[2px] text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              <span className="sr-only">{`Leave for ${nav.workspace.name}`}</span>
            </Link>
          </Tooltip>
        )}
      </aside>
    );
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-rule bg-surface">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-rule px-2">
        {nav === null ? (
          <span className="flex-1 truncate px-1 text-xs text-ink-faint">
            {failed ? 'Plans unavailable' : 'Loading'}
          </span>
        ) : (
          <Link
            to={`/workspace/${nav.workspace.slug}`}
            title={`Leave for ${nav.workspace.name}`}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[2px] px-1 py-0.5 text-xs font-medium text-ink hover:bg-surface-2"
          >
            <ArrowLeft className="size-3.5 shrink-0 text-ink-muted" />
            <span className="truncate">{nav.workspace.name}</span>
          </Link>
        )}
        <Tooltip content="Hide plans">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="grid size-6 shrink-0 place-items-center rounded-[2px] text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <PanelLeftClose className="size-4" />
            <span className="sr-only">Hide plans</span>
          </button>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {nav === null ? (
          failed ? null : (
            <div className="grid place-items-center py-6">
              <Spinner />
            </div>
          )
        ) : (
          nav.projects.map((project) => {
            const expanded = open.has(project.id);
            return (
              <div key={project.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() =>
                    setOpen((current) => {
                      const next = new Set(current);
                      if (!next.delete(project.id)) next.add(project.id);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-xs text-ink-muted hover:bg-surface-2 hover:text-ink"
                >
                  {expanded ? (
                    <ChevronDown className="size-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                  <span className="shrink-0 text-2xs text-ink-faint">{project.plans.length}</span>
                </button>

                {expanded ? (
                  project.plans.length === 0 ? (
                    <p className="py-1 pr-2 pl-7 text-2xs text-ink-faint">No plans yet</p>
                  ) : (
                    project.plans.map((plan) => {
                      const current = plan.id === planId;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          aria-current={current ? 'page' : undefined}
                          onClick={() => !current && navigate(`/plan/${plan.id}`)}
                          title={plan.title}
                          className={cn(
                            'flex w-full items-center gap-2 py-1 pr-2 pl-7 text-left text-xs',
                            current
                              ? 'bg-accent-soft font-medium text-ink'
                              : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'h-3 w-0.5 shrink-0',
                              current ? 'bg-accent' : 'bg-transparent',
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {plan.title === '' ? 'Untitled plan' : plan.title}
                          </span>
                        </button>
                      );
                    })
                  )
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
