import { Outlet } from 'react-router';

/**
 * Your account and the keys your agents hold — both belong to you, not to a
 * workspace. The two used to be tabs here; they are rows in the rail now, so
 * this only marks the boundary.
 */
export function SettingsLayout() {
  return <Outlet />;
}
