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
  ['list_workspaces', 'Workspaces this key can act in.'],
  ['list_projects', 'Projects it can reach, across the account or narrowed to one workspace.'],
  ['list_plans', 'Plans, grouped by workspace and project, each with the link to open it.'],
  [
    'trace',
    'Follow the flow through one part of a plan — what a node reaches, or what reaches it, hop by hop, with what sets each hop off and what it carries. The way to read a plan: it answers with the thread rather than the whole document, and a cycle is reported instead of followed round.',
  ],
  [
    'get_plan',
    'The whole plan at once. Outline, graph JSON, or the full Markdown. Never coordinates.',
  ],
  [
    'create_plan',
    'A whole structure in one call. Names which workspace and project when there is a choice, and answers with the address the plan can be looked at.',
  ],
  ['create_project', 'A new project to draw in.'],
  ['apply_ops', 'The only write door. Batched, atomic, and keyed by slug so retries are safe.'],
  ['layout', 'Re-arrange. Nodes a person dragged are left where they are.'],
  ['export_plan', 'The Markdown bundle, plus a link to the zip.'],
  [
    'delete_plan',
    'Removes one. Requires its title typed back, so a wrong id cannot take somebody else’s work.',
  ],
] as const;

export default function Docs() {
  return (
    <SiteChrome>
      <article className="mx-auto max-w-5xl px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">Connect an agent</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Schematic Planner speaks MCP over HTTP. There is nothing to install: open{' '}
            <strong className="font-medium text-ink">Agents</strong> in your account settings,
            create a key, and paste the URL and key into your client.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            A key belongs to you rather than to one workspace, so a single key reaches every
            workspace you are a member of. Where that leaves a choice, the tools take a workspace
            argument — and asked to create something without one, the server names the options
            instead of guessing.
          </p>

          <pre className="mt-6 overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
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
            A language model asked for coordinates produces a diagram nobody wants to read, and
            spends your context doing it. So the tools have no position field. An agent says what
            flows where; the server runs the layout, and places the writing on each line too.
            Anything a person has dragged is pinned, and automatic layout never touches it again.
          </p>

          <h2 className="mt-12 text-base font-medium text-ink">What the export contains</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Flows are written into each node's front matter, with what sets them off and what they
            carry. Containment edges become directory nesting. Dependency edges become a topological
            order, which becomes the numeric prefix on each filename. Every node carries its own
            frontmatter, so the bundle describes the graph completely rather than rendering a
            picture of it. A dependency cycle does not block the export: it is broken in a stable
            way and reported in the README.
          </p>
        </div>
      </article>
    </SiteChrome>
  );
}
