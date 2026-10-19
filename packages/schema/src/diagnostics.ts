import { topologicalOrder } from './graph.js';
import type { PlanDoc } from './plan.js';
import { isWorkKind, kindOf, statusOf, type Vocabulary } from './vocabulary.js';

export const DIAGNOSTIC_SEVERITIES = ['error', 'warning', 'info'] as const;
export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];

export const DIAGNOSTIC_RULES = [
  'dependency-cycle',
  'isolated-node',
  'outside-flow',
  'unknown-kind',
  'unknown-status',
] as const;
export type DiagnosticRule = (typeof DIAGNOSTIC_RULES)[number];

/**
 * One thing worth a second look. No sentence: the web says it from its
 * catalogs and MCP in English on the server, from the rule and its params.
 */
export interface Diagnostic {
  severity: DiagnosticSeverity;
  rule: DiagnosticRule;
  /** The nodes it is about, by slug. */
  nodes: string[];
  params: Record<string, string>;
}

export interface Validation {
  /** False when there is anything of severity `error`. */
  ok: boolean;
  /** How many nodes and edges were looked at. */
  checked: number;
  diagnostics: Diagnostic[];
}

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };

/**
 * Rules that hold for any plan, whatever it is a plan of. Read-only: nothing
 * here changes the document, and a finding is fixed the way any edit is.
 */
export function validatePlan(
  doc: Pick<PlanDoc, 'nodes' | 'edges'>,
  vocabulary: Vocabulary,
): Validation {
  const found: Diagnostic[] = [];
  const slugs = doc.nodes.map((node) => node.slug);

  const dependencies = new Map<string, string[]>();
  for (const edge of doc.edges) {
    if (edge.kind !== 'depends_on') continue;
    dependencies.set(edge.from, [...(dependencies.get(edge.from) ?? []), edge.to]);
  }
  for (const cycle of topologicalOrder(slugs, dependencies).cycles) {
    found.push({ severity: 'error', rule: 'dependency-cycle', nodes: [...cycle], params: {} });
  }

  const touched = new Set(doc.edges.flatMap((edge) => [edge.from, edge.to]));
  const flowing = new Set(
    doc.edges.filter((edge) => edge.kind === 'flows_to').flatMap((edge) => [edge.from, edge.to]),
  );
  for (const node of doc.nodes) {
    // A plan of one node has nothing to connect it to.
    if (doc.nodes.length > 1 && !touched.has(node.slug)) {
      found.push({ severity: 'warning', rule: 'isolated-node', nodes: [node.slug], params: {} });
    } else if (
      flowing.size > 0 &&
      touched.has(node.slug) &&
      !flowing.has(node.slug) &&
      isWorkKind(vocabulary, node.kind)
    ) {
      found.push({ severity: 'info', rule: 'outside-flow', nodes: [node.slug], params: {} });
    }
    if (kindOf(vocabulary, node.kind) === undefined) {
      found.push({
        severity: 'warning',
        rule: 'unknown-kind',
        nodes: [node.slug],
        params: { kind: node.kind },
      });
    }
    if (statusOf(vocabulary, node.status) === undefined) {
      found.push({
        severity: 'warning',
        rule: 'unknown-status',
        nodes: [node.slug],
        params: { status: node.status },
      });
    }
  }

  const diagnostics = found.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return {
    ok: !diagnostics.some((one) => one.severity === 'error'),
    checked: doc.nodes.length + doc.edges.length,
    diagnostics,
  };
}
