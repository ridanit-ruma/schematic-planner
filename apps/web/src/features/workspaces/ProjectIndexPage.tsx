import { Plus, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { DropdownAction } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { Page } from '@/components/ui/page';
import { RowMenu } from '@/components/ui/row-menu';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { canAdminister, projects as api, type ProjectSummary } from '@/lib/api';
import { useT } from '@/i18n';
import { formatWhen } from '@/lib/utils';
import { useLiveList } from '@/lib/use-live-list';
import { useWorkspace } from './workspace-context';

/** A workspace holds projects; a project holds plans. This is the first level. */
export function ProjectIndexPage() {
  const { current } = useWorkspace();
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const mayDelete = canAdminister(current.role);
  const t = useT();
  const m = t.workspaces;
  const navigate = useNavigate();

  const reload = (): void => {
    api.list(current.id).then(setList).catch(setError);
  };
  useLiveList(reload, [current.id]);

  const create = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    try {
      await api.create(current.id, trimmed, newDescription.trim());
      setName('');
      setNewDescription('');
      setCreating(false);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  const remove = async (project: ProjectSummary): Promise<void> => {
    try {
      await api.remove(project.id);
      setDeleting(null);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  if (error !== null) {
    return (
      <Page title={m.projects.title}>
        <Problem error={error} />
      </Page>
    );
  }
  if (list === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <Page
      title={m.projects.title}
      description={m.projects.description(list.length, current.name)}
      actions={
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          {m.projects.newProject}
        </Button>
      }
    >
      {list.length === 0 ? (
        <Empty
          title={m.projects.empty.title}
          body={m.projects.empty.body}
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              {m.projects.empty.action}
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>{m.projects.project}</TH>
            <TH className="w-24" align="right" hide="md">
              {m.projects.plans}
            </TH>
            <TH className="w-20 sm:w-32" align="right">
              {m.list.updated}
            </TH>
            <TH className="w-10">
              <span className="sr-only">{m.list.actions}</span>
            </TH>
          </THead>
          <tbody>
            {list.map((project) => (
              <TR key={project.id}>
                <TD>
                  <Link
                    to={`/workspace/${current.slug}/project/${project.slug}`}
                    className="block min-w-0"
                  >
                    <span className="block truncate font-medium text-ink">{project.name}</span>
                    {project.description === '' ? null : (
                      <span className="block truncate text-xs text-ink-muted">
                        {project.description}
                      </span>
                    )}
                    <span className="slug block truncate text-ink-faint md:hidden">
                      {m.list.planCount(project.planCount)}
                    </span>
                  </Link>
                </TD>
                <TD align="right" className="slug text-ink-muted" hide="md">
                  {project.planCount}
                </TD>
                <TD align="right" className="text-xs text-ink-muted">
                  {formatWhen(project.updatedAt)}
                </TD>
                <TD>
                  <RowMenu label={project.name}>
                    <DropdownAction
                      onSelect={() =>
                        void navigate(`/workspace/${current.slug}/project/${project.slug}/settings`)
                      }
                    >
                      <Settings className="size-3.5 text-ink-faint" />
                      {m.list.settings}
                    </DropdownAction>
                    {mayDelete ? (
                      <DropdownAction tone="danger" onSelect={() => setDeleting(project)}>
                        <Trash2 className="size-3.5" />
                        {m.list.moveToTrash}
                      </DropdownAction>
                    ) : null}
                  </RowMenu>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={m.list.confirmTrash(deleting?.name ?? '')}
        description={m.projects.trashBody}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting !== null) void remove(deleting);
            }}
          >
            <Trash2 className="size-3.5" />
            {m.list.moveToTrash}
          </Button>
        </div>
      </Modal>

      <Modal open={creating} onOpenChange={setCreating} title={m.projects.create.title}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field label={m.projects.create.nameLabel} hint={m.projects.create.nameHint}>
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={m.projects.create.namePlaceholder}
              />
            )}
          </Field>
          <Field
            label={m.projects.create.descriptionLabel}
            hint={m.projects.create.descriptionHint}
          >
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder={m.projects.create.descriptionPlaceholder}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {m.projects.create.submit}
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
