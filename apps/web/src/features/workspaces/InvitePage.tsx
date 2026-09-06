import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';

import { Problem, Spinner } from '@/components/ui/feedback';
import { workspaces } from '@/lib/api';
import { useWorkspaces } from './workspace-context';

export function InvitePage() {
  const { token = '' } = useParams();
  const { reload } = useWorkspaces();
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    workspaces
      .acceptInvite(token)
      .then(async (result) => {
        reload();
        // The invitation returns the workspace it joined; the list has to be
        // refetched before its slug can be resolved for the redirect.
        const list = await workspaces.list();
        const joined = list.find((workspace) => workspace.id === result.workspace.id);
        setWorkspaceSlug(joined?.slug ?? null);
      })
      .catch(setError);
  }, [token, reload]);

  if (error !== null) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Problem error={error} />
      </div>
    );
  }
  if (workspaceSlug !== null) return <Navigate to={`/workspace/${workspaceSlug}`} replace />;

  return (
    <div className="grid py-24 place-items-center">
      <Spinner />
    </div>
  );
}
