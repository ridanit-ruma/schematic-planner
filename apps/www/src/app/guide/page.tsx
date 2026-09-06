import type { Metadata } from 'next';
import Link from 'next/link';

import { Prose } from '@/components/Prose';
import { SiteChrome } from '@/components/SiteChrome';

export const metadata: Metadata = {
  title: 'Guide',
  description:
    'Make a plan, draw it, connect an AI agent to it, and take the Markdown and Canvas files with you.',
};

const ISSUES = 'https://github.com/ridanit-ruma/schematic-planner/issues';

const CREATE_PLAN = `{
  "name": "create_plan",
  "arguments": {
    "title": "Billing rework",
    "nodes": [
      { "slug": "ledger-schema", "title": "Ledger schema" },
      { "slug": "pricing-rules", "title": "Pricing rules" },
      { "slug": "render-pdf",    "title": "Render PDF" }
    ],
    "edges": [
      { "from": "pricing-rules", "to": "ledger-schema" },
      { "from": "render-pdf",    "to": "pricing-rules" }
    ]
  }
}`;

const APPLY_OPS = `{
  "name": "apply_ops",
  "arguments": {
    "planId": "…",
    "ops": [
      { "op": "upsert_node",
        "node": { "slug": "tax", "title": "Tax by region",
                  "kind": "decision", "status": "blocked" } },
      { "op": "upsert_edge",
        "edge": { "from": "tax", "to": "pricing-rules" } },
      { "op": "upsert_node",
        "node": { "slug": "ledger-schema", "status": "done" } }
    ]
  }
}`;

const EXPORT_TREE = `plan-export.zip
├── README.md                 overview and a table of contents
├── 01-foundation/            a node that contains others becomes a directory
│   ├── README.md             …and its own notes live here
│   ├── 01-ledger-schema.md
│   └── 02-pricing-rules.md   numbered by what depends on what
├── 02-invoicing/
│   └── 01-render-pdf.md
├── plan.canvas               opens in Obsidian, layout intact
└── plan.json                 the same content, machine readable`;

export default function Guide() {
  return (
    <SiteChrome>
      <Prose
        title="Guide"
        lede="Make a plan, draw it, hand it to an agent, and take the files with you. This walks
          through the whole loop; the reference for each MCP tool is in the docs."
      >
        <h2>1. Make a plan</h2>
        <p>Three levels, and you already have the first two after signing up:</p>
        <pre>{`Workspace      people, roles, and the keys agents connect with
  └─ Project   one thing you are building
       └─ Plan one graph`}</pre>
        <p>
          Open your workspace, pick a project — a <strong>General</strong> one is there from the
          start — and press <strong>New plan</strong>. A plan is a graph, not a document: you will
          be adding things and saying how they relate, rather than writing top to bottom.
        </p>

        <h2>2. Draw it</h2>
        <p>
          <strong>Add node</strong> puts a node where you are looking. Click it and the panel on the
          right opens: give it a title, a kind, a status, and as much detail as you want. The detail
          becomes the body of that node&rsquo;s Markdown file when you export, so it is worth
          writing properly.
        </p>
        <p>
          Five kinds carry different meanings, and the outline of a node tells you which is which: a{' '}
          <strong>feature</strong> and a <strong>task</strong> are solid, a <strong>decision</strong>{' '}
          has a clipped corner, a <strong>note</strong> is dashed, and a <strong>group</strong> is
          drawn as a boundary around whatever it holds.
        </p>
        <p>
          Three buttons in the title block say what the next line you draw will mean, and each one
          shows the line itself rather than an icon standing in for it:
        </p>
        <ul>
          <li>
            <strong>Depends on</strong> — drag from the thing that comes first to the thing that
            needs it. Arrows read in build order, the same order the export numbers files in.
          </li>
          <li>
            <strong>Contains</strong> — drag from the container to what goes inside it. This is
            what becomes a directory on export.
          </li>
          <li>
            <strong>Relates to</strong> — a plain association, carrying no structure.
          </li>
        </ul>
        <p>Click a line to change what it means, label it, or remove it.</p>
        <p>
          <strong>Arrange</strong> lays the graph out for you. It will not move anything you have
          dragged by hand — a node you place is pinned from then on, and only you can unpin it by
          moving it again.
        </p>

        <h2>3. Connect an agent</h2>
        <p>
          Open <strong>Agents</strong> in your workspace, create a key, and paste the URL and key
          into your MCP client. Nothing is installed on your machine; the server is reached over
          HTTP. The <Link href="/docs">docs</Link> have the exact configuration block and the full
          tool list.
        </p>
        <p>
          A key acts as you within that one workspace. Give a key to one client, name it after that
          client, and revoke it when the machine changes hands.
        </p>

        <h2>4. Let the agent draw</h2>
        <p>
          Ask your agent to write the plan the way it normally would, then to put it on the canvas.
          It has two ways in. For a whole plan at once, <code>create_plan</code>:
        </p>
        <pre>{CREATE_PLAN}</pre>
        <p>
          For everything after that, <code>apply_ops</code> — one batched, atomic call that appears
          on every open canvas at once:
        </p>
        <pre>{APPLY_OPS}</pre>
        <p>
          Notice what is not there: coordinates. Agents declare structure and the server runs the
          layout, because a language model asked for positions produces a diagram nobody wants to
          read and spends your context doing it. Notice also that a node is addressed by its slug,
          so the same call sent twice changes nothing the second time.
        </p>
        <p>
          One thing worth asking your agent for: slugs you would recognise.{' '}
          <code>pricing-rules</code> is a name you can refer to in the next message.{' '}
          <code>node-7</code> is not.
        </p>

        <h2>5. Take the files</h2>
        <p>
          <strong>Export</strong> downloads a zip. Containment becomes directories, dependency order
          becomes the number on each filename, and every node carries its own frontmatter, so the
          bundle describes the graph completely rather than being a picture of it.
        </p>
        <pre>{EXPORT_TREE}</pre>
        <p>
          Drop the folder into an Obsidian vault and <code>plan.canvas</code> opens as the same
          diagram. Or commit it next to your source, where your agent will read it on every run —
          which is the point of the whole exercise.
        </p>
        <p>
          A dependency cycle does not block an export. It is broken in a stable way and reported in
          the README, so the same plan always exports to the same files.
        </p>

        <h2>6. Work with other people</h2>
        <p>
          Editing is live. Two people on one plan see each other&rsquo;s changes as they happen, and
          two people typing in the same node&rsquo;s detail merge rather than overwrite. An agent
          writing through MCP is just another participant.
        </p>
        <p>
          <strong>Share</strong> produces a link that anyone can open, read, and export from,
          without an account. Stop sharing and the link stops working.
        </p>
        <p>
          <strong>Members</strong> in your workspace lists who is there, changes roles — owner,
          admin, editor, viewer — and produces an invitation link. There is no email yet, so send
          the link yourself.
        </p>

        <h2>7. Run your own</h2>
        <p>
          The whole stack is AGPL-3.0 and needs Node, Postgres and nothing else. Clone the{' '}
          <Link href="https://github.com/ridanit-ruma/schematic-planner">repository</Link>, copy{' '}
          <code>.env.example</code>, start Postgres, apply the migrations, and run it. The README
          has the exact commands.
        </p>
        <p>
          Everything is configured through environment variables, and the web app reads its server
          address at runtime rather than at build time, so one built bundle runs in every
          environment.
        </p>

        <h2>What is not built yet</h2>
        <p>
          Being straight about it, since you will run into these: no email is ever sent, so an
          invitation is a link you pass along and an email address cannot be changed. Sign-in is
          email and password only. There is no undo on the canvas, no search across a large plan,
          and no version history.
        </p>
        <p>
          If one of those is in your way, say so on <Link href={ISSUES}>GitHub Issues</Link>; it
          moves what gets built next.
        </p>
      </Prose>
    </SiteChrome>
  );
}
