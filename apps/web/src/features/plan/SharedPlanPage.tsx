import type { PlanDoc } from '@schematic/schema';
import { initializePlan } from '@schematic/ydoc';
import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import * as Y from 'yjs';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import { Problem, Spinner } from '@/components/ui/feedback';
import { StatusTally } from '@/components/ui/status';
import { ThemeToggle } from '@/components/ui/theme';
import { config } from '@/lib/config';
import { plans } from '@/lib/api';
import { PlanCanvas } from './PlanCanvas';
import { createPlanStore } from './plan-store';
import type { PlanConnection } from './use-plan-document';

/**
 * A shared link is read-only and needs no session, so it loads the snapshot over
 * plain HTTP and drives the same canvas from a local document. No socket is
 * opened: there is nothing to collaborate on.
 */
export function SharedPlanPage() {
  const { token = '' } = useParams();
  const [doc, setDoc] = useState<PlanDoc | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    plans.readShared(token).then(setDoc).catch(setError);
  }, [token]);

  if (error !== null) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Problem error={error} />
        <Link to="/" className="mt-4 inline-block text-sm text-accent underline">
          Go to Schematic Planner
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
  const connection = useMemo<PlanConnection>(() => {
    const ydoc = new Y.Doc();
    initializePlan(ydoc, plan);
    return { doc: ydoc, bound: createPlanStore(ydoc), publishDrag: () => undefined };
  }, [plan]);

  useEffect(() => () => connection.bound.destroy(), [connection]);

  const nodes = useStore(connection.bound.store, (state) => state.nodes);
  const counts = nodes.reduce<Record<string, number>>((tally, node) => {
    const status = node.data.node.status;
    tally[status] = (tally[status] ?? 0) + 1;
    return tally;
  }, {});

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh min-h-0 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-4 border-b border-rule bg-surface px-3">
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{plan.title}</h1>
          <StatusTally counts={counts} />
          <span className="text-xs text-ink-muted">Read only</span>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              window.location.href = `${config.apiUrl}/share/${token}/export`;
            }}
          >
            Export
          </Button>
          <ThemeToggle />
        </header>
        <div className="min-h-0 flex-1">
          <PlanCanvas connection={connection} readOnly onApplyOps={() => undefined} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
