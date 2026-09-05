import type { Metadata } from 'next';
import Link from 'next/link';

import { Prose } from '@/components/Prose';
import { SiteChrome } from '@/components/SiteChrome';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms that apply to the hosted Schematic Planner service.',
};

const ISSUES = 'https://github.com/ridanit-ruma/schematic-planner/issues';

export default function Terms() {
  return (
    <SiteChrome>
      <Prose
        title="Terms of service"
        updated="6 September 2026"
        lede="These terms cover the hosted Schematic Planner service, operated by ruma. They do not
          cover the software itself: that is licensed under the AGPL, and anyone running their own
          instance sets their own terms."
      >
        <h2>The service is early</h2>
        <p>
          Schematic Planner is pre-alpha. It is provided as it is, features change, and data can be
          lost. Do not keep anything here that you could not stand to lose. Export your plans
          regularly — that is what the export exists for, and it produces files that need nothing
          from this service to be readable.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>Give a working email address. It is how an account is recovered and identified.</li>
          <li>
            You are responsible for your password and for everything done through your account.
          </li>
          <li>
            An account belongs to one person. To work with other people, invite them into a
            workspace rather than sharing a login.
          </li>
        </ul>

        <h2>API keys and agents</h2>
        <p>
          A key acts as you inside the workspace it was issued for. Anything an AI agent does with
          your key is your action, including deleting plans. Treat a key like a password: give it to
          one client, and revoke it the moment you no longer control where it is.
        </p>

        <h2>What you write stays yours</h2>
        <p>
          You keep every right you had in the plans you create. Running the service requires
          permission to store what you write, process it to render and export it, and show it to the
          people and agents you have shared it with. That permission goes no further. Your plans are
          not used to train any model, and they are not sold or handed to anyone else.
        </p>

        <h2>Acceptable use</h2>
        <p>Do not use the service to:</p>
        <ul>
          <li>store or distribute anything unlawful, or anything you have no right to store;</li>
          <li>reach an account, workspace or plan that was not shared with you;</li>
          <li>
            disrupt the service for other people, including by automated load that is not ordinary
            use;
          </li>
          <li>distribute malware, or use a share link to deliver one.</li>
        </ul>

        <h2>Availability</h2>
        <p>
          There is no uptime commitment. The service may be unavailable, and features may change or
          be withdrawn. Where a change would lose data or break an established workflow, notice will
          be given in advance if that is possible.
        </p>

        <h2>Ending the arrangement</h2>
        <p>
          You may stop using the service whenever you like. To have your account and everything in
          it deleted, ask on <Link href={ISSUES}>GitHub Issues</Link> — self-service deletion is not
          built yet, and saying otherwise would be untrue. An account that breaks these terms may be
          suspended, with an explanation.
        </p>

        <h2>No warranty, and the limit of liability</h2>
        <p>
          The service is provided without warranty of any kind. To the fullest extent the law
          allows, the operator is not liable for lost data, lost profit, or any indirect loss
          arising from use of the service. Nothing here removes a right you hold that cannot be
          waived under the law that applies to you.
        </p>

        <h2>The software and the service are separate</h2>
        <p>
          The service runs the Schematic Planner software, which is licensed to everyone under the{' '}
          <Link href="https://www.gnu.org/licenses/agpl-3.0.html">
            GNU Affero General Public License v3.0
          </Link>
          . Using this service grants you no rights in the software beyond that licence, and that
          licence grants you no rights in this service. You are free to run your own instance
          instead; the source is public and the deployment is one Compose file.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          These terms may change. The date at the top says when they last did. Continuing to use the
          service after a change means the new terms apply to you.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of the Republic of Korea, and any dispute arising
          from them falls to the courts of the Republic of Korea.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, complaints and deletion requests go to{' '}
          <Link href={ISSUES}>GitHub Issues</Link>. There is no other channel yet.
        </p>
      </Prose>
    </SiteChrome>
  );
}
