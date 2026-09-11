import { Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownAction } from '@/components/ui/dropdown-menu';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { RowMenu } from '@/components/ui/row-menu';
import { Select } from '@/components/ui/select';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { admin, type InviteSummary } from '@/lib/api';
import { useLiveList } from '@/lib/use-live-list';
import { cn, formatWhen, plural } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/use-document-title';

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
 * Every way onto this instance, and only the ones that still work.
 *
 * The question this screen answers is "who could sign up right now" — so what
 * is spent, expired or withdrawn is folded out of the way rather than left
 * cluttering the answer, and the sign-up code from the configuration is listed
 * as what it is: a way in, held by anyone who has the string. A screen that
 * lists doors and leaves out the unlocked one is worse than no screen.
 */
export function InvitationsPage() {
  useDocumentTitle('Invitations');
  const [invites, setInvites] = useState<InviteSummary[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [making, setMaking] = useState(false);
  const [showSpent, setShowSpent] = useState(false);
  const [label, setLabel] = useState('');
  const [limit, setLimit] = useState('1');
  const [life, setLife] = useState('14');
  // Shown once, because only the hash is kept. Losing it means issuing another.
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<InviteSummary | null>(null);

  const reload = (): void => {
    admin
      .invites()
      .then((answer) => {
        setInvites(answer.invites);
        setCode(answer.code);
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

  const act = async (run: Promise<unknown>): Promise<void> => {
    try {
      await run;
      setDeleting(null);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  const copy = (text: string): void => {
    void navigator.clipboard.writeText(text);
    setCopied(text);
  };

  if (invites === null && error === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }

  const all = invites ?? [];
  const live = all.filter((invite) => invite.state === 'live');
  const spent = all.filter((invite) => invite.state !== 'live');
  const shown = showSpent ? all : live;

  return (
    <div className="space-y-4">
      {error !== null ? <Problem error={error} /> : null}

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

      {/* Listed rather than alluded to. Anyone holding this string can sign up,
          and nothing records that they did — which is the point of saying so
          here, beside the links that do. */}
      {code === null ? null : (
        <div className="rounded-lg border border-status-progress/30 bg-surface-2 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">The sign-up code</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Set in this deployment&rsquo;s configuration. Anyone who has it can make an account
                without a link, as many times as they like, and nothing here records that they did.
                Clear <span className="slug">REGISTRATION_CODE</span> to take this door away.
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => copy(code)}>
              <Copy className="size-3.5" />
              {copied === code ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="slug mt-2 rounded-sm bg-surface px-2 py-1 text-ink">{code}</p>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty
          title={live.length === 0 && spent.length > 0 ? 'No invitations still open' : 'No invitations yet'}
          body={
            code === null
              ? 'Nobody can sign up until you issue a link.'
              : 'The code above is the only way in at the moment.'
          }
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
              <span className="sr-only">Actions</span>
            </TH>
          </THead>
          <tbody>
            {shown.map((invite) => (
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
                  <span className="flex justify-end">
                    <RowMenu label={invite.label === '' ? 'this invitation' : invite.label}>
                      {invite.state !== 'live' ? null : (
                        <DropdownAction onSelect={() => void act(admin.withdrawInvite(invite.id))}>
                          Withdraw
                        </DropdownAction>
                      )}
                      <DropdownAction tone="danger" onSelect={() => setDeleting(invite)}>
                        <Trash2 className="size-3.5" />
                        Delete
                      </DropdownAction>
                    </RowMenu>
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {spent.length === 0 ? null : (
        <button
          type="button"
          onClick={() => setShowSpent((open) => !open)}
          className="text-xs text-ink-faint transition-colors hover:text-ink"
        >
          {showSpent
            ? 'Hide what is no longer open'
            : `${plural(spent.length, 'invitation')} no longer open — show`}
        </button>
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
              {(id) => <Select id={id} value={limit} onChange={setLimit} options={LIMITS} />}
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
            setCopied(null);
          }
        }}
        title="The link"
        description="Copy it now. Only its hash is kept, so it cannot be shown again — issue another if it is lost."
      >
        <div className="space-y-3">
          <Input readOnly value={issued ?? ''} onFocus={(event) => event.target.select()} />
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => copy(issued ?? '')}>
              <Copy className="size-3.5" />
              {copied === issued ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this invitation?"
        description={
          deleting !== null && deleting.accounts.length > 0
            ? `${plural(deleting.accounts.length, 'account')} came in through it and will stop saying how they got here. Withdrawing it instead stops it working and keeps that.`
            : 'It will stop working and be forgotten. Withdrawing it instead keeps the record.'
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting !== null) void act(admin.deleteInvite(deleting.id));
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
