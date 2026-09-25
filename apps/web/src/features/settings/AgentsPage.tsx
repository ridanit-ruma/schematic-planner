import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Empty, Problem, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { useT } from '@/i18n';
import { config } from '@/lib/config';
import { account, type ApiKeySummary } from '@/lib/api';
import { formatWhen } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/use-document-title';

const MCP_URL = `${config.apiUrl}/mcp`;

/**
 * Where an agent gets connected. Everything a person has to move from this page
 * into another program is monospace and one click from the clipboard.
 */
export function AgentsPage() {
  const t = useT();
  useDocumentTitle(t.agents.documentTitle);
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<{ key: string; name: string } | null>(null);

  const reload = (): void => {
    account.apiKeys().then(setKeys).catch(setError);
  };
  useEffect(reload, []);

  const create = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    try {
      const created = await account.createApiKey(trimmed);
      setIssued({ key: created.key, name: created.name });
      setNaming(false);
      setName('');
      reload();
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <>
      <p className="max-w-prose text-sm text-ink-muted">{t.agents.intro}</p>

      <section className="rounded-lg border border-rule bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-ink">{t.agents.server.title}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t.agents.server.body}</p>
        <CopyRow value={MCP_URL} className="mt-3" />
      </section>

      <section>
        {/* Stacked until there is room for both: a flex item without `min-w-0`
            refuses to shrink past its content, and the button ended up sitting
            on top of the sentence. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-ink">{t.agents.keys.title}</h2>
            <p className="mt-1 text-xs text-ink-muted">{t.agents.keys.body}</p>
          </div>
          <Button
            className="self-start sm:self-auto"
            variant="primary"
            onClick={() => setNaming(true)}
          >
            {t.agents.keys.newKey}
          </Button>
        </div>

        {error !== null ? (
          <div className="mt-4">
            <Problem error={error} />
          </div>
        ) : null}

        {keys === null ? (
          <div className="grid py-12 place-items-center">
            <Spinner />
          </div>
        ) : keys.length === 0 ? (
          <Empty
            title={t.agents.keys.empty.title}
            body={t.agents.keys.empty.body}
            action={
              <Button variant="primary" onClick={() => setNaming(true)}>
                {t.agents.keys.newKey}
              </Button>
            }
          />
        ) : (
          <div className="mt-4">
            <Table>
              <THead>
                <TH>{t.agents.keys.columns.name}</TH>
                <TH className="w-32" hide="md">
                  {t.agents.keys.columns.key}
                </TH>
                <TH className="w-24 sm:w-28" align="right" hide="sm">
                  {t.agents.keys.columns.lastUsed}
                </TH>
                <TH className="w-20 sm:w-24" align="right">
                  <span className="sr-only">{t.agents.keys.columns.actions}</span>
                </TH>
              </THead>
              <tbody>
                {keys.map((key) => (
                  <TR key={key.id}>
                    <TD className="text-ink">
                      <span className="block truncate">{key.name}</span>
                      {/* The prefix and the last use, under the name, where the
                          columns for them have been dropped. */}
                      <span className="slug block truncate text-ink-faint md:hidden">
                        {key.prefix}…
                        <span className="sm:hidden">
                          {' · '}
                          {key.lastUsedAt === null
                            ? t.agents.keys.neverUsed
                            : formatWhen(key.lastUsedAt)}
                        </span>
                      </span>
                      {key.restrictedTo != null ? (
                        <span className="ml-2 text-xs text-ink-faint">
                          {t.agents.keys.limitedTo(key.restrictedTo)}
                        </span>
                      ) : null}
                    </TD>
                    <TD className="slug text-ink-faint" hide="md">
                      {key.prefix}…
                    </TD>
                    <TD align="right" className="text-xs text-ink-muted" hide="sm">
                      {key.lastUsedAt === null ? t.agents.keys.never : formatWhen(key.lastUsedAt)}
                    </TD>
                    <TD align="right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void account.revokeApiKey(key.id).then(reload);
                        }}
                      >
                        {t.agents.keys.revoke}
                      </Button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <Modal open={naming} onOpenChange={setNaming} title={t.agents.create.title}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field label={t.agents.create.name} hint={t.agents.create.nameHint}>
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.agents.create.namePlaceholder}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNaming(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {t.agents.create.submit}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={issued !== null}
        onOpenChange={(open) => !open && setIssued(null)}
        title={t.agents.issued.title}
        description={t.agents.issued.description}
      >
        <CopyRow value={issued?.key ?? ''} />
        <p className="mt-4 text-xs font-medium text-ink-muted">{t.agents.issued.configTitle}</p>
        <p className="mt-1 text-xs text-ink-faint">{t.agents.issued.configBody}</p>
        <CopyBlock value={mcpConfig(issued?.key ?? '')} className="mt-2" />
      </Modal>
    </>
  );
}

/**
 * What an MCP client needs, in the shape one actually accepts.
 *
 * `type` matters and was missing: a client reading this to reach a remote
 * server over HTTP has no other way to know that is what it is, so the snippet
 * read correctly and did not work when it was pasted.
 */
function mcpConfig(key: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        'schematic-planner': {
          type: 'http',
          url: MCP_URL,
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
    null,
    2,
  );
}

/**
 * A block that can be taken whole. `CopyRow` is for one line and truncates;
 * this is for something meant to be read and then copied, which is most of what
 * the snippet is for.
 */
function CopyBlock({ value, className }: { value: string; className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <div className={`relative ${className ?? ''}`}>
      <pre className="overflow-x-auto rounded-md border border-rule bg-surface-2 p-3 pr-12 text-2xs leading-relaxed text-ink">
        {value}
      </pre>
      <Button
        size="icon"
        variant="quiet"
        aria-label={t.agents.copyConfiguration}
        className="absolute top-1.5 right-1.5"
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

function CopyRow({ value, className }: { value: string; className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <code className="slug min-w-0 flex-1 truncate rounded-md border border-rule bg-surface-2 px-2.5 py-2 text-ink">
        {value}
      </code>
      <Button
        size="icon"
        variant="quiet"
        aria-label={t.agents.copy}
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
