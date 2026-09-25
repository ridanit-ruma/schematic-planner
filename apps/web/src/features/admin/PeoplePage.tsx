import { useState } from 'react';

import { Author } from '@/components/ui/author';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownAction } from '@/components/ui/dropdown-menu';
import { Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { RowMenu } from '@/components/ui/row-menu';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { useT } from '@/i18n';
import { admin, type AccountSummary } from '@/lib/api';
import { useLiveList } from '@/lib/use-live-list';
import { useAuth } from '@/lib/auth-store';
import { formatWhen } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Everyone with an account here, what they hold, and when they were last seen
 * doing something.
 *
 * "Last seen" is the last change they made to any plan rather than the last
 * time they signed in: a tab left open all week is not use, and the history is
 * already a record of what people actually did.
 */
export function PeoplePage() {
  const t = useT();
  useDocumentTitle(t.admin.people.documentTitle);
  const me = useAuth((state) => state.user);
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [suspending, setSuspending] = useState<AccountSummary | null>(null);

  const reload = (): void => {
    admin.accounts().then(setAccounts).catch(setError);
  };
  useLiveList(reload, []);

  const change = async (
    account: AccountSummary,
    input: { instanceRole?: 'OWNER' | 'MEMBER'; suspended?: boolean },
  ): Promise<void> => {
    try {
      await admin.updateAccount(account.id, input);
      setSuspending(null);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  if (accounts === null && error === null) {
    return (
      <div className="grid py-24 place-items-center">
        <Spinner />
      </div>
    );
  }
  const rows = accounts ?? [];

  return (
    <div className="space-y-4">
      {error !== null ? <Problem error={error} /> : null}

      <Table>
        <THead>
          <TH>{t.admin.people.columns.account}</TH>
          <TH className="w-32" hide="md">
            {t.admin.people.columns.holds}
          </TH>
          <TH className="w-28" hide="sm">
            {t.admin.people.columns.joined}
          </TH>
          <TH className="w-28 sm:w-32" align="right">
            {t.admin.people.columns.lastChange}
          </TH>
          <TH className="w-10" align="right">
            <span className="sr-only">{t.admin.actions}</span>
          </TH>
        </THead>
        <tbody>
          {rows.map((account) => (
            <TR key={account.id}>
              <TD>
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar src={account.avatarUrl} name={account.name} className="size-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-ink">{account.name}</span>
                      {account.instanceRole === 'OWNER' ? (
                        <span className="rail-heading shrink-0 rounded-sm border border-rule px-1">
                          {t.admin.people.owner}
                        </span>
                      ) : null}
                      {account.suspendedAt === null ? null : (
                        <span className="shrink-0 text-2xs text-danger">
                          {t.admin.people.suspended}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">{account.email}</span>
                    {account.invitedVia === null ? null : (
                      <span className="block truncate text-2xs text-ink-faint">
                        {account.invitedVia.label === ''
                          ? t.admin.people.viaInvitation
                          : t.admin.people.via(account.invitedVia.label)}
                      </span>
                    )}
                  </span>
                </span>
              </TD>
              <TD className="text-xs text-ink-muted" hide="md">
                {t.admin.people.holds(account.workspaces, account.plans, account.keys)}
              </TD>
              <TD className="text-xs text-ink-muted" hide="sm">
                {formatWhen(account.createdAt)}
              </TD>
              <TD align="right" className="text-xs text-ink-muted">
                {account.lastChangeAt === null ? '—' : formatWhen(account.lastChangeAt)}
              </TD>
              <TD align="right">
                <span className="flex justify-end">
                  <RowMenu label={account.name}>
                    {account.instanceRole === 'OWNER' ? (
                      <DropdownAction
                        onSelect={() => void change(account, { instanceRole: 'MEMBER' })}
                      >
                        {t.admin.people.withdrawOwnership}
                      </DropdownAction>
                    ) : (
                      <DropdownAction
                        onSelect={() => void change(account, { instanceRole: 'OWNER' })}
                      >
                        {t.admin.people.makeOwner}
                      </DropdownAction>
                    )}
                    {account.suspendedAt === null ? (
                      <DropdownAction tone="danger" onSelect={() => setSuspending(account)}>
                        {t.admin.people.suspend}
                      </DropdownAction>
                    ) : (
                      <DropdownAction onSelect={() => void change(account, { suspended: false })}>
                        {t.admin.people.letBackIn}
                      </DropdownAction>
                    )}
                  </RowMenu>
                </span>
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>

      <p className="text-xs text-ink-faint">
        {t.admin.people.signedInAs(
          <Author by={{ name: me?.name ?? t.admin.people.you, agent: null }} />,
        )}
      </p>

      <Modal
        open={suspending !== null}
        onOpenChange={(open) => !open && setSuspending(null)}
        title={t.admin.people.suspendTitle(suspending?.name ?? '')}
        description={t.admin.people.suspendDescription}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setSuspending(null)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (suspending !== null) void change(suspending, { suspended: true });
            }}
          >
            {t.admin.people.suspend}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
