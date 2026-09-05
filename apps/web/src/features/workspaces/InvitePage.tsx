import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';

import { Problem, Spinner } from '@/components/ui/feedback';
import { workspaces } from '@/lib/api';

export function InvitePage() {
  const { token = '' } = useParams();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    workspaces
      .acceptInvite(token)
      .then((result) => setWorkspaceId(result.workspace.id))
      .catch(setError);
  }, [token]);

  if (error !== null) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Problem error={error} />
      </div>
    );
  }
  if (workspaceId !== null) return <Navigate to={`/w/${workspaceId}`} replace />;

  return (
    <div className="grid py-24 place-items-center">
      <Spinner />
    </div>
  );
}
