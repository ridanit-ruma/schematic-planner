import type { PlanDoc } from '@schematic/schema';
import { initializePlan } from '@schematic/ydoc';
import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import * as Y from 'yjs';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import { NotFound, Problem, Spinner } from '@/components/ui/feedback';
import { useT } from '@/i18n';
import { config } from '@/lib/config';
import { isMissing, plans } from '@/lib/api';
import { PlanCanvas } from './PlanCanvas';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSharedVocabulary } from '@/lib/vocabulary';
import { PlanSize } from './TitleBlock';
import { createPlanStore } from './plan-store';
import type { PlanConnection } from './use-plan-document';

/**
 * A shared link is read-only and needs no session, so it loads the snapshot over
 * plain HTTP and drives the same canvas from a local document. No socket is
 * opened: there is nothing to collaborate on.
 */
export function SharedPlanPage() {
  const { token = '' } = useParams();
  const t = useT();
  const [doc, setDoc] = useState<PlanDoc | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    plans.readShared(token).then(setDoc).catch(setError);
  }, [token]);

  // An address that leads nowhere you can reach is not an error on a page;
  // it is the absence of the page. Everything below this line assumes the
  // thing exists and is yours.
  if (isMissing(error)) return <NotFound subject="shared plan" />;

  if (error !== null) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Problem error={error} />
        <Link to="/" className="mt-4 inline-block text-sm text-accent underline">
          {t.plan.shared.goHome}
        </Link>
      </div>
    );
  }

  if (doc === null) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }

  return <SharedCanvas plan={doc} token={token} />;
}

function SharedCanvas({ plan, token }: { plan: PlanDoc; token: string }) {
  const t = useT();
  const connection = useMemo<PlanConnection>(() => {
    const ydoc = new Y.Doc();
    initializePlan(ydoc, plan);
    return {
      doc: ydoc,
      bound: createPlanStore(ydoc),
      publishDrag: () => undefined,
      publishCursor: () => undefined,
    };
  }, [plan]);

  useEffect(() => () => connection.bound.destroy(), [connection]);

  // Drawn in the project's own colours, as the plan is for its members.
  const vocabulary = useSharedVocabulary(token);
  useEffect(() => connection.bound.setVocabulary(vocabulary), [connection, vocabulary]);

  const nodes = useStore(connection.bound.store, (state) => state.nodes);
  useDocumentTitle(plan.title);

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh min-h-0 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-rule bg-surface px-2 sm:gap-4 sm:px-3">
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{plan.title}</h1>
          <PlanSize count={nodes.length} />
          <span className="hidden text-xs text-ink-muted sm:inline">{t.plan.shared.readOnly}</span>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              window.location.href = `${config.apiUrl}/share/${token}/export`;
            }}
          >
            {t.plan.shared.export}
          </Button>
        </header>
        <div className="min-h-0 flex-1">
          <PlanCanvas connection={connection} readOnly onApplyOps={() => undefined} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
