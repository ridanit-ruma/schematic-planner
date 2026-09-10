import { Copy, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { admin, type InviteSummary } from '@/lib/api';
import { useLiveList } from '@/lib/use-live-list';
import { cn, formatWhen } from '@/lib/utils';

const LIMITS = [
  { value: '1', label: 'One person' },
  { value: '5', label: 'Up to five' },
  { value: '25', label: 'Up to twenty-five' },
  { value: '', label: 'No limit' },
];

const LIVES = [
  { value: '1', label: 'A day' },
  { value: '7', label: 'A week' },
  { value: '14', label: 'A fortnight' },
  { value: '90', label: 'Three months' },
  { value: '', label: 'Until withdrawn' },
];

/**
 * Ways onto this instance, issued rather than shared.
 *
 * What this replaces is one code everybody types: it could not be given to one
 * person, taken back from them, or matched to who used it. Each of these has a
 * name on it, a limit, an expiry, and the accounts that came in through it.
 */
export function InvitationsPage() {
  const [invites, setInvites] = useState<InviteSummary[] | null>(null);
  const [standingCode, setStandingCode] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [making, setMaking] = useState(false);
  const [label, setLabel] = useState('');
  const [limit, setLimit] = useState('1');
  const [life, setLife] = useState('14');
  // Shown once, because only the hash is kept. Losing it means issuing another.
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = (): void => {
    admin
      .invites()
      .then((answer) => {
        setInvites(answer.invites);
        setStandingCode(answer.standingCode);
      })
      .catch(setError);
  };
  useLiveList(reload, []);

  const create = async (): Promise<void> => {
    try {
      const { token } = await admin.createInvite({
        label: label.trim(),
        maxUses: limit === '' ? null : Number(limit),
        expiresInDays: life === '' ? null : Number(life),
      });
      setIssued(`${window.location.origin}/register?invite=${token}`);
      setLabel('');
      setMaking(false);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  const revoke = async (invite: InviteSummary): Promise<void> => {
    try {
      await admin.revokeInvite(invite.id);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  if (invites === null && error === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }
  const rows = invites ?? [];

  return (
    <div className="space-y-4">
      {error !== null ? <Problem error={error} /> : null}

      {/* Saying it rather than meaning something else quietly: while a code is
          configured, these links are not the only way in. */}
      {!standingCode ? null : (
        <p className="rounded-lg border border-status-progress/30 bg-surface-2 px-3 py-2 text-xs text-ink-muted">
          <span className="text-ink">This instance also has a sign-up code set.</span> Anyone who
          has that string can make an account without a link, and nothing here records that they
          did. Clear <span className="slug">REGISTRATION_CODE</span> to make these links the only
          way in.
        </p>
      )}

      <div className="flex items-start justify-between gap-4">
        <p className="max-w-prose text-sm text-ink-muted">
          A link lets somebody make an account here. Give one to a person rather than a code to
          everybody: it can be limited, withdrawn, and told apart afterwards.
        </p>
        <Button variant="primary" onClick={() => setMaking(true)}>
          <Plus className="size-3.5" />
          New link
        </Button>
      </div>

      {rows.length === 0 ? (
        <Empty
          title="No invitations yet"
          body="Nobody can sign up until you issue a link, unless this instance has never had an account."
        />
      ) : (
        <Table>
          <THead>
            <TH>Invitation</TH>
            <TH className="w-28" hide="sm">
              Used
            </TH>
            <TH className="w-32" hide="md">
              Expires
            </TH>
            <TH className="w-24 sm:w-28" align="right">
              State
            </TH>
            <TH className="w-10" align="right">
              <span className="sr-only">Withdraw</span>
            </TH>
          </THead>
          <tbody>
            {rows.map((invite) => (
              <TR key={invite.id}>
                <TD>
                  <span className="block truncate font-medium text-ink">
                    {invite.label === '' ? 'Untitled' : invite.label}
                  </span>
                  <span className="slug block truncate text-2xs text-ink-faint">
                    {invite.prefix}… · by {invite.createdBy}
                  </span>
                  {invite.accounts.length === 0 ? null : (
                    <span className="block truncate text-2xs text-ink-muted">
                      {invite.accounts.map((account) => account.name).join(', ')}
                    </span>
                  )}
                </TD>
                <TD className="text-xs text-ink-muted" hide="sm">
                  {invite.uses}
                  {invite.maxUses === null ? '' : ` of ${invite.maxUses}`}
                </TD>
                <TD className="text-xs text-ink-muted" hide="md">
                  {invite.expiresAt === null ? 'Never' : formatWhen(invite.expiresAt)}
                </TD>
                <TD align="right">
                  <span
                    className={cn(
                      'text-xs',
                      invite.state === 'live' ? 'text-status-done' : 'text-ink-faint',
                    )}
                  >
                    {invite.state}
                  </span>
                </TD>
                <TD align="right">
                  {invite.state === 'withdrawn' ? null : (
                    <Button size="sm" variant="ghost" onClick={() => void revoke(invite)}>
                      Withdraw
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={making} onOpenChange={setMaking} title="New invitation">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field label="What it is for" hint="Only you see this. It is how you tell links apart.">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="For the design review"
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="How many accounts">
              {(id) => (
                <Select id={id} value={limit} onChange={setLimit} options={LIMITS} />
              )}
            </Field>
            <Field label="How long it lasts">
              {(id) => <Select id={id} value={life} onChange={setLife} options={LIVES} />}
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMaking(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Issue link
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={issued !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIssued(null);
            setCopied(false);
          }
        }}
        title="The link"
        description="Copy it now. Only its hash is kept, so it cannot be shown again — issue another if it is lost."
      >
        <div className="space-y-3">
          <Input readOnly value={issued ?? ''} onFocus={(event) => event.target.select()} />
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                void navigator.clipboard.writeText(issued ?? '');
                setCopied(true);
              }}
            >
              <Copy className="size-3.5" />
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
