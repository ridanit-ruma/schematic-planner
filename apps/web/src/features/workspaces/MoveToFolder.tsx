import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Problem } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useT } from '@/i18n';
import { plans, type FolderSummary, type PlanSummary } from '@/lib/api';

/** The project's own level, which is not a folder and so has no id of its own. */
const TOP = 'top';

/**
 * Filing a plan in a drawer, from a list rather than by dragging it.
 *
 * The rail beside the canvas moves a plan by drag and drop, which is direct and
 * needs the rail to be open and both places to be on screen at once. Neither is
 * true on the project index, and a plan that can only be filed from one screen
 * is a plan most people never file.
 */
export function MoveToFolder({
  plan,
  projectId,
  folders,
  onDone,
  onCancel,
}: {
  plan: PlanSummary | null;
  projectId: string;
  folders: readonly FolderSummary[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState<string>(TOP);
  const [error, setError] = useState<unknown>(null);
  const t = useT();
  const m = t.workspaces.moveToFolder;

  // Opening this for a different plan has to start from where that plan actually
  // is, not from wherever the last one was put.
  useEffect(() => {
    setChosen(plan?.folderId ?? TOP);
    setError(null);
  }, [plan]);

  const move = async (): Promise<void> => {
    if (plan === null) return;
    try {
      await plans.move(plan.id, projectId, chosen === TOP ? null : chosen);
      onDone();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Modal
      open={plan !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={m.title(plan?.title ?? '')}
      description={m.description}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void move();
        }}
      >
        {error === null ? null : <Problem error={error} />}
        <Field label={m.folder}>
          {(id) => (
            <Select
              id={id}
              value={chosen}
              options={[
                { value: TOP, label: m.topLevel, hint: m.topLevelHint },
                // By path, because folders nest and two of them may share a name.
                ...folders.map((folder) => ({ value: folder.id, label: folder.path.join(' / ') })),
              ]}
              onChange={setChosen}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary">
            {m.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
