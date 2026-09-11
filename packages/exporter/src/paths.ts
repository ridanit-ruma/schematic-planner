import { buildPlanGraph, topologicalOrder, type PlanDoc, type PlanGraph } from '@schematic/schema';

import { uniqueNames } from './names.js';

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
 *
 * The prefix exists to carry an order a name cannot. Where a set of siblings has
 * no dependency between any of them there is no order to carry, and numbering
 * them anyway invents one — and overwrites the order the author already put in
 * the names themselves, which is how a vault reading `00-overview, 01-core,
 * 02-plugins` came back as `01-app, 02-business, 04-core`. So it is applied only
 * where it says something.
 */
export function assignPaths(doc: Pick<PlanDoc, 'nodes' | 'edges'>, graph?: PlanGraph): PlanPaths {
  const resolved = graph ?? buildPlanGraph(doc);
  const fileOf = new Map<string, string>();
  const dirOf = new Map<string, string>();
  const warnings: string[] = [];

  const walk = (slugs: readonly string[], parentDir: string): void => {
    const { order, cycles } = topologicalOrder(slugs, resolved.dependenciesOf);
    for (const cycle of cycles) {
      warnings.push(`dependency cycle between ${cycle.join(', ')} — order broken alphabetically`);
    }

    // Only a dependency *among these siblings* moves them about; one pointing
    // out of the folder cannot change the order inside it.
    const among = new Set(slugs);
    const ordered = order.some((slug) =>
      [...(resolved.dependenciesOf.get(slug) ?? [])].some((need) => among.has(need)),
    );

    const names = uniqueNames(
      order.map((slug) => ({ slug, title: resolved.nodes.get(slug)?.title ?? slug })),
    );

    const width = Math.max(2, String(order.length).length);
    order.forEach((slug, index) => {
      const name = names.get(slug) ?? slug;
      const prefix = ordered ? `${String(index + 1).padStart(width, '0')}-` : '';
      const children = resolved.childrenOf.get(slug) ?? [];

      if (children.length === 0) {
        fileOf.set(slug, join(parentDir, `${prefix}${name}.md`));
        return;
      }

      const dir = join(parentDir, `${prefix}${name}`);
      dirOf.set(slug, dir);
      fileOf.set(slug, join(dir, 'README.md'));
      walk(children, dir);
    });
  };

  walk(resolved.roots, '');

  return { fileOf, dirOf, warnings };
}
