import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { workspaces, type WorkspaceSummary } from '@/lib/api';

/** Everyone gets a workspace at sign-up, so this normally redirects at once. */
export function HomeRedirect() {
  const [list, setList] = useState<WorkspaceSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    workspaces.list().then(setList).catch(setError);
  }, []);

  if (error !== null) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Problem error={error} />
      </div>
    );
  }
  if (list === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }

  const first = list[0];
  if (first !== undefined) return <Navigate to={`/w/${first.id}`} replace />;

  return (
    <Empty
      title="No workspace yet"
      body="A workspace holds your plans and the keys your agents connect with."
      action={
        <Button
          variant="primary"
          onClick={() => {
            void workspaces.create('My workspace').then((created) => {
              window.location.href = `/w/${created.id}`;
            });
          }}
        >
          Create a workspace
        </Button>
      }
    />
  );
}
