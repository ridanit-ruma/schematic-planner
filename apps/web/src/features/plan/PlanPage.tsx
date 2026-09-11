import { uniqueSlug, type PlanOp, type Position } from '@schematic/schema';
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
import { useDocumentTitle } from '@/lib/use-document-title';
import { EdgeInspector } from './EdgeInspector';
import { HistoryPanel } from './HistoryPanel';
import { Inspector } from './Inspector';
import { PlanCanvas } from './PlanCanvas';
import { PlanSidebar } from './PlanSidebar';
import { TitleBlock } from './TitleBlock';
import { usePlanDocument } from './use-plan-document';
import { usePlanUndo, useUndoKeys } from './use-undo';

export function PlanPage() {
  const { planId = '' } = useParams();
  const user = useAuth((state) => state.user);
  const { connection, status } = usePlanDocument(planId, user);

  // The rail sits outside the document gate: opening a plan tears the previous
  // connection down, and a rail inside would unmount and refetch itself every
  // time somebody used it.
  return (
    <div className="relative flex h-dvh min-h-0">
      <PlanSidebar planId={planId} />
      <div className="flex min-w-0 flex-1 flex-col">
        {connection === null ? (
          <div className="grid flex-1 place-items-center">
            <Spinner />
          </div>
        ) : (
          <ReactFlowProvider>
            <PlanWorkspace planId={planId} connection={connection} status={status} />
          </ReactFlowProvider>
        )}
      </div>
    </div>
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
  const self = useStore(store, (state) => state.self);
  const selected = useStore(store, (state) => state.selected);
  const select = useStore(store, (state) => state.select);
  const selectedEdge = useStore(store, (state) => state.selectedEdge);
  const selectEdge = useStore(store, (state) => state.selectEdge);
  const edges = useStore(store, (state) => state.edges);
  const comments = useStore(store, (state) => state.comments);
  const selectComment = useStore(store, (state) => state.selectComment);

  const { screenToFlowPosition, setCenter } = useReactFlow();
  const undo = usePlanUndo(doc);
  useUndoKeys(undo);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  // Where a node asked for from the canvas should land. Null when the request
  // came from the row, which has no place of its own to mean.
  const [placing, setPlacing] = useState<Position | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // One panel at a time on the right: opening the history puts down whatever
  // was selected, and selecting something puts the history away.
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Where the last jump stopped, so the button walks the notes rather than
      returning to the same one. */
  const [atNote, setAtNote] = useState(0);
  const [error, setError] = useState<unknown>(null);

  const openNotes = useMemo(
    () => comments.filter((comment) => !comment.resolved),
    [comments],
  );

  useDocumentTitle(title === '' ? 'Untitled plan' : title);

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

  /**
   * A note goes straight into the document with an empty body and opens for
   * typing. Asking for the text in a dialog first would put the note where the
   * dialog was dismissed rather than where it was asked for, and a note with
   * nothing in it yet is a perfectly ordinary thing to have on a canvas.
   */
  const addComment = (at: Position, anchor: string | null): void => {
    const id = uniqueSlug(
      `note ${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`,
      comments.map((comment) => comment.id),
    );
    apply([
      {
        op: 'upsert_comment',
        comment: {
          id,
          author: self?.name ?? 'Someone',
          at: new Date().toISOString(),
          position: { x: Math.round(at.x), y: Math.round(at.y) },
          anchor,
        },
      },
    ]);
    selectComment(id);
  };

  const addNode = (): void => {
    const trimmed = newTitle.trim();
    if (trimmed === '') return;
    const slug = uniqueSlug(
      trimmed,
      nodes.map((node) => node.id),
    );

    // Where it was asked for, if it was asked for somewhere; otherwise where
    // the person is looking rather than at the origin, where it would land
    // under whatever is already there. Left unpinned, so Arrange is still free
    // to tidy it into the graph.
    const centre =
      placing ??
      screenToFlowPosition({
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
    setPlacing(null);
    select(slug);
  };

  const arrange = async (): Promise<void> => {
    // ELK is a large dependency and only the arrange button needs it, so it is
    // fetched on first use rather than shipped in the initial bundle.
    const { layoutPlan } = await import('@schematic/layout');
    const plan = readPlanDoc(doc).doc;
    const { positions, sizes, labels } = await layoutPlan(plan, { scope: 'unpinned' });
    commitLayout(doc, positions, ORIGIN_LAYOUT, sizes, labels);
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
    <div className="flex min-h-0 flex-1 flex-col">
      <TitleBlock
        title={title === '' ? 'Untitled plan' : title}
        nodeCount={nodes.length}
        openNotes={openNotes.length}
        onNextNote={() => {
          const next = openNotes[atNote % openNotes.length];
          setAtNote((index) => index + 1);
          if (next?.position == null) return;
          selectComment(next.id);
          void setCenter(next.position.x + 100, next.position.y + 40, { duration: 320 });
        }}
        peers={peers}
        self={self}
        onFollow={(peer) => {
          if (peer.cursor == null) return;
          void setCenter(peer.cursor.x, peer.cursor.y, { duration: 320 });
        }}
        status={status}
        readOnly={false}
        onAddNode={() => {
          setPlacing(null);
          setAdding(true);
        }}
        onArrange={() => void arrange()}
        onExport={() => void exportZip()}
        onShare={() => void share()}
        settingsHref={`/plan/${planId}/settings`}
        historyOpen={historyOpen}
        onHistory={() => {
          setHistoryOpen((open) => !open);
          select(null);
        }}
      />

      {error !== null ? (
        <div className="border-b border-rule px-3 py-2">
          <Problem error={error} />
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <PlanCanvas
            connection={connection}
            readOnly={false}
            onApplyOps={apply}
            undo={undo}
            onAddNode={(at) => {
              setPlacing(at);
              setAdding(true);
            }}
            onAddComment={addComment}
          />
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
        ) : historyOpen ? (
          <HistoryPanel planId={planId} onClose={() => setHistoryOpen(false)} />
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
