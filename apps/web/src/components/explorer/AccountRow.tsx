import { ChevronsUpDown, Gauge, KeyRound, Languages, LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';

import { Avatar } from '@/components/ui/avatar';
import {
  DropdownAction,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownSub,
} from '@/components/ui/dropdown-menu';
import { LOCALE_NAMES, LOCALES, useI18n, useT } from '@/i18n';
import { useAuth } from '@/lib/auth-store';

/**
 * You, at the foot of the explorer, where every tool of this kind keeps you.
 * Your settings, the keys your agents hold and the language belong to the
 * account rather than to a workspace, so they are here and not in the tree.
 */
export function AccountRow({ onFollow }: { onFollow: () => void }) {
  const t = useT();
  const user = useAuth((state) => state.user);
  const signOut = useAuth((state) => state.signOut);
  const locale = useI18n((state) => state.locale);
  const setLocale = useI18n((state) => state.setLocale);
  const navigate = useNavigate();

  const go = (to: string): void => {
    void navigate(to);
    onFollow();
  };

  return (
    <div className="shrink-0 border-t border-rule p-2">
      <DropdownMenu
        align="start"
        trigger={
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-2 focus:outline-none"
            aria-label={t.shell.account.menu}
          >
            <Avatar src={user?.avatarUrl} name={user?.name ?? '?'} className="size-6 rounded-sm" />
            <span className="min-w-0 flex-1 truncate text-left text-xs text-ink">
              {user?.name ?? t.shell.account.you}
            </span>
            <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-ink-faint" />
          </button>
        }
      >
        <DropdownLabel>
          <span className="block truncate text-xs font-medium text-ink">
            {user?.name ?? t.shell.account.you}
          </span>
          <span className="block truncate text-2xs text-ink-muted">{user?.email ?? ''}</span>
        </DropdownLabel>
        <DropdownSeparator />
        <DropdownAction onSelect={() => go('/settings')}>
          <UserRound className="size-3.5 text-ink-faint" />
          {t.shell.account.settings}
        </DropdownAction>
        <DropdownAction onSelect={() => go('/settings/agents')}>
          <KeyRound className="size-3.5 text-ink-faint" />
          {t.shell.account.agentKeys}
        </DropdownAction>
        {/* Only whoever owns the instance has anywhere to go here, and only
            they are allowed through the door at the other end. */}
        {user?.instanceRole !== 'OWNER' ? null : (
          <DropdownAction onSelect={() => go('/admin')}>
            <Gauge className="size-3.5 text-ink-faint" />
            {t.shell.account.instance}
          </DropdownAction>
        )}
        <DropdownSub
          label={
            <>
              <Languages className="size-3.5 text-ink-faint" />
              {t.explorer.language}
            </>
          }
        >
          {LOCALES.map((each) => (
            <DropdownItem
              key={each}
              selected={each === locale}
              onSelect={() => void setLocale(each)}
            >
              {LOCALE_NAMES[each]}
            </DropdownItem>
          ))}
        </DropdownSub>
        <DropdownSeparator />
        <DropdownAction tone="danger" onSelect={() => void signOut()}>
          <LogOut className="size-3.5" />
          {t.shell.account.signOut}
        </DropdownAction>
      </DropdownMenu>
    </div>
  );
}
