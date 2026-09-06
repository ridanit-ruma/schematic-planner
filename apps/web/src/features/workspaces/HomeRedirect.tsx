import { Navigate, useNavigate } from 'react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { workspaces } from '@/lib/api';
import { useWorkspaces } from './workspace-context';

/** Everyone gets a workspace at sign-up, so this normally redirects at once. */
export function HomeRedirect() {
  const { all, reload } = useWorkspaces();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const first = all[0];
  if (first !== undefined) return <Navigate to={`/workspace/${first.slug}`} replace />;

  return (
    <>
      <Empty
        title="No workspace yet"
        body="A workspace holds your projects, and the keys your agents connect with."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Create a workspace
          </Button>
        }
      />
      <Modal open={creating} onOpenChange={setCreating} title="New workspace">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void workspaces.create(name.trim()).then((created) => {
              reload();
              void navigate(`/workspace/${created.slug}`);
            });
          }}
        >
          <Field label="Name">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme"
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create workspace
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
