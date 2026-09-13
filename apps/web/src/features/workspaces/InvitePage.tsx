import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Wordmark } from '@/components/Mark';
import { Button } from '@/components/ui/button';
import { Problem, Spinner } from '@/components/ui/feedback';
import { workspaces, type InvitePreview } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useDocumentTitle } from '@/lib/use-document-title';

const ROLE_MEANING: Record<string, string> = {
  OWNER: 'run the workspace, including deleting it',
  ADMIN: 'manage members and projects',
  EDITOR: 'draw on every plan in it',
  VIEWER: 'read every plan in it',
};

/**
 * An invitation, shown before it is taken.
 *
 * It used to accept on mount: opening the link was the whole of accepting it,
 * and a link forwarded into a chat joined whoever clicked it. Nothing here
 * writes except the two buttons.
 */
export function InvitePage() {
  useDocumentTitle('Invitation');
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const status = useAuth((state) => state.status);

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [memberSlug, setMemberSlug] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    workspaces
      .previewInvite(token)
      .then((preview) => {
        if (live) setInvite(preview);
        return preview;
      })
      .catch((reason) => {
        if (live) setError(reason);
        return null;
      });
    return () => {
      live = false;
    };
  }, [token]);

  // Whether this is somewhere they are already, which turns Accept into a
  // button that would do nothing and should not be offered. Skipped once the
  // invitation is settled: nothing on that render needs memberSlug either.
  useEffect(() => {
    if (invite === null || invite.status !== 'open' || status !== 'signed-in') return;
    let live = true;
    void workspaces.list().then((list) => {
      const already = list.find((entry) => entry.id === invite.workspace.id);
      if (live) setMemberSlug(already?.slug ?? null);
    });
    return () => {
      live = false;
    };
    // Keyed on the workspace id, not the whole invite object, so decline()
    // replacing that object with a copy does not re-fire this read.
  }, [invite?.workspace.id, invite?.status, status]);

  const accept = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await workspaces.acceptInvite(token);
      const list = await workspaces.list();
      const joined = list.find((entry) => entry.id === result.workspace.id);
      navigate(joined === undefined ? '/recent' : `/workspace/${joined.slug}`, { replace: true });
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  const decline = async (): Promise<void> => {
    setBusy(true);
    try {
      await workspaces.declineInvite(token);
      setInvite((current) => (current === null ? null : { ...current, status: 'declined' }));
    } catch (reason) {
      setError(reason);
    }
    setBusy(false);
  };

  if (error !== null) {
    return (
      <Shell>
        <Problem error={error} />
      </Shell>
    );
  }
  if (invite === null) {
    return (
      <Shell>
        <div className="grid place-items-center py-8">
          <Spinner />
        </div>
      </Shell>
    );
  }

  const settled =
    invite.status === 'accepted'
      ? 'This invitation has already been used.'
      : invite.status === 'declined'
        ? 'This invitation was turned down.'
        : invite.status === 'expired'
          ? 'This invitation has expired.'
          : null;

  return (
    <Shell>
      <p className="text-sm text-ink-muted">
        <span className="text-ink">{invite.invitedBy.name}</span> invited you to
      </p>
      <h1 className="mt-1 text-xl font-medium text-ink">{invite.workspace.name}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        As <span className="text-ink">{invite.role.toLowerCase()}</span>, so you can{' '}
        {ROLE_MEANING[invite.role] ?? 'take part in it'}.
      </p>

      {/*
        memberSlug wins over settled: somebody who accepted this invitation and
        later reopens the link from their chat history is a member now, and
        that is more true than "this invitation has already been used" — which
        reads like a dead end instead of the membership it actually is.
      */}
      {memberSlug !== null ? (
        <div className="mt-6">
          <p className="text-sm text-ink-muted">You are already in this workspace.</p>
          <Button
            variant="primary"
            className="mt-3 w-full"
            onClick={() => navigate(`/workspace/${memberSlug}`, { replace: true })}
          >
            Open {invite.workspace.name}
          </Button>
        </div>
      ) : settled !== null ? (
        <p className="mt-6 rounded-md border border-rule bg-surface-3 px-3 py-2 text-sm text-ink-muted">
          {settled} Ask {invite.invitedBy.name} for a new one.
        </p>
      ) : status === 'loading' ? (
        // auth.me() usually has not resolved by the time the public preview
        // has, and showing the signed-out branch here sends a signed-in
        // visitor through /login, which drops state.from and loses the
        // invitation.
        <div className="mt-6 grid place-items-center py-4">
          <Spinner />
        </div>
      ) : status !== 'signed-in' ? (
        <div className="mt-6 space-y-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => navigate('/login', { state: { from: `/invite/${token}` } })}
          >
            Sign in to accept
          </Button>
          <Button
            className="w-full"
            onClick={() => navigate('/register', { state: { from: `/invite/${token}` } })}
          >
            Create an account
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {/*
            A warning and not a block. A work address and a sign-in address
            differ often enough that refusing would strand somebody holding a
            perfectly good invitation.
          */}
          {invite.email !== null && user !== null && invite.email !== user.email ? (
            <p className="rounded-md border border-rule bg-surface-3 px-3 py-2 text-xs text-ink-muted">
              This was sent to <span className="text-ink">{invite.email}</span>, and you are signed
              in as <span className="text-ink">{user.email}</span>. Accepting joins the account you
              are signed in as.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              disabled={busy}
              onClick={() => void accept()}
            >
              Accept
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => void decline()}>
              Decline
            </Button>
          </div>
          {user === null ? null : (
            <p className="text-center text-xs text-ink-faint">Signed in as {user.email}</p>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm rounded-xl bg-surface-2 p-6 elevated">
        <Wordmark className="text-ink" />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
