/** The ways a plan can be looked at. The drawing is one of them, and the default. */
export const PLAN_VIEWS = ['canvas', 'table', 'board'] as const;
export type PlanView = (typeof PLAN_VIEWS)[number];

/** What `?view=` asks for; anything this build does not know is the canvas. */
export function readView(value: string | null): PlanView {
  return PLAN_VIEWS.find((view) => view === value) ?? 'canvas';
}
