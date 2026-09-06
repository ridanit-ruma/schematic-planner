import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';

import { AppShell } from '@/components/AppShell';
import { Spinner } from '@/components/ui/feedback';
import { useAuth } from '@/lib/auth-store';
import { AccountSettingsPage } from '@/features/account/AccountSettingsPage';
import { AuthPage } from '@/features/auth/AuthPage';
import { PlanPage } from '@/features/plan/PlanPage';
import { SharedPlanPage } from '@/features/plan/SharedPlanPage';
import { AgentsPage } from '@/features/settings/AgentsPage';
import { HomeRedirect } from '@/features/workspaces/HomeRedirect';
import { InvitePage } from '@/features/workspaces/InvitePage';
import { MembersPage } from '@/features/workspaces/MembersPage';
import { PlanIndexPage } from '@/features/workspaces/PlanIndexPage';
import { ProjectIndexPage } from '@/features/workspaces/ProjectIndexPage';
import { WorkspaceSettingsPage } from '@/features/workspaces/WorkspaceSettingsPage';
import { WorkspaceLayout, WorkspacesProvider } from '@/features/workspaces/workspace-context';

/*
 * Addresses
 *
 *   /                                    the workspace you were last in
 *   /login  /register
 *   /settings                            your account
 *   /workspace/:slug                     projects
 *   /workspace/:slug/project/:slug       plans in a project
 *   /workspace/:slug/members  /agents  /settings
 *   /plan/:planId                        the canvas
 *   /share/:token                        read only, no session
 *
 * A workspace and a project are addressed by a readable slug; a plan is not,
 * and sits at the top level. A plan link is the thing people paste to each
 * other, so it must not break when a workspace or project is renamed.
 */
export function App() {
  const { status, bootstrap } = useAuth();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      {/* A shared link has no session and must not be sent to sign-in. */}
      <Route path="/share/:token" element={<SharedPlanPage />} />
      <Route path="/login" element={<AuthPage mode="sign-in" />} />
      <Route path="/register" element={<AuthPage mode="sign-up" />} />

      <Route
        path="/plan/:planId"
        element={
          <RequireAuth status={status}>
            <PlanPage />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth status={status}>
            <WorkspacesProvider>
              <AppShell />
            </WorkspacesProvider>
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />

        <Route path="/workspace/:workspaceSlug" element={<WorkspaceLayout />}>
          <Route index element={<ProjectIndexPage />} />
          <Route path="project/:projectSlug" element={<PlanIndexPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="settings" element={<WorkspaceSettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function RequireAuth({
  status,
  children,
}: {
  status: ReturnType<typeof useAuth.getState>['status'];
  children: React.ReactNode;
}) {
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }
  if (status === 'signed-out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
