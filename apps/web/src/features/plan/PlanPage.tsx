import { uniqueSlug, type PlanNodeStatus, type PlanOp } from '@schematic/schema';
import { ORIGIN_LAYOUT, ORIGIN_LOCAL, applyOps, commitLayout, readPlanDoc } from '@schematic/ydoc';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Problem, Spinner } from '@/components/ui/feedback';
import { downloadExport, plans } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { EdgeInspector } from './EdgeInspector';
import { Inspector } from './Inspector';
import { PlanCanvas } from './PlanCanvas';
import { PlanSidebar } from './PlanSidebar';
import { TitleBlock } from './TitleBlock';
import { usePlanDocument } from './use-plan-document';

export function PlanPage() {
  const { planId = '' } = useParams();
  const user = useAuth((state) => state.user);
  const { connection, status } = usePlanDocument(planId, user);

  if (connection === null) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <PlanWorkspace planId={planId} connection={connection} status={status} />
    </ReactFlowProvider>
  );
}

function PlanWorkspace({
  planId,
  connection,
  status,
}: {
  planId: string;
  connection: NonNullable<ReturnType<typeof usePlanDocument>['connection']>;
  status: ReturnType<typeof usePlanDocument>['status'];
}) {
  const { store, doc } = connection.bound;
  const nodes = useStore(store, (state) => state.nodes);
  const title = useStore(store, (state) => state.title);
  const peers = useStore(store, (state) => state.peers);
  const selected = useStore(store, (state) => state.selected);
  const select = useStore(store, (state) => state.select);
  const selectedEdge = useStore(store, (state) => state.selectedEdge);
  const selectEdge = useStore(store, (state) => state.selectEdge);
  const edges = useStore(store, (state) => state.edges);
  const connectKind = useStore(store, (state) => state.connectKind);
  const setConnectKind = useStore(store, (state) => state.setConnectKind);

  const { screenToFlowPosition } = useReactFlow();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const counts = useMemo(() => {
    const tally: Partial<Record<PlanNodeStatus, number>> = {};
    for (const node of nodes) {
      const status_ = node.data.node.status;
      tally[status_] = (tally[status_] ?? 0) + 1;
    }
    return tally;
  }, [nodes]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selected)?.data.node ?? null,
    [nodes, selected],
  );

  const selectedEdgeData = useMemo(
    () => edges.find((edge) => edge.id === selectedEdge)?.data?.edge ?? null,
    [edges, selectedEdge],
  );

  const apply = useCallback(
    (ops: PlanOp[]) => {
      try {
        applyOps(doc, ops, ORIGIN_LOCAL);
        setError(null);
      } catch (cause) {
        setError(cause);
      }
    },
    [doc],
  );

  const addNode = (): void => {
    const trimmed = newTitle.trim();
    if (trimmed === '') return;
    const slug = uniqueSlug(
      trimmed,
      nodes.map((node) => node.id),
    );

    // Placed where the person is looking rather than at the origin, where it
    // would land under whatever is already there. Left unpinned, so Arrange is
    // still free to tidy it into the graph.
    const centre = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    apply([
      {
        op: 'upsert_node',
        node: {
          slug,
          title: trimmed,
          position: { x: Math.round(centre.x - 130), y: Math.round(centre.y - 70) },
        },
      },
    ]);
    setNewTitle('');
    setAdding(false);
    select(slug);
  };

  const arrange = async (): Promise<void> => {
    // ELK is a large dependency and only the arrange button needs it, so it is
    // fetched on first use rather than shipped in the initial bundle.
    const { layoutPlan } = await import('@schematic/layout');
    const plan = readPlanDoc(doc).doc;
    const { positions, sizes } = await layoutPlan(plan, { scope: 'unpinned' });
    commitLayout(doc, positions, ORIGIN_LAYOUT, sizes);
  };

  const exportZip = async (): Promise<void> => {
    try {
      await downloadExport(planId, `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`);
    } catch (cause) {
      setError(cause);
    }
  };

  const share = async (): Promise<void> => {
    try {
      const { token } = await plans.share(planId);
      setShareUrl(`${window.location.origin}/share/${token}`);
    } catch (cause) {
      setError(cause);
    }
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <TitleBlock
        title={title === '' ? 'Untitled plan' : title}
        counts={counts}
        peers={peers}
        status={status}
        readOnly={false}
        connectKind={connectKind}
        onConnectKindChange={setConnectKind}
        onAddNode={() => setAdding(true)}
        onArrange={() => void arrange()}
        onExport={() => void exportZip()}
        onShare={() => void share()}
      />

      {error !== null ? (
        <div className="border-b border-rule px-3 py-2">
          <Problem error={error} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <PlanSidebar planId={planId} />
        <div className="min-w-0 flex-1">
          <PlanCanvas connection={connection} readOnly={false} onApplyOps={apply} />
        </div>
        {selectedNode !== null ? (
          <Inspector
            doc={doc}
            node={selectedNode}
            readOnly={false}
            onApplyOps={apply}
            onClose={() => select(null)}
          />
        ) : selectedEdgeData !== null ? (
          <EdgeInspector
            edge={selectedEdgeData}
            readOnly={false}
            onApplyOps={apply}
            onClose={() => selectEdge(null)}
          />
        ) : null}
      </div>

      <Modal open={adding} onOpenChange={setAdding} title="Add node">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            addNode();
          }}
        >
          <Field label="Title" hint="The identifier is derived from this and can be changed later.">
            {(id) => (
              <Input
                id={id}
                autoFocus
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Authentication"
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add node
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={shareUrl !== null}
        onOpenChange={(open) => !open && setShareUrl(null)}
        title="Share this plan"
        description="Anyone with this link can read the plan and download the export. They cannot change it."
      >
        <div className="space-y-3">
          <Input readOnly value={shareUrl ?? ''} onFocus={(event) => event.target.select()} />
          <div className="flex justify-end gap-2">
            <Button
              variant="danger"
              onClick={() => {
                void plans.unshare(planId);
                setShareUrl(null);
              }}
            >
              Stop sharing
            </Button>
            <Button
              variant="primary"
              onClick={() => void navigator.clipboard.writeText(shareUrl ?? '')}
            >
              Copy link
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
