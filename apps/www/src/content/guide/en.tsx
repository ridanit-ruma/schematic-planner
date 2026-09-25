import type { PageMeta } from '@/content/types';
import Link from 'next/link';

import { Prose } from '@/components/Prose';
import { localePath } from '@/i18n/locales';

export const meta: PageMeta = {
  title: 'Guide',
  description:
    'Make a plan, draw it, connect an AI agent to it, and take the Markdown and Canvas files with you.',
};

const ISSUES = 'https://github.com/ridanit-ruma/schematic-planner/issues';

const CREATE_PLAN = `{
  "name": "create_plan",
  "arguments": {
    "title": "Billing rework",
    "folder": "Specs/Billing"
  }
}`;

const APPLY_OPS = `{
  "name": "apply_ops",
  "arguments": {
    "planId": "…",
    "ops": [
      { "op": "upsert_node",
        "node": { "slug": "pricing-rules", "title": "Pricing rules" } },
      { "op": "upsert_node",
        "node": { "slug": "tax", "title": "Tax by region",
                  "kind": "decision", "status": "blocked" } },
      { "op": "upsert_edge",
        "edge": { "from": "tax", "to": "pricing-rules",
                  "carries": "rate table" } }
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
    <>
      <Prose
        title="Guide"
        lede="Make a plan, draw it, hand it to an agent, and take the files with you. This walks
          through the whole loop; the reference for each MCP tool is in the docs."
      >
        <h2>1. Make a plan</h2>
        <p>Plans are filed like this, and you already have the first two after signing up:</p>
        <pre>{`Workspace            people, roles, and the keys agents connect with
  └─ Project         one thing you are building, and the words its plans use
       └─ Folder     optional, and a folder can hold folders
            └─ Plan  one graph`}</pre>
        <p>
          The app is one screen. On the left is the explorer: <strong>Recent</strong>, then every
          project in the workspace with its folders and plans. Click a project or a folder to open
          or close it, and a plan to open it on the right — where settings, members and the trash
          open too, with the explorer still beside them. Drag the explorer&rsquo;s edge to make it
          wider.
        </p>
        <p>
          Point at a project or a folder and two icons appear on its row, <strong>New plan</strong>{' '}
          and <strong>New folder</strong>, which make one inside it. The icons at the foot of the
          tree make a plan, a folder or a <strong>New project</strong>. You name what you made right
          there in the tree. Drag a plan or a folder onto a folder to file it, and use a row&rsquo;s
          menu — or right-click it — to rename, move, share, export, or move it to the trash.
        </p>
        <p>
          A <strong>General</strong> project is there from the start. A plan is a graph, not a
          document: you will be adding things and saying how they relate, rather than writing top to
          bottom.
        </p>

        <h2>2. Draw it</h2>
        <p>
          The quickest way to make a node is from another one. Drag from the terminal on the right
          side of a node and let go on empty canvas: a new node appears where you let go, already
          connected, with its title ready to type. <strong>Enter</strong> keeps it;{' '}
          <strong>Escape</strong> takes it away again. Let go inside a group and the new node joins
          that group. On an empty plan, <strong>Add node</strong> in the title block — or{' '}
          <strong>Add node here</strong> when you right-click the canvas — makes one the same way.
          Double-click a title to rename it on the card.
        </p>
        <p>
          Click a node and the panel on the right opens: its kind, its status, its tags, and as much
          detail as you want. The detail becomes the body of that node&rsquo;s Markdown file when
          you export, so it is worth writing properly.
        </p>
        <p>
          Every line starts out as a flow. Click it and choose its <strong>Meaning</strong>:
        </p>
        <ul>
          <li>
            <strong>Flows to</strong> — the way the system actually moves: this screen calls that
            endpoint, that endpoint reads that table. Say what sets the hand-off off and what it
            carries, and both are written on the line. A reply is a second flow pointing back. This
            is the one that draws a system rather than a list.
          </li>
          <li>
            <strong>Contains</strong> — from the container to what goes inside it. This is what
            becomes a directory on export, and dragging a group moves everything in it.
          </li>
          <li>
            <strong>Depends on</strong> — what has to exist first, which is not the same as what
            calls what. It becomes the order the export numbers files in.
          </li>
          <li>
            <strong>Relates to</strong> — a plain association, carrying no structure.
          </li>
        </ul>
        <p>The same panel says what sets the line off and what it carries, or removes it.</p>
        <p>
          <strong>Arrange</strong> lays the graph out for you. It will not move anything you have
          dragged by hand — a node you place is pinned from then on, and only you can unpin it by
          moving it again.
        </p>

        <h2>3. Work the canvas</h2>
        <p>The canvas handles like a drawing tool:</p>
        <ul>
          <li>
            <strong>Drag on empty canvas</strong> to draw a selection box. It takes every node it
            touches, and Shift adds to what is already selected. Shift, Ctrl or ⌘ + click adds a
            single node or takes it out.
          </li>
          <li>
            <strong>Pan</strong> with the middle mouse button, by holding Space while you drag, or
            with the wheel — Shift and the wheel go sideways. <strong>Zoom</strong> with Ctrl or ⌘
            and the wheel, or by pinching.
          </li>
          <li>
            <strong>Drag a selection</strong> to move all of it at once, and press Backspace or
            Delete to remove it.
          </li>
          <li>
            <strong>Alt/⌥ + drag</strong> leaves the originals where they were and drops copies
            where you let go.
          </li>
          <li>
            <strong>Ctrl/⌘ + C, X and V</strong> copy, cut and paste — at the pointer, and into
            another plan or tab as well. <strong>Ctrl/⌘ + D</strong> duplicates in place.
          </li>
        </ul>
        <p>
          While you drag, the canvas also matches spacing: bring a node to the same distance from
          its neighbour as two others already are and it snaps there, with pink measures showing the
          gaps that match. Select a row or a column of evenly spaced nodes and a handle appears in
          each gap — drag one to change every gap at once. If the spacing is uneven, right-click and
          choose <strong>Tidy up</strong> first.
        </p>

        <h2>4. Write the detail</h2>
        <p>
          A node&rsquo;s detail is a block editor. Type <code>#</code> and a space for a heading (
          <code>##</code> and <code>###</code> for smaller ones), <code>-</code> for a list,{' '}
          <code>1.</code> for a numbered one, <code>[]</code> for a to-do, <code>&gt;</code> for a
          quote, three backticks for code, and <code>---</code> for a divider. Type <code>/</code>{' '}
          for a menu of every block, including a <strong>Table</strong>, a <strong>Toggle</strong>{' '}
          and a <strong>Callout</strong> — a note, tip, warning or danger. The handle beside a block
          drags it somewhere else.
        </p>
        <p>
          Several people can write in the same detail at once and see each other&rsquo;s cursors as
          they go, and an agent writing to it merges in the same way. The card on the canvas shows
          the same content, headings and all, and a to-do can be ticked right there.
        </p>
        <p>
          Everything outside the editor reads the detail as Markdown — the export, and every agent.
          A table is a Markdown table, a toggle is a <code>&lt;details&gt;</code> block, and a
          callout is an Obsidian callout, so it opens in a vault as what it was.
        </p>

        <h2>5. Your project&rsquo;s words</h2>
        <p>
          Kinds and statuses belong to the project, so every plan in it speaks the same language. A
          new project starts with the statuses <strong>Idea</strong>, <strong>Planned</strong>,{' '}
          <strong>In progress</strong>, <strong>Blocked</strong>, <strong>Done</strong> and{' '}
          <strong>Dropped</strong>, and the kinds <strong>Feature</strong>, <strong>Task</strong>,{' '}
          <strong>Decision</strong>, <strong>Note</strong> and <strong>Group</strong>. The status
          picker shows each status in its colour and the kind picker shows each kind&rsquo;s
          outline; both end with <strong>Edit…</strong>, which opens the project&rsquo;s{' '}
          <strong>Vocabulary</strong> in <strong>Project settings</strong>.
        </p>
        <p>
          There you add, rename, recolour and reorder them. Each status sits in a category — To do,
          Under way, Blocked, Done or Cancelled — and the category decides what it does: what an
          agent is offered next, which flows are drawn in red, what counts as progress. Each kind
          has an outline and says whether it counts as work. Removing a status or a kind archives
          it: it leaves the pickers, and the nodes that use it keep it until someone changes them.
          Group is built in and stays.
        </p>
        <p>
          Tags work like a select. Type to filter the project&rsquo;s tags; Enter picks the one
          highlighted, or makes a new one with a colour of its own. Backspace in the empty field
          takes the last tag off. A tag&rsquo;s own menu recolours it or deletes it from the
          project, and the nodes keep the name.
        </p>

        <h2>6. Connect an agent</h2>
        <p>
          Open <strong>Agents</strong> in your account settings, create a key, and paste the URL and
          key into your MCP client. Nothing is installed on your machine; the server is reached over
          HTTP. The <Link href={localePath('en', '/docs')}>docs</Link> have the exact configuration
          block and the full tool list.
        </p>
        <p>
          A key acts as you everywhere you are a member, so one key is enough however many
          workspaces you have. Give it to one client, name it after that client, and revoke it when
          the machine changes hands.
        </p>

        <h2>7. Let the agent draw</h2>
        <p>
          Ask your agent to write the plan the way it normally would, then to put it on the canvas.
          It opens a plan with <code>create_plan</code> — filed straight into a folder by its path,
          if you like:
        </p>
        <pre>{CREATE_PLAN}</pre>
        <p>
          Then it draws with <code>apply_ops</code> — one batched, atomic call that appears on every
          open canvas at once, and the same call for every change after that:
        </p>
        <pre>{APPLY_OPS}</pre>
        <p>
          Notice what is not there: coordinates. Agents declare structure and the server runs the
          layout, because a language model asked for positions produces a diagram nobody wants to
          read and spends your context doing it. Notice also that a node is addressed by its slug,
          so the same call sent twice changes nothing the second time.
        </p>
        <p>
          An agent uses your project&rsquo;s words. Reading a plan tells it which kinds and statuses
          exist, and one the project does not have is refused with the list of those it does — so an
          agent cannot quietly invent a status of its own.
        </p>
        <p>
          One thing worth asking your agent for: slugs you would recognise.{' '}
          <code>pricing-rules</code> is a name you can refer to in the next message.{' '}
          <code>node-7</code> is not.
        </p>

        <h2>8. Take the files</h2>
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

        <h2>9. Work with other people</h2>
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

        <h2>10. Run your own</h2>
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
          email and password only. There is no search box in the app, and the history lists every
          change but cannot put an earlier version back.
        </p>
        <p>
          If one of those is in your way, say so on <Link href={ISSUES}>GitHub Issues</Link>; it
          moves what gets built next.
        </p>
      </Prose>
    </>
  );
}
