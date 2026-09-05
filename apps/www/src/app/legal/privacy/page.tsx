import type { Metadata } from 'next';
import Link from 'next/link';

import { Prose } from '@/components/Prose';
import { SiteChrome } from '@/components/SiteChrome';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What the hosted Schematic Planner service stores, and what it does not.',
};

const ISSUES = 'https://github.com/ridanit-ruma/schematic-planner/issues';

export default function Privacy() {
  return (
    <SiteChrome>
      <Prose
        title="Privacy"
        updated="6 September 2026"
        lede="This describes the hosted service operated by ruma. If you use somebody else's
          instance, they hold your data and their policy is the one that applies — the code is the
          same, the operator is not."
      >
        <h2>What is stored</h2>
        <ul>
          <li>
            <strong>Your account:</strong> email address, display name, and a hash of your password.
            The password itself is never stored — it is hashed with Argon2 and the original cannot
            be recovered from it.
          </li>
          <li>
            <strong>Your plans:</strong> everything you write. Titles, node text, tags, structure,
            and node positions. Each plan is held twice: as the live collaborative document that
            makes real-time editing work, and as a snapshot of it that lists and exports read.
          </li>
          <li>
            <strong>Sessions:</strong> a hash of each sign-in token, when it expires, and the
            browser identification string the request arrived with.
          </li>
          <li>
            <strong>API keys:</strong> a hash of the key, its first characters so you can tell your
            keys apart, the name you gave it, and when it was last used.
          </li>
          <li>
            <strong>Share links:</strong> the link&rsquo;s token and its expiry, if you set one.
          </li>
        </ul>

        <h2>What is not</h2>
        <p>
          There is no analytics, no advertising, and no third-party tracker of any kind. Your plans
          are never used to train a model. Nothing is sold.
        </p>
        <p>
          One external request does happen: the pages load a typeface from Google Fonts, which means
          Google sees the address your browser connects from. Self-hosting that font is on the list.
        </p>

        <h2>Cookies and browser storage</h2>
        <p>
          One cookie, <code>sp_refresh</code>, holds your session. It is set httpOnly, so page
          scripts cannot read it, and it is the only cookie the service sets. Your light or dark
          preference is kept in your browser&rsquo;s local storage and never leaves the machine.
        </p>

        <h2>Who can see your plans</h2>
        <ul>
          <li>People in the workspace, limited by the role they were given.</li>
          <li>
            Anyone holding a share link you created — read only, and until you stop sharing it.
          </li>
          <li>Any agent holding an API key for that workspace.</li>
          <li>
            Whoever operates the instance, who necessarily has access to its database. On the hosted
            service that is ruma.
          </li>
        </ul>

        <h2>Connecting an AI agent</h2>
        <p>
          When you connect an agent over MCP, whatever that agent reads goes to whoever runs it —
          Anthropic, OpenAI, or your own machine, depending on the client. That relationship is
          between you and them, and their policy governs it. Connect an agent to a workspace only if
          you are comfortable with its provider reading the plans in that workspace.
        </p>

        <h2>Keeping and deleting</h2>
        <p>
          Data is kept until it is deleted. Deleting a plan removes it and its collaborative
          document. Revoking an API key stops it working immediately. Self-service account deletion
          is not built yet; ask on <Link href={ISSUES}>GitHub Issues</Link> and the account and
          everything in it will be removed.
        </p>

        <h2>Where it runs</h2>
        <p>
          The hosted instance runs on infrastructure operated by ruma. A self-hosted instance runs
          wherever its operator puts it, and nothing in it reports back here.
        </p>

        <h2>Contact</h2>
        <p>
          Questions and requests go to <Link href={ISSUES}>GitHub Issues</Link>.
        </p>
      </Prose>
    </SiteChrome>
  );
}
