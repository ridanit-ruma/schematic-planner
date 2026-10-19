import { validatePlan, type Diagnostic, type PlanDoc, type Vocabulary } from '@schematic/schema';
import { CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { useMemo } from 'react';

import { useT, type Messages } from '@/i18n';
import { cn } from '@/lib/utils';
import { SIDE_PANEL } from './side-panel';

const ICONS = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;
const TONES = { error: 'text-danger', warning: 'text-status-progress', info: 'text-ink-faint' };

function sentence(t: Messages, one: Diagnostic, title: (slug: string) => string): string {
  const said = t.plan.diagnostics.rules;
  const [first = ''] = one.nodes;
  switch (one.rule) {
    case 'dependency-cycle':
      return said.dependencyCycle([...one.nodes, first].map(title).join(' → '));
    case 'isolated-node':
      return said.isolatedNode(title(first));
    case 'outside-flow':
      return said.outsideFlow(title(first));
    case 'unknown-kind':
      return said.unknownKind(title(first), one.params['kind'] ?? '');
    case 'unknown-status':
      return said.unknownStatus(title(first), one.params['status'] ?? '');
  }
}

/**
 * What the plan's structure has wrong with it, worked out here as it changes —
 * the same rules the agents' `validate` tool reads. It only says; a finding is
 * fixed on the canvas or in the inspector like any other edit.
 */
export function DiagnosticsPanel({
  plan,
  vocabulary,
  onShow,
  onClose,
}: {
  /** The whole document: the canvas leaves out the containment it draws as boxes. */
  plan: Pick<PlanDoc, 'nodes' | 'edges'>;
  vocabulary: Vocabulary;
  /** Takes the reader to a node the finding is about. */
  onShow: (slug: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const result = useMemo(() => validatePlan(plan, vocabulary), [plan, vocabulary]);
  const titles = useMemo(() => new Map(plan.nodes.map((node) => [node.slug, node.title])), [plan]);
  const title = (slug: string): string => titles.get(slug) ?? slug;

  return (
    <aside className={SIDE_PANEL}>
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <h2 className="text-sm font-medium text-ink">{t.plan.diagnostics.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-6 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
          <span className="sr-only">{t.common.close}</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {result.diagnostics.length === 0 ? (
          <p className="p-3 text-xs text-ink-muted">{t.plan.diagnostics.clean(result.checked)}</p>
        ) : (
          <ul>
            {result.diagnostics.map((one) => {
              const Icon = ICONS[one.severity];
              return (
                <li
                  key={`${one.rule}:${one.nodes.join(',')}`}
                  className="border-b border-rule/60 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => one.nodes[0] !== undefined && onShow(one.nodes[0])}
                    className="flex w-full gap-2 px-3 py-2 text-left text-xs leading-snug text-ink hover:bg-surface-2"
                  >
                    <Icon
                      aria-label={t.plan.diagnostics.severity[one.severity]}
                      className={cn('mt-px size-3.5 shrink-0', TONES[one.severity])}
                    />
                    {sentence(t, one, title)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
