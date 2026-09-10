import { useState } from 'react';

import { Problem, Spinner } from '@/components/ui/feedback';
import { admin, type Usage } from '@/lib/api';
import { useLiveList } from '@/lib/use-live-list';
import { cn, formatWhen } from '@/lib/utils';

/**
 * What this instance is, in numbers it already knows.
 *
 * Everything here is a count of something that exists or a moment that was
 * recorded. Nothing is sampled, estimated, or kept up to date by a job that
 * could fall behind and quietly lie.
 */
export function UsagePage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<unknown>(null);

  useLiveList(() => {
    admin.usage().then(setUsage).catch(setError);
  }, []);

  if (error !== null) return <Problem error={error} />;
  if (usage === null)
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );

  const { accounts, content, activity, agents, reach, live, storage, busiest } = usage;

  return (
    <div className="space-y-6">
      {/* What is happening now, which is the only part of this screen that is
          not history. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Open plans" value={live.documents} note="right now" />
        <Figure label="Connections" value={live.connections} note="right now" />
        <Figure
          label="Signed in"
          value={reach.sessions}
          note={`${accounts.activeRecently} active in ${usage.recentDays}d`}
        />
        <Figure
          label="Accounts"
          value={accounts.total}
          note={
            accounts.suspended > 0
              ? `${accounts.joinedRecently} new · ${accounts.suspended} suspended`
              : `${accounts.joinedRecently} new in ${usage.recentDays}d`
          }
        />
      </section>

      <Trend usage={usage} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="What has been drawn">
          <Rows
            rows={[
              ['Plans', `${content.plans}`, content.trashedPlans > 0 ? `${content.trashedPlans} in the trash` : ''],
              ['Nodes', `${content.nodes}`, content.plans > 0 ? `${Math.round(content.nodes / content.plans)} a plan on average` : ''],
              ['Connections', `${content.edges}`, ''],
              ['Largest plan', `${content.largestPlan} nodes`, ''],
              ['Workspaces', `${content.workspaces}`, `${content.projects} projects`],
            ]}
          />
        </Panel>

        <Panel title="Agents">
          <Rows
            rows={[
              ['Keys', `${agents.liveKeys}`, agents.keys > agents.liveKeys ? `${agents.keys - agents.liveKeys} revoked` : ''],
              [
                'Changes by agents',
                `${activity.byAgents}`,
                activity.changes > 0
                  ? `${Math.round((activity.byAgents / activity.changes) * 100)}% of everything`
                  : '',
              ],
              ['Share links', `${reach.shares}`, ''],
              ['Invitations open', `${reach.liveInvites}`, ''],
              ['Database', bytes(storage.databaseBytes), ''],
            ]}
          />
          {agents.recent.length === 0 ? null : (
            <div className="mt-3 border-t border-rule pt-3">
              <p className="rail-heading mb-1.5">Last used</p>
              {agents.recent.map((key) => (
                <p key={`${key.by}-${key.name}`} className="flex justify-between gap-3 py-0.5 text-xs">
                  <span className="min-w-0 truncate text-ink">
                    {key.name} <span className="text-ink-faint">· {key.by}</span>
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    {key.lastUsedAt === null ? '—' : formatWhen(key.lastUsedAt)}
                  </span>
                </p>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {busiest.length === 0 ? null : (
        <Panel title="Busiest workspaces">
          <Rows
            rows={busiest.map((workspace) => [
              workspace.name,
              `${workspace.changes} changes`,
              `${workspace.plans} plans`,
            ])}
          />
        </Panel>
      )}
    </div>
  );
}

/**
 * A fortnight of edits, split by who made them.
 *
 * Drawn rather than tabulated because the question it answers is a shape — is
 * this getting used or not — and a column of fourteen numbers does not have a
 * shape. The axis is labelled, because a line with no scale is decoration.
 */
function Trend({ usage }: { usage: Usage }) {
  const days = fortnight(usage.activity.trend, usage.days);
  const peak = Math.max(1, ...days.map((day) => day.people + day.agents));

  return (
    <Panel
      title={`Changes over ${usage.days} days`}
      aside={`${usage.activity.changesRecently} in the last ${usage.recentDays}`}
    >
      <div className="flex items-end gap-1" style={{ height: 96 }}>
        {days.map((day) => {
          const total = day.people + day.agents;
          return (
            <div key={day.day} className="group relative flex flex-1 flex-col justify-end gap-px">
              <span
                className="w-full rounded-t-[2px] bg-collab"
                style={{ height: `${(day.agents / peak) * 84}px` }}
                title={`${day.agents} by agents`}
              />
              <span
                className="w-full rounded-b-[2px] bg-accent"
                style={{ height: `${(day.people / peak) * 84}px` }}
                title={`${day.people} by people`}
              />
              {total === 0 ? <span className="h-px w-full bg-rule-strong" /> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-2xs text-ink-faint">
        <span>{days[0]?.day ?? ''}</span>
        <span className="flex items-center gap-3">
          <Key className="bg-accent">people</Key>
          <Key className="bg-collab">agents</Key>
          <span>peak {peak}</span>
        </span>
        <span>{days.at(-1)?.day ?? ''}</span>
      </div>
    </Panel>
  );
}

function Key({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('size-2 rounded-[1px]', className)} />
      {children}
    </span>
  );
}

/** Days with nothing in them are still days: without them the shape lies. */
function fortnight(
  trend: Usage['activity']['trend'],
  days: number,
): { day: string; people: number; agents: number }[] {
  const byDay = new Map(trend.map((row) => [row.day, row]));
  const out: { day: string; people: number; agents: number }[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const at = new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);
    out.push(byDay.get(at) ?? { day: at, people: 0, agents: 0 });
  }
  return out;
}

function Figure({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-lg border border-rule bg-surface-2 px-3 py-2.5">
      <p className="rail-heading">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{value}</p>
      {note === '' ? null : <p className="text-2xs text-ink-faint">{note}</p>}
    </div>
  );
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-rule bg-surface-2 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        {aside === undefined ? null : <span className="text-xs text-ink-muted">{aside}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: (string | number)[][] }) {
  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <p key={String(row[0])} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate text-ink-muted">{row[0]}</span>
          <span className="flex shrink-0 items-baseline gap-2">
            {row[2] === '' || row[2] === undefined ? null : (
              <span className="text-2xs text-ink-faint">{row[2]}</span>
            )}
            <span className="tabular-nums text-ink">{row[1]}</span>
          </span>
        </p>
      ))}
    </div>
  );
}

/** Beside a total, so a number has a size rather than only a magnitude. */
function bytes(value: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let at = 0;
  let size = value;
  while (size >= 1024 && at < units.length - 1) {
    size /= 1024;
    at += 1;
  }
  return `${size < 10 && at > 0 ? size.toFixed(1) : Math.round(size)} ${units[at]}`;
}
