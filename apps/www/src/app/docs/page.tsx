import type { Metadata } from 'next';

import { SiteChrome } from '@/components/SiteChrome';

export const metadata: Metadata = {
  title: 'Docs',
  description:
    'Connect an AI agent to Schematic Planner over MCP, and understand what the export contains.',
};

const MCP_CONFIG = `{
  "mcpServers": {
    "schematic-planner": {
      "url": "https://your-instance.example/mcp",
      "headers": { "Authorization": "Bearer sp_..." }
    }
  }
}`;

const TOOLS = [
  ['list_projects', 'Projects in the workspace the key belongs to.'],
  ['list_plans', 'Plans in that workspace, grouped by project.'],
  ['get_plan', 'Read one. Outline, graph JSON, or the full Markdown. Never coordinates.'],
  [
    'create_plan',
    'A whole structure in one call — the path for drawing a plan you already wrote. Takes an optional project slug.',
  ],
  ['apply_ops', 'The only write door. Batched, atomic, and keyed by slug so retries are safe.'],
  ['layout', 'Re-arrange. Nodes a person dragged are left where they are.'],
  ['export_plan', 'The Markdown bundle, plus a link to the zip.'],
] as const;

export default function Docs() {
  return (
    <SiteChrome>
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Connect an agent</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Schematic Planner speaks MCP over HTTP. There is nothing to install: open{' '}
          <strong className="font-medium text-ink">Agents</strong> in your workspace, create a key,
          and paste the URL and key into your client.
        </p>

        <pre className="mt-6 overflow-x-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">
          {MCP_CONFIG}
        </pre>

        <h2 className="mt-12 text-base font-medium text-ink">The tools</h2>
        <dl className="mt-4 space-y-4">
          {TOOLS.map(([name, description]) => (
            <div key={name} className="border-l-2 border-rule pl-4">
              <dt className="slug text-ink">{name}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-12 text-base font-medium text-ink">Why agents do not set positions</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          A language model asked for coordinates produces a diagram nobody wants to read, and spends
          your context doing it. So the tools have no position field. An agent says what depends on
          what; the server runs the layout. Anything a person has dragged is pinned, and automatic
          layout never touches it again.
        </p>

        <h2 className="mt-12 text-base font-medium text-ink">What the export contains</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Containment edges become directory nesting. Dependency edges become a topological order,
          which becomes the numeric prefix on each filename. Every node carries its own frontmatter,
          so the bundle describes the graph completely rather than rendering a picture of it. A
          dependency cycle does not block the export: it is broken in a stable way and reported in
          the README.
        </p>
      </article>
    </SiteChrome>
  );
}
