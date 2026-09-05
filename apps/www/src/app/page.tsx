import { HeroSchematic } from '@/components/HeroSchematic';
import { SiteChrome } from '@/components/SiteChrome';

const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:5173';

const EXPORT_TREE = `plan-export.zip
├── README.md
├── 01-foundation/
│   ├── 01-database.md
│   └── 02-auth.md
├── 02-editor/
│   └── 01-canvas.md
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
                href={appUrl}
                className="rounded-[2px] bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
              >
                Start planning
              </a>
              <a
                href="https://github.com/schematic-planner/schematic-planner"
                className="rounded-[2px] border border-rule px-4 py-2 text-sm text-ink"
              >
                Read the source
              </a>
            </div>
          </div>

          <div className="border border-rule bg-surface p-3">
            <HeroSchematic />
          </div>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-lg font-medium text-ink">How it goes</h2>
          <ol className="mt-6 space-y-6">
            <Step
              title="Your agent writes the plan"
              body="It already does this well. What it cannot do is hold the plan still across a
                dozen messages."
            />
            <Step
              title="The plan becomes a drawing"
              body="One MCP call sends the whole structure. The server places every node — agents
                declare what depends on what, never coordinates. You drag what you want moved, and
                nothing moves it again."
            />
            <Step
              title="You take the files with you"
              body="Containment becomes directories, dependency order becomes the numbers on the
                filenames. Commit the folder next to your source."
            />
          </ol>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto grid max-w-4xl gap-10 px-6 py-16 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-lg font-medium text-ink">What comes out</h2>
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-ink-muted">
              A zip of plain Markdown with the graph in the frontmatter, plus a{' '}
              <code className="slug">.canvas</code> that opens in Obsidian with the layout intact.
              Nothing in the format needs this service to be readable.
            </p>
          </div>
          <pre className="overflow-x-auto border border-rule bg-surface p-4 font-mono text-xs leading-relaxed text-ink">
            {EXPORT_TREE}
          </pre>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-lg font-medium text-ink">Run it yourself</h2>
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ink-muted">
            The whole stack is AGPL-3.0 and starts from one Docker Compose file. No proprietary
            authentication service, no managed-only dependency. If your source cannot leave your
            network, neither do your plans.
          </p>
        </div>
      </section>
    </SiteChrome>
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
