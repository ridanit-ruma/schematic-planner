import { useState } from 'react';

import { Author } from '@/components/ui/author';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownAction } from '@/components/ui/dropdown-menu';
import { Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { RowMenu } from '@/components/ui/row-menu';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { admin, type AccountSummary } from '@/lib/api';
import { useLiveList } from '@/lib/use-live-list';
import { useAuth } from '@/lib/auth-store';
import { formatWhen, plural } from '@/lib/utils';

/**
 * Everyone with an account here, what they hold, and when they were last seen
 * doing something.
 *
 * "Last seen" is the last change they made to any plan rather than the last
 * time they signed in: a tab left open all week is not use, and the history is
 * already a record of what people actually did.
 */
export function PeoplePage() {
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
          <TH>Account</TH>
          <TH className="w-32" hide="md">
            Holds
          </TH>
          <TH className="w-28" hide="sm">
            Joined
          </TH>
          <TH className="w-28 sm:w-32" align="right">
            Last change
          </TH>
          <TH className="w-10" align="right">
            <span className="sr-only">Actions</span>
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
                          owner
                        </span>
                      ) : null}
                      {account.suspendedAt === null ? null : (
                        <span className="shrink-0 text-2xs text-danger">suspended</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">{account.email}</span>
                    {account.invitedVia === null ? null : (
                      <span className="block truncate text-2xs text-ink-faint">
                        via {account.invitedVia.label === '' ? 'an invitation' : account.invitedVia.label}
                      </span>
                    )}
                  </span>
                </span>
              </TD>
              <TD className="text-xs text-ink-muted" hide="md">
                {plural(account.workspaces, 'workspace')} · {plural(account.plans, 'plan')}
                {account.keys > 0 ? ` · ${plural(account.keys, 'key')}` : ''}
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
                        Withdraw ownership
                      </DropdownAction>
                    ) : (
                      <DropdownAction
                        onSelect={() => void change(account, { instanceRole: 'OWNER' })}
                      >
                        Make an owner
                      </DropdownAction>
                    )}
                    {account.suspendedAt === null ? (
                      <DropdownAction
                        tone="danger"
                        onSelect={() => setSuspending(account)}
                      >
                        Suspend
                      </DropdownAction>
                    ) : (
                      <DropdownAction onSelect={() => void change(account, { suspended: false })}>
                        Let back in
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
        Signed in as <Author by={{ name: me?.name ?? 'you', agent: null }} />. An account is
        suspended rather than deleted, so what it drew stays attributed to somebody.
      </p>

      <Modal
        open={suspending !== null}
        onOpenChange={(open) => !open && setSuspending(null)}
        title={`Suspend ${suspending?.name ?? ''}?`}
        description="They are signed out everywhere immediately and cannot sign in again. Their workspaces, plans and history stay exactly as they are."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setSuspending(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (suspending !== null) void change(suspending, { suspended: true });
            }}
          >
            Suspend
          </Button>
        </div>
      </Modal>
    </div>
  );
}
