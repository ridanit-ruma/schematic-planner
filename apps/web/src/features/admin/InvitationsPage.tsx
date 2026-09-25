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
import { useT, type Messages } from '@/i18n';
import { admin, type InviteSummary } from '@/lib/api';
import { useLiveList } from '@/lib/use-live-list';
import { cn, formatWhen } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/use-document-title';

const limits = (t: Messages) => [
  { value: '1', label: t.admin.invitations.limits.one },
  { value: '5', label: t.admin.invitations.limits.five },
  { value: '25', label: t.admin.invitations.limits.twentyFive },
  { value: '', label: t.admin.invitations.limits.none },
];

const lives = (t: Messages) => [
  { value: '1', label: t.admin.invitations.lives.day },
  { value: '7', label: t.admin.invitations.lives.week },
  { value: '14', label: t.admin.invitations.lives.fortnight },
  { value: '90', label: t.admin.invitations.lives.threeMonths },
  { value: '', label: t.admin.invitations.lives.forever },
];

const STATE_LABELS = {
  live: 'live',
  'used up': 'usedUp',
  expired: 'expired',
  withdrawn: 'withdrawn',
} as const satisfies Record<
  InviteSummary['state'],
  keyof Messages['admin']['invitations']['states']
>;

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
  const t = useT();
  useDocumentTitle(t.admin.invitations.documentTitle);
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
        <p className="max-w-prose text-sm text-ink-muted">{t.admin.invitations.intro}</p>
        <Button variant="primary" onClick={() => setMaking(true)}>
          <Plus className="size-3.5" />
          {t.admin.invitations.newLink}
        </Button>
      </div>

      {/* Listed rather than alluded to. Anyone holding this string can sign up,
          and nothing records that they did — which is the point of saying so
          here, beside the links that do. */}
      {code === null ? null : (
        <div className="rounded-lg border border-status-progress/30 bg-surface-2 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{t.admin.invitations.code.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {t.admin.invitations.code.body(<span className="slug">REGISTRATION_CODE</span>)}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => copy(code)}>
              <Copy className="size-3.5" />
              {copied === code ? t.admin.invitations.copied : t.admin.invitations.copy}
            </Button>
          </div>
          <p className="slug mt-2 rounded-sm bg-surface px-2 py-1 text-ink">{code}</p>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty
          title={
            live.length === 0 && spent.length > 0
              ? t.admin.invitations.empty.noneOpen
              : t.admin.invitations.empty.noneYet
          }
          body={
            code === null ? t.admin.invitations.empty.noCode : t.admin.invitations.empty.onlyCode
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>{t.admin.invitations.columns.invitation}</TH>
            <TH className="w-28" hide="sm">
              {t.admin.invitations.columns.used}
            </TH>
            <TH className="w-32" hide="md">
              {t.admin.invitations.columns.expires}
            </TH>
            <TH className="w-24 sm:w-28" align="right">
              {t.admin.invitations.columns.state}
            </TH>
            <TH className="w-10" align="right">
              <span className="sr-only">{t.admin.actions}</span>
            </TH>
          </THead>
          <tbody>
            {shown.map((invite) => (
              <TR key={invite.id}>
                <TD>
                  <span className="block truncate font-medium text-ink">
                    {invite.label === '' ? t.admin.invitations.untitled : invite.label}
                  </span>
                  <span className="slug block truncate text-2xs text-ink-faint">
                    {t.admin.invitations.byline(invite.prefix, invite.createdBy)}
                  </span>
                  {invite.accounts.length === 0 ? null : (
                    <span className="block truncate text-2xs text-ink-muted">
                      {invite.accounts.map((account) => account.name).join(', ')}
                    </span>
                  )}
                </TD>
                <TD className="text-xs text-ink-muted" hide="sm">
                  {t.admin.invitations.uses(invite.uses, invite.maxUses)}
                </TD>
                <TD className="text-xs text-ink-muted" hide="md">
                  {invite.expiresAt === null
                    ? t.admin.invitations.never
                    : formatWhen(invite.expiresAt)}
                </TD>
                <TD align="right">
                  <span
                    className={cn(
                      'text-xs',
                      invite.state === 'live' ? 'text-status-done' : 'text-ink-faint',
                    )}
                  >
                    {t.admin.invitations.states[STATE_LABELS[invite.state]]}
                  </span>
                </TD>
                <TD align="right">
                  <span className="flex justify-end">
                    <RowMenu
                      label={
                        invite.label === '' ? t.admin.invitations.thisInvitation : invite.label
                      }
                    >
                      {invite.state !== 'live' ? null : (
                        <DropdownAction onSelect={() => void act(admin.withdrawInvite(invite.id))}>
                          {t.admin.invitations.withdraw}
                        </DropdownAction>
                      )}
                      <DropdownAction tone="danger" onSelect={() => setDeleting(invite)}>
                        <Trash2 className="size-3.5" />
                        {t.common.delete}
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
          {showSpent ? t.admin.invitations.hideSpent : t.admin.invitations.showSpent(spent.length)}
        </button>
      )}

      <Modal open={making} onOpenChange={setMaking} title={t.admin.invitations.create.title}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field
            label={t.admin.invitations.create.label}
            hint={t.admin.invitations.create.labelHint}
          >
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t.admin.invitations.create.labelPlaceholder}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.admin.invitations.create.limit}>
              {(id) => <Select id={id} value={limit} onChange={setLimit} options={limits(t)} />}
            </Field>
            <Field label={t.admin.invitations.create.life}>
              {(id) => <Select id={id} value={life} onChange={setLife} options={lives(t)} />}
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMaking(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {t.admin.invitations.create.submit}
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
        title={t.admin.invitations.issued.title}
        description={t.admin.invitations.issued.description}
      >
        <div className="space-y-3">
          <Input readOnly value={issued ?? ''} onFocus={(event) => event.target.select()} />
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => copy(issued ?? '')}>
              <Copy className="size-3.5" />
              {copied === issued ? t.admin.invitations.copied : t.admin.invitations.issued.copy}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t.admin.invitations.remove.title}
        description={
          deleting !== null && deleting.accounts.length > 0
            ? t.admin.invitations.remove.withAccounts(deleting.accounts.length)
            : t.admin.invitations.remove.withoutAccounts
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting !== null) void act(admin.deleteInvite(deleting.id));
            }}
          >
            {t.common.delete}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
