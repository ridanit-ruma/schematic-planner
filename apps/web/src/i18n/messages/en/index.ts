import type { Catalog } from '../types';
import { account } from './account';
import { admin } from './admin';
import { agents } from './agents';
import { auth } from './auth';
import { canvas } from './canvas';
import { common } from './common';
import { plan } from './plan';
import { recent } from './recent';
import { shell } from './shell';
import { ui } from './ui';
import { workspaces } from './workspaces';

export const en = {
  common,
  shell,
  ui,
  auth,
  recent,
  account,
  agents,
  admin,
  workspaces,
  canvas,
  plan,
};

export type Messages = Catalog<typeof en>;
