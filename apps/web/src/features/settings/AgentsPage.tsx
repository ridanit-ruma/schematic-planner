import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { config } from '@/lib/config';
import { workspaces, type ApiKeySummary } from '@/lib/api';
import { formatWhen } from '@/lib/utils';

const MCP_URL = `${config.apiUrl}/mcp`;

/**
 * Where an agent gets connected. Everything a person has to move from this page
 * into another program is monospace and one click from the clipboard.
 */
export function AgentsPage() {
  const { workspaceId = '' } = useParams();
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<{ key: string; name: string } | null>(null);

  const reload = (): void => {
    workspaces.apiKeys(workspaceId).then(setKeys).catch(setError);
  };
  useEffect(reload, [workspaceId]);

  const create = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    try {
      const created = await workspaces.createApiKey(workspaceId, trimmed);
      setIssued({ key: created.key, name: created.name });
      setNaming(false);
      setName('');
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-xl font-medium text-ink">Agents</h1>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">
        Connect Cursor, Claude, or any other MCP client to this workspace. The agent can then read
        your plans and draw new ones on the same canvas you are looking at.
      </p>

      <section className="mt-8 border border-rule bg-surface p-4">
        <h2 className="text-sm font-medium text-ink">Server URL</h2>
        <p className="mt-1 text-xs text-ink-muted">
          The same for everyone on this instance. Pair it with a key below.
        </p>
        <CopyRow value={MCP_URL} className="mt-3" />
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-ink">Keys</h2>
            <p className="mt-1 text-xs text-ink-muted">
              A key acts as you, in this workspace. Revoke one and it stops working immediately.
            </p>
          </div>
          <Button variant="primary" onClick={() => setNaming(true)}>
            New key
          </Button>
        </div>

        {error !== null ? <div className="mt-4"><Problem error={error} /></div> : null}

        {keys === null ? (
          <div className="grid py-12 place-items-center">
            <Spinner />
          </div>
        ) : keys.length === 0 ? (
          <Empty
            title="No keys yet"
            body="Create one to connect your first agent."
            action={
              <Button variant="primary" onClick={() => setNaming(true)}>
                New key
              </Button>
            }
          />
        ) : (
          <table className="mt-4 w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-left text-xs text-ink-muted">
                <th className="py-2 font-medium">Name</th>
                <th className="w-32 py-2 font-medium">Key</th>
                <th className="w-28 py-2 text-right font-medium">Last used</th>
                <th className="w-20 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-rule">
                  <td className="truncate py-2.5 pr-4 text-ink">{key.name}</td>
                  <td className="slug py-2.5 text-ink-faint">{key.prefix}…</td>
                  <td className="py-2.5 text-right text-ink-muted">
                    {key.lastUsedAt === null ? 'Never' : formatWhen(key.lastUsedAt)}
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void workspaces.revokeApiKey(workspaceId, key.id).then(reload);
                      }}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Modal open={naming} onOpenChange={setNaming} title="New key">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field label="Name" hint="Something that says which machine or tool holds it.">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Cursor on my laptop"
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNaming(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create key
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={issued !== null}
        onOpenChange={(open) => !open && setIssued(null)}
        title="Copy your key now"
        description="This is the only time it is shown. The server keeps a hash, not the key."
      >
        <CopyRow value={issued?.key ?? ''} />
        <p className="mt-4 text-xs font-medium text-ink-muted">Configuration for an MCP client</p>
        <pre className="mt-2 overflow-x-auto rounded-[2px] border border-rule bg-surface-2 p-3 text-2xs leading-relaxed text-ink">
          {JSON.stringify(
            {
              mcpServers: {
                'schematic-planner': {
                  url: MCP_URL,
                  headers: { Authorization: `Bearer ${issued?.key ?? ''}` },
                },
              },
            },
            null,
            2,
          )}
        </pre>
      </Modal>
    </div>
  );
}

function CopyRow({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <code className="slug min-w-0 flex-1 truncate rounded-[2px] border border-rule bg-surface-2 px-2.5 py-2 text-ink">
        {value}
      </code>
      <Button
        size="icon"
        variant="quiet"
        aria-label="Copy"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}
