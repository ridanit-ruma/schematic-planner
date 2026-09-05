export const ROLES = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 };

export function atLeast(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required];
}
