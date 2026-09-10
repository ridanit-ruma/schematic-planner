import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';

import { AppShell } from '@/components/AppShell';
import { Spinner } from '@/components/ui/feedback';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth-store';
import { AccountSettingsPage } from '@/features/account/AccountSettingsPage';
import { AdminLayout } from '@/features/admin/AdminLayout';
import { InvitationsPage } from '@/features/admin/InvitationsPage';
import { PeoplePage } from '@/features/admin/PeoplePage';
import { UsagePage } from '@/features/admin/UsagePage';
import { SettingsLayout } from '@/features/account/SettingsLayout';
import { AuthPage } from '@/features/auth/AuthPage';
import { PlanPage } from '@/features/plan/PlanPage';
import { PlanSettingsPage } from '@/features/plan/PlanSettingsPage';
import { SharedPlanPage } from '@/features/plan/SharedPlanPage';
import { AgentsPage } from '@/features/settings/AgentsPage';
import { RecentPage } from '@/features/recent/RecentPage';
import { InvitePage } from '@/features/workspaces/InvitePage';
import { MembersPage } from '@/features/workspaces/MembersPage';
import { PlanIndexPage } from '@/features/workspaces/PlanIndexPage';
import { ProjectIndexPage } from '@/features/workspaces/ProjectIndexPage';
import { ProjectSettingsPage } from '@/features/workspaces/ProjectSettingsPage';
import { TrashPage } from '@/features/workspaces/TrashPage';
import { WorkspaceSettingsPage } from '@/features/workspaces/WorkspaceSettingsPage';
import { WorkspaceLayout, WorkspacesProvider } from '@/features/workspaces/workspace-context';

/*
 * Addresses
 *
 *   /recent                              what you have worked on lately
 *   /login  /register
 *   /settings                            your account
 *   /settings/agents                     the keys your agents hold
 *   /admin  /admin/invitations  /admin/people
 *                                        the instance, for whoever owns it
 *   /workspace/:slug                     projects
 *   /workspace/:slug/project/:slug       plans in a project
 *   /workspace/:slug/project/:slug/settings
 *   /workspace/:slug/members  /settings  /trash
 *   /plan/:planId                        the canvas
 *   /plan/:planId/settings               its name, where it lives, deleting it
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
    <TooltipProvider>
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
          {/* `/` is the marketing site on the usual one-origin deployment, so
              the first screen has an address of its own. */}
          <Route index element={<Navigate to="/recent" replace />} />
          <Route path="/recent" element={<RecentPage />} />
          {/* The canvas is its own full-screen shell; everything else about a
              plan is an ordinary screen in this one. */}
          <Route path="/plan/:planId/settings" element={<PlanSettingsPage />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<AccountSettingsPage />} />
            <Route path="agents" element={<AgentsPage />} />
          </Route>
          <Route path="/invite/:token" element={<InvitePage />} />

          {/* Owner only, and the API says so too — a route that is merely not
              linked to is not a route that is closed. */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<UsagePage />} />
            <Route path="invitations" element={<InvitationsPage />} />
            <Route path="people" element={<PeoplePage />} />
          </Route>

          <Route path="/workspace/:workspaceSlug" element={<WorkspaceLayout />}>
            <Route index element={<ProjectIndexPage />} />
            <Route path="project/:projectSlug" element={<PlanIndexPage />} />
            <Route path="project/:projectSlug/settings" element={<ProjectSettingsPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="settings" element={<WorkspaceSettingsPage />} />
            <Route path="trash" element={<TrashPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/recent" replace />} />
        </Route>
      </Routes>
    </TooltipProvider>
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
