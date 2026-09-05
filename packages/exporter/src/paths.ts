import { buildPlanGraph, topologicalOrder, type PlanDoc, type PlanGraph } from '@schematic/schema';

export interface PlanPaths {
  /** node slug -> path of the Markdown file holding it */
  readonly fileOf: ReadonlyMap<string, string>;
  /** node slug -> directory it owns, present only for nodes with children */
  readonly dirOf: ReadonlyMap<string, string>;
  readonly warnings: readonly string[];
}

function join(dir: string, name: string): string {
  return dir === '' ? name : `${dir}/${name}`;
}

/**
 * Containment becomes directory nesting; dependency order becomes the numeric
 * filename prefix. A node with children owns a directory and lives in its
 * README.md, so opening the folder in Obsidian shows the container's own notes.
 */
export function assignPaths(doc: Pick<PlanDoc, 'nodes' | 'edges'>, graph?: PlanGraph): PlanPaths {
  const resolved = graph ?? buildPlanGraph(doc);
  const fileOf = new Map<string, string>();
  const dirOf = new Map<string, string>();
  const warnings: string[] = [];

  const walk = (slugs: readonly string[], parentDir: string): void => {
    const { order, cycles } = topologicalOrder(slugs, resolved.dependenciesOf);
    for (const cycle of cycles) {
      warnings.push(
        `dependency cycle between ${cycle.join(', ')} — order broken alphabetically`,
      );
    }

    const width = Math.max(2, String(order.length).length);
    order.forEach((slug, index) => {
      const prefix = String(index + 1).padStart(width, '0');
      const children = resolved.childrenOf.get(slug) ?? [];

      if (children.length === 0) {
        fileOf.set(slug, join(parentDir, `${prefix}-${slug}.md`));
        return;
      }

      const dir = join(parentDir, `${prefix}-${slug}`);
      dirOf.set(slug, dir);
      fileOf.set(slug, join(dir, 'README.md'));
      walk(children, dir);
    });
  };

  walk(resolved.roots, '');

  return { fileOf, dirOf, warnings };
}
