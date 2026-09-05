import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';

import { AppShell } from '@/components/AppShell';
import { Spinner } from '@/components/ui/feedback';
import { useAuth } from '@/lib/auth-store';
import { AuthPage } from '@/features/auth/AuthPage';
import { PlanPage } from '@/features/plan/PlanPage';
import { SharedPlanPage } from '@/features/plan/SharedPlanPage';
import { AgentsPage } from '@/features/settings/AgentsPage';
import { HomeRedirect } from '@/features/workspaces/HomeRedirect';
import { InvitePage } from '@/features/workspaces/InvitePage';
import { PlanIndexPage } from '@/features/workspaces/PlanIndexPage';

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
        path="/plans/:planId"
        element={
          <RequireAuth status={status}>
            <PlanPage />
          </RequireAuth>
        }
      />

      <Route
        path="*"
        element={
          <RequireAuth status={status}>
            <AppShell>
              <Routes>
                <Route index element={<HomeRedirect />} />
                <Route path="/w/:workspaceId" element={<PlanIndexPage />} />
                <Route path="/w/:workspaceId/agents" element={<AgentsPage />} />
                <Route path="/invite/:token" element={<InvitePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
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
