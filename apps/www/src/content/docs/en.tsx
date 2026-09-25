import type { PageMeta } from '@/content/types';

export const meta: PageMeta = {
  title: 'Docs',
  description:
    'Connect an AI agent to Schematic Planner over MCP, and understand what the export contains.',
};

const MCP_CONFIG = `{
  "mcpServers": {
    "schematic-planner": {
      "type": "http",
      "url": "https://your-instance.example/mcp",
      "headers": { "Authorization": "Bearer sp_..." }
    }
  }
}`;

const TOOLS = [
  ['list_workspaces', 'Workspaces this key can act in.'],
  ['list_projects', 'Projects it can reach, across the account or narrowed to one workspace.'],
  ['list_plans', 'Plans, grouped by workspace, project and folder, each with the link to open it.'],
  [
    'search',
    'Looks for words across every plan the key can reach — titles, slugs, tags and details — and answers with the plans they are in. Use it before drawing something new: a second plan of a system somebody already drew is how a workspace turns into a pile.',
  ],
  [
    'trace',
    'Follow the flow through one part of a plan — what a node reaches, or what reaches it, hop by hop, with what sets each hop off and what it carries. The way to read a plan: it answers with the thread rather than the whole document, and a cycle is reported instead of followed round.',
  ],
  [
    'get_plan',
    'The whole plan at once. Outline, graph JSON, or the full Markdown. Never coordinates. The answer ends with the kinds and statuses the project uses, so an agent knows which words it has.',
  ],
  [
    'read_nodes',
    'The full detail of the nodes you name, as Markdown, with what each one is wired to and what holds it.',
  ],
  [
    'next_task',
    'Where the plan has got to and what can be started now, each with its detail. It goes by what each status means rather than by its name: work already under way, work that is blocked, and work that is ready because everything before it is finished or given up.',
  ],
  ['plan_history', 'Who changed what, newest first — people and agents alike.'],
  ['create_project', 'A new project to draw in.'],
  [
    'create_plan',
    'Opens an empty plan, filed in a folder by its path if you give one. The first call, not the last: it answers with an id, the address the plan can be looked at, and the kinds and statuses the project uses.',
  ],
  [
    'apply_ops',
    'How a plan grows after that, and the only write door. Batched, atomic, keyed by slug so retries are safe — and each batch reaches every open canvas at once, so a person looking at the plan watches it change rather than being handed a finished picture. Kinds and statuses are checked against the project: one it does not have refuses the whole batch, with the ones it does listed.',
  ],
  [
    'set_plan_sources',
    'Which plans this one was written from. Reading the plan back says whether each one is still there.',
  ],
  ['layout', 'Re-arrange. Nodes a person dragged are left where they are.'],
  ['export_plan', 'The Markdown bundle, plus a link to the zip.'],
  [
    'delete_plan',
    'Moves one to the workspace trash, where a person can restore it. Requires its title typed back, so a wrong id cannot take somebody else’s work.',
  ],
  [
    'list_folders',
    'The folders in a project, each by its path, such as Specs/Billing, with how many plans are filed in it.',
  ],
  [
    'create_folder',
    'Makes a folder. Give a path to make one inside another, and any folder on the way that is missing is made too. Asked for one that is already there, it hands that one back.',
  ],
  ['rename_folder', 'Renames a folder. It stays where it is, and so does everything in it.'],
  [
    'delete_folder',
    'Moves a folder to the trash with the folders and plans inside it, which all come back with it. Requires its name typed back.',
  ],
  [
    'move_plan',
    'Files a plan somewhere else: another folder, another project, or a project in another workspace, which drops its share link.',
  ],
] as const;

export default function Docs() {
  return (
    <>
      <article className="mx-auto max-w-5xl px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink">Connect an agent</h1>
          <p className="mt-4 text-base leading-[1.65] text-ink-muted">
            Schematic Planner speaks MCP over HTTP. There is nothing to install: open{' '}
            <strong className="font-medium text-ink">Agents</strong> in your account settings,
            create a key, and paste the URL and key into your client.
          </p>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            A key belongs to you rather than to one workspace, so a single key reaches every
            workspace you are a member of. Where that leaves a choice, the tools take a workspace
            argument — and asked to create something without one, the server names the options
            instead of guessing.
          </p>

          <pre className="mt-6 overflow-x-auto rounded-lg border border-rule bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
            {MCP_CONFIG}
          </pre>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">The tools</h2>
          <dl className="mt-4 space-y-4">
            {TOOLS.map(([name, description]) => (
              <div key={name} className="border-l-2 border-rule pl-4">
                <dt className="slug text-ink">{name}</dt>
                <dd className="mt-1 text-sm leading-[1.6] text-ink-muted">{description}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            Folders are addressed by path
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            Folders nest, so a tool that takes a folder takes its path from the top of the project:{' '}
            <code className="slug">Specs/Billing</code>. A bare name still works when only one
            folder in the project has it, so prompts written before folders nested keep working. A
            name two folders share is refused with both paths rather than guessed at.
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            Kinds and statuses are the project&rsquo;s
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            Each project defines its own kinds and statuses, and every plan in it uses them. An
            agent reads them in the answer to <code className="slug">get_plan</code> or{' '}
            <code className="slug">create_plan</code> and writes their ids; a name works too. A
            project nobody has changed has the built-in ones — <code className="slug">idea</code>,{' '}
            <code className="slug">planned</code>, <code className="slug">in_progress</code>,{' '}
            <code className="slug">blocked</code>, <code className="slug">done</code>,{' '}
            <code className="slug">dropped</code>, and <code className="slug">feature</code>,{' '}
            <code className="slug">task</code>, <code className="slug">decision</code>,{' '}
            <code className="slug">note</code>, <code className="slug">group</code>. A value the
            project does not have is refused with the list of those it does. Agents use the
            vocabulary but cannot change it; that is done in the project&rsquo;s settings.
          </p>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            A node&rsquo;s detail is written in a block editor in the app, and an agent reads and
            writes it as Markdown. Tables, toggles and callouts come through as a Markdown table, a{' '}
            <code className="slug">&lt;details&gt;</code> block and an Obsidian callout.
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            Why agents do not set positions
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            A language model asked for coordinates produces a diagram nobody wants to read, and
            spends your context doing it. So the tools have no position field. An agent says what
            flows where; the server runs the layout, and places the writing on each line too.
            Anything a person has dragged is pinned, and automatic layout never touches it again.
          </p>

          <h2 className="mt-12 text-lg font-medium tracking-[-0.02em] text-ink">
            What the export contains
          </h2>
          <p className="mt-3 text-base leading-[1.65] text-ink-muted">
            Flows are written into each node's front matter, with what sets them off and what they
            carry. Containment edges become directory nesting. Dependency edges become a topological
            order, which becomes the numeric prefix on each filename. Every node carries its own
            frontmatter, so the bundle describes the graph completely rather than rendering a
            picture of it. A dependency cycle does not block the export: it is broken in a stable
            way and reported in the README.
          </p>
        </div>
      </article>
    </>
  );
}
