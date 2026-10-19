import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Author } from '@/components/ui/author';
import { Button } from '@/components/ui/button';
import { Problem, Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useT } from '@/i18n';
import { plans, type PlanVersionSummary } from '@/lib/api';
import { formatWhen } from '@/lib/utils';
import { SIDE_PANEL } from './side-panel';

/**
 * The plan as it was at earlier moments, to go back to.
 *
 * One is kept before every batch an agent writes, so an agent's change can be
 * taken back whole, and whenever somebody saves one. Restoring keeps the plan
 * as it is now first, so a restore can be undone the same way.
 */
export function VersionsPanel({
  planId,
  canEdit,
  onClose,
}: {
  planId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [versions, setVersions] = useState<PlanVersionSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [label, setLabel] = useState('');
  const [restoring, setRestoring] = useState<PlanVersionSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      plans
        .versions(planId)
        .then(setVersions)
        .catch((cause: unknown) => setError(cause)),
    [planId],
  );
  useEffect(() => void load(), [load]);

  const act = async (run: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    try {
      await run();
      setError(null);
      await load();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const what = (version: PlanVersionSummary): string =>
    version.label ??
    (version.reason === 'before-agent'
      ? t.plan.versions.beforeAgent
      : version.reason === 'before-restore'
        ? t.plan.versions.beforeRestore
        : t.plan.versions.saved);

  return (
    <aside className={SIDE_PANEL}>
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <h2 className="text-sm font-medium text-ink">{t.plan.versions.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-6 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
          <span className="sr-only">{t.common.close}</span>
        </button>
      </div>

      {canEdit ? (
        <form
          className="flex gap-2 border-b border-rule p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void act(async () => {
              await plans.saveVersion(planId, label.trim() === '' ? null : label.trim());
              setLabel('');
            });
          }}
        >
          <Input
            aria-label={t.plan.versions.labelHint}
            placeholder={t.plan.versions.labelHint}
            maxLength={80}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="h-8 text-xs"
          />
          <Button type="submit" size="sm" variant="primary" disabled={busy}>
            {t.plan.versions.save}
          </Button>
        </form>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error !== null ? (
          <div className="p-3">
            <Problem error={error} />
          </div>
        ) : null}
        {versions === null ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : versions.length === 0 ? (
          <p className="p-3 text-xs text-ink-muted">{t.plan.versions.empty}</p>
        ) : (
          <ul>
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex items-start gap-2 border-b border-rule/60 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1 text-xs leading-snug">
                  <p className="truncate font-medium text-ink">{what(version)}</p>
                  <p className="truncate text-ink-muted">
                    <Author by={version.by} /> · {formatWhen(version.at)} ·{' '}
                    {t.plan.titleBlock.nodeCount(version.nodes)}
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setRestoring(version)}
                  >
                    {t.plan.versions.restore}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={t.plan.versions.restoreTitle}
        description={t.plan.versions.restoreDescription}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRestoring(null)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              const version = restoring;
              setRestoring(null);
              if (version !== null) void act(() => plans.restoreVersion(planId, version.id));
            }}
          >
            {t.plan.versions.restore}
          </Button>
        </div>
      </Modal>
    </aside>
  );
}
