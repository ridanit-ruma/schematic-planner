import { Check, Copy, Link2Off, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Page } from '@/components/ui/page';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { workspaces, type Member, type Role, type WorkspaceInvite } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { formatWhen } from '@/lib/utils';
import { useLiveList } from '@/lib/use-live-list';
import { useWorkspace } from './workspace-context';

const ROLES: Role[] = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'];

const ROLE_HELP: Record<Role, string> = {
  VIEWER: 'Can read plans and export them.',
  EDITOR: 'Can draw, and can create keys for agents.',
  ADMIN: 'Can also invite people and change roles.',
  OWNER: 'Can also delete the workspace.',
};

/** What each role can do, said where the role is chosen rather than beside it. */
const ROLE_OPTIONS = ROLES.map((role) => ({
  value: role,
  label: role.toLowerCase(),
  hint: ROLE_HELP[role],
}));

/** Nobody may invite above their own role, so nobody is offered the option. */
function invitableRoles(actor: Role): typeof ROLE_OPTIONS {
  const ceiling = ROLES.indexOf(actor);
  return ROLE_OPTIONS.filter((option) => ROLES.indexOf(option.value) <= ceiling);
}

export function MembersPage() {
  const { current } = useWorkspace();
  const me = useAuth((state) => state.user);
  const canManage = current.role === 'OWNER' || current.role === 'ADMIN';

  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteRole, setInviteRole] = useState<Role>('EDITOR');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = (): void => {
    workspaces.members(current.id).then(setMembers).catch(setError);
    // Only an admin may read these, and only an admin is shown them.
    if (canManage) workspaces.invites(current.id).then(setInvites).catch(() => setInvites([]));
  };
  useLiveList(reload, [current.id]);

  const act = async (run: Promise<unknown>): Promise<void> => {
    try {
      await run;
      setError(null);
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <Page
      title="Members"
      description={`Everyone who can open ${current.name}.`}
      actions={
        canManage ? (
          <Button variant="primary" onClick={() => setInviting(true)}>
            <UserPlus className="size-3.5" />
            Invite someone
          </Button>
        ) : undefined
      }
    >
      {error !== null ? (
        <div className="mt-4">
          <Problem error={error} />
        </div>
      ) : null}

      {members === null ? (
        <div className="grid py-16 place-items-center">
          <Spinner />
        </div>
      ) : members.length === 0 ? (
        <Empty
          title="Nobody here"
          body="That should not be possible — a workspace keeps an owner."
        />
      ) : (
        <Table>
          <THead>
            <TH>Person</TH>
            <TH className="w-28 sm:w-36">Role</TH>
            <TH className="w-10 sm:w-24" align="right">
              <span className="sr-only">Actions</span>
            </TH>
          </THead>
          <tbody>
            {members.map((member) => {
              const isMe = member.user.id === me?.id;
              return (
                <TR key={member.user.id}>
                  <TD>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        src={member.user.avatarUrl}
                        name={member.user.name}
                        className="size-7"
                      />
                      <div className="min-w-0">
                        <span className="block truncate text-ink">
                          {member.user.name}
                          {isMe ? <span className="ml-2 text-xs text-ink-faint">you</span> : null}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {member.user.email}
                        </span>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    {canManage && !isMe ? (
                      <Select
                        value={member.role}
                        options={ROLE_OPTIONS}
                        className="w-full"
                        onChange={(role) =>
                          void act(workspaces.updateMember(current.id, member.user.id, role))
                        }
                      />
                    ) : (
                      <span className="text-xs text-ink-muted">{member.role.toLowerCase()}</span>
                    )}
                  </TD>
                  <TD align="right">
                    {canManage && !isMe ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void act(workspaces.removeMember(current.id, member.user.id))
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}

      {!canManage || invites.length === 0 ? null : (
        <section className="mt-8">
          <h2 className="rail-heading mb-2 text-ink-faint">Open invitations</h2>
          <p className="mb-3 text-xs text-ink-muted">
            Links that would still let somebody in. A spent or expired one is not listed;
            withdrawing one stops it working immediately.
          </p>
          <Table>
            <THead>
              <TH>Link</TH>
              <TH className="w-24">Role</TH>
              <TH className="w-28 sm:w-36" align="right" hide="md">
                Expires
              </TH>
              <TH className="w-10 sm:w-28" align="right">
                <span className="sr-only">Actions</span>
              </TH>
            </THead>
            <tbody>
              {invites.map((invite) => (
                <TR key={invite.id}>
                  <TD>
                    <span className="slug block truncate text-ink">
                      {invite.prefix === '' ? 'issued earlier' : `${invite.prefix}…`}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {invite.email ?? `by ${invite.createdBy}`}
                    </span>
                  </TD>
                  <TD className="text-xs text-ink-muted">{invite.role.toLowerCase()}</TD>
                  <TD align="right" className="text-xs text-ink-muted" hide="md">
                    {formatWhen(invite.expiresAt)}
                  </TD>
                  <TD align="right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void act(workspaces.revokeInvite(current.id, invite.id))}
                    >
                      <Link2Off className="size-3.5" />
                      Withdraw
                    </Button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      <Modal
        open={inviting}
        onOpenChange={(open) => {
          setInviting(open);
          if (!open) setInviteUrl(null);
        }}
        title="Invite someone"
        description="Creates a link. Anyone who opens it joins this workspace at the role you pick."
      >
        {inviteUrl === null ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void workspaces
                .invite(current.id, inviteRole)
                .then((result) => {
                  setInviteUrl(result.url);
                  // The link is now one of the open ones, and the list below
                  // is where it is withdrawn from.
                  reload();
                })
                .catch(setError);
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="invite-role" className="block text-xs font-medium text-ink-muted">
                Role
              </label>
              <Select
                id="invite-role"
                value={inviteRole}
                options={invitableRoles(current.role)}
                onChange={setInviteRole}
              />
              <p className="text-xs text-ink-faint">{ROLE_HELP[inviteRole]}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setInviting(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create link
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-ink-muted">
              The link expires in 14 days. There is no email yet, so send it yourself.
            </p>
            <div className="flex items-center gap-2">
              <code className="slug min-w-0 flex-1 truncate rounded-md border border-rule bg-surface-2 px-2.5 py-2 text-ink">
                {inviteUrl}
              </code>
              <Button
                size="icon"
                variant="quiet"
                aria-label="Copy"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteUrl).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
