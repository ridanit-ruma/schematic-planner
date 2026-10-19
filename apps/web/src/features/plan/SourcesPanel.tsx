import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Problem, Spinner } from '@/components/ui/feedback';
import { Pill, UNKNOWN_COLOR, paletteVar } from '@/components/ui/vocabulary';
import { useT } from '@/i18n';
import { plans, type PlanProvenance } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SIDE_PANEL } from './side-panel';

/**
 * Which plans this one was written from, and which were written from it.
 *
 * Whether a source still resolves is worked out by the server on every read
 * and never stored, so a source that is trashed shows as missing and comes
 * back the moment it is restored. The list is set by an agent with
 * `set_plan_sources`; here it is only read.
 */
export function SourcesPanel({ planId, onClose }: { planId: string; onClose: () => void }) {
  const t = useT();
  const [found, setFound] = useState<{ planId: string; provenance: PlanProvenance } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    plans
      .provenance(planId)
      .then((provenance) => live && setFound({ planId, provenance }))
      .catch((cause: unknown) => live && setError(cause));
    return () => {
      live = false;
    };
  }, [planId]);

  const provenance = found?.planId === planId ? found.provenance : null;

  return (
    <aside className={SIDE_PANEL}>
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <h2 className="text-sm font-medium text-ink">{t.plan.sources.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-6 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
          <span className="sr-only">{t.common.close}</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {error !== null ? (
          <Problem error={error} />
        ) : provenance === null ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <section>
              <h3 className="rail-heading mb-1.5">{t.plan.sources.from}</h3>
              {provenance.sources.length === 0 ? (
                <p className="text-xs text-ink-muted">{t.plan.sources.noneFrom}</p>
              ) : (
                <ul className="space-y-1">
                  {provenance.sources.map((source) => (
                    <li key={source.id} className="flex items-center gap-2 text-sm">
                      {source.state === 'missing' || source.title === null ? (
                        // A title the server held back is a plan this reader cannot open.
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-ink-muted',
                            source.state === 'missing' && 'line-through',
                          )}
                        >
                          {source.title ??
                            (source.state === 'missing'
                              ? t.plan.sources.gone
                              : t.plan.sources.elsewhere)}
                        </span>
                      ) : (
                        <Link
                          to={`/plan/${source.id}`}
                          className="min-w-0 flex-1 truncate text-ink hover:underline"
                        >
                          {source.title}
                          {source.folder === null ? null : (
                            <span className="text-ink-faint"> · {source.folder}</span>
                          )}
                        </Link>
                      )}
                      {source.state === 'ok' ? null : (
                        <Pill
                          color={source.state === 'missing' ? paletteVar('red') : UNKNOWN_COLOR}
                          className="shrink-0"
                        >
                          {t.plan.sources.state[source.state]}
                        </Pill>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="rail-heading mb-1.5">{t.plan.sources.into}</h3>
              {provenance.sourcedBy.length === 0 ? (
                <p className="text-xs text-ink-muted">{t.plan.sources.noneInto}</p>
              ) : (
                <ul className="space-y-1">
                  {provenance.sourcedBy.map((plan) => (
                    <li key={plan.id} className="truncate text-sm">
                      <Link to={`/plan/${plan.id}`} className="text-ink hover:underline">
                        {plan.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
