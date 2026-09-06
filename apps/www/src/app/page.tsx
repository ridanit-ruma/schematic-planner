import Link from 'next/link';

import { HeroSchematic } from '@/components/HeroSchematic';
import { SiteChrome } from '@/components/SiteChrome';
import { appUrl } from '@/lib/app-url';

const repoUrl = 'https://github.com/ridanit-ruma/schematic-planner';

const AGENT_CALL = `create_plan({
  title: "Billing rework",
  nodes: [
    { slug: "ledger-schema", title: "Ledger schema" },
    { slug: "pricing-rules", title: "Pricing rules" },
    { slug: "render-pdf",    title: "Render PDF" }
  ],
  edges: [
    { from: "pricing-rules", to: "ledger-schema" },
    { from: "render-pdf",    to: "pricing-rules" }
  ]
})`;

const EXPORT_TREE = `plan-export.zip
├── README.md
├── 01-foundation/
│   ├── 01-ledger-schema.md
│   └── 02-pricing-rules.md
├── 02-invoicing/
│   └── 01-render-pdf.md
├── plan.canvas
└── plan.json`;

export default function Home() {
  return (
    <SiteChrome>
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20">
        <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <h1 className="max-w-[18ch] text-2xl leading-[1.15] font-semibold tracking-tight text-ink">
              Give the plan a shape before you write the code.
            </h1>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-ink-muted">
              Schematic Planner turns a written plan into a graph you and your AI agent both edit —
              then hands it back as Markdown files and an Obsidian Canvas you keep.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href={appUrl()}
                className="rounded-[2px] bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
              >
                Start planning
              </a>
              <Link href="/guide" className="rounded-[2px] border border-rule px-4 py-2 text-sm text-ink">
                Read the guide
              </Link>
            </div>
          </div>

          <div className="border border-rule bg-surface p-3">
            <HeroSchematic />
          </div>
        </div>
      </section>

      <Band>
        <h2 className="text-lg font-medium text-ink">The problem it solves</h2>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ink-muted">
          Coding agents write plans well. What they cannot do is hold one still. Ask for a feature
          and you get a plausible task list, half of it forgotten three messages later, and the
          architecture quietly reinvented on the next run. The plan was never anywhere: it was in
          the conversation, and the conversation moved on.
        </p>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ink-muted">
          Put the plan somewhere both of you can see, and that stops happening.
        </p>
      </Band>

      <Band>
        <h2 className="text-lg font-medium text-ink">How it goes</h2>
        <ol className="mt-6 space-y-6">
          <Step
            title="Your agent writes the plan"
            body="However it likes — prose, a task list, a design note. That part already works."
          />
          <Step
            title="One call turns it into a drawing"
            body="The agent sends the structure and the server places every node. Agents declare
              what depends on what and never coordinates, because a model asked for positions
              produces a diagram nobody wants to read."
          />
          <Step
            title="You move what you want moved"
            body="A node you drag is pinned, and automatic layout leaves it alone from then on.
              Everything else reflows around it."
          />
          <Step
            title="The files come with you"
            body="Containment becomes directories, dependency order becomes the numbers on the
              filenames. Commit the folder next to your source and your agent reads it every run."
          />
        </ol>
      </Band>

      <Band>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-lg font-medium text-ink">What an agent sees</h2>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-ink-muted">
              Six tools behind a URL and a key. Nothing to install, nothing to keep in step with the
              server. A whole plan arrives in one call, and every change after that goes through one
              batched, atomic door — so forty nodes appear on your canvas at once rather than
              crawling in one at a time.
            </p>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-ink-muted">
              Nodes are addressed by a slug you would recognise, so a retry changes nothing the
              second time.
            </p>
            <Link href="/docs" className="mt-4 inline-block text-sm text-accent underline">
              The tool reference
            </Link>
          </div>
          <pre className="overflow-x-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">
            {AGENT_CALL}
          </pre>
        </div>
      </Band>

      <Band>
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-lg font-medium text-ink">What comes out</h2>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-ink-muted">
              A zip of plain Markdown with the graph in the frontmatter, plus a{' '}
              <code className="slug">.canvas</code> that opens in Obsidian with the layout intact.
              Nothing in the format needs this service to be readable, and the same plan always
              exports to the same bytes.
            </p>
          </div>
          <pre className="overflow-x-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">
            {EXPORT_TREE}
          </pre>
        </div>
      </Band>

      <Band>
        <h2 className="text-lg font-medium text-ink">Run it yourself</h2>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ink-muted">
          The whole stack is AGPL-3.0 and needs Node and Postgres. No proprietary authentication
          service, no managed-only dependency, every setting an environment variable. If your source
          cannot leave your network, neither do your plans.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href={repoUrl} className="rounded-[2px] border border-rule px-4 py-2 text-sm text-ink">
            Read the source
          </a>
          <Link href="/guide" className="text-sm text-accent underline">
            Or start with the guide
          </Link>
        </div>
      </Band>

      <Band>
        <h2 className="text-lg font-medium text-ink">Where it actually is</h2>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ink-muted">
          Pre-alpha, and worth saying plainly. Planning, drawing, live collaboration, the agent
          surface, sharing, export, and managing a workspace and your account all work. No email is
          ever sent, so an invitation is a link you pass along; social sign-in is not built. Export
          your plans — that is what the export is for.
        </p>
      </Band>
    </SiteChrome>
  );
}

function Band({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-t border-rule">
      <div className="mx-auto max-w-4xl px-6 py-16">{children}</div>
    </section>
  );
}

function Step({ title, body }: { title: string; body: string }) {
  return (
    <li className="border-l-2 border-rule pl-4">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-ink-muted">{body}</p>
    </li>
  );
}
