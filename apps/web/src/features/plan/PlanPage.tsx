import { uniqueSlug, type PlanOp, type Position } from '@schematic/schema';
import { ORIGIN_LAYOUT, ORIGIN_LOCAL, applyOps, commitLayout, readPlanDoc } from '@schematic/ydoc';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useStore } from 'zustand';

import { useExplorer } from '@/components/explorer/explorer-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NotFound, Problem, Spinner } from '@/components/ui/feedback';
import { useT } from '@/i18n';
import { downloadExport, plans } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useDocumentTitle } from '@/lib/use-document-title';
import { usePlanVocabulary } from '@/lib/vocabulary';
import { EdgeInspector } from './EdgeInspector';
import { HistoryPanel } from './HistoryPanel';
import { Inspector } from './Inspector';
import { PlanCanvas, type PlanCanvasHandle } from './PlanCanvas';
import { TitleBlock } from './TitleBlock';
import { usePlanDocument } from './use-plan-document';
import { usePlanUndo, useUndoKeys } from './use-undo';

export function PlanPage() {
  const { planId = '' } = useParams();
  const user = useAuth((state) => state.user);
  const { connection, status, denied } = usePlanDocument(planId, user);

  if (denied) return <NotFound subject="plan" />;

  // Exactly the height of the pane, never more: React Flow draws into the box
  // it is given, and a box that grows with its contents is a box of no height.
  return (
    <div className="relative flex h-full min-h-0 flex-col">
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
  const t = useT();
  const { store, doc } = connection.bound;
  const nodes = useStore(store, (state) => state.nodes);
  const title = useStore(store, (state) => state.title);
  const peers = useStore(store, (state) => state.peers);
  const self = useStore(store, (state) => state.self);
  const selected = useStore(store, (state) => state.selected);
  const select = useStore(store, (state) => state.select);
  const selectedEdge = useStore(store, (state) => state.selectedEdge);
  const selectEdge = useStore(store, (state) => state.selectEdge);
  const routeEdge = useStore(store, (state) => state.routeEdge);
  const edges = useStore(store, (state) => state.edges);
  const comments = useStore(store, (state) => state.comments);
  const selectComment = useStore(store, (state) => state.selectComment);

  // The project's statuses, kinds and tags: the cards are drawn with them and
  // the inspector offers them.
  const words = usePlanVocabulary(planId);
  const setVocabulary = connection.bound.setVocabulary;
  useEffect(() => setVocabulary(words.vocabulary), [setVocabulary, words.vocabulary]);

  const { setCenter } = useReactFlow();
  const undo = usePlanUndo(doc);
  useUndoKeys(undo);
  // Adding a node happens on the canvas: it is made there and named on the card.
  const canvas = useRef<PlanCanvasHandle | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // One panel at a time on the right: opening the history puts down whatever
  // was selected, and selecting something puts the history away.
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Where the last jump stopped, so the button walks the notes rather than
      returning to the same one. */
  const [atNote, setAtNote] = useState(0);
  const [error, setError] = useState<unknown>(null);

  const openNotes = useMemo(() => comments.filter((comment) => !comment.resolved), [comments]);

  useDocumentTitle(title === '' ? t.plan.page.untitled : title);

  // The tree beside the canvas carries the plan's name too, and a rename on the
  // canvas — yours or anybody else's — arrives here first.
  const { renamePlan } = useExplorer();
  useEffect(() => {
    if (title !== '') renamePlan(planId, title);
  }, [renamePlan, planId, title]);

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
        title={title === '' ? t.plan.page.untitled : title}
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
        onAddNode={() => canvas.current?.addNode()}
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
            onAddComment={addComment}
            handle={canvas}
          />
        </div>
        {selectedNode !== null ? (
          <Inspector
            doc={doc}
            node={selectedNode}
            slugs={nodes.map((node) => node.id)}
            readOnly={false}
            awareness={connection.awareness}
            onApplyOps={apply}
            onRenamed={select}
            onClose={() => select(null)}
            words={words}
          />
        ) : selectedEdgeData !== null ? (
          <EdgeInspector
            edge={selectedEdgeData}
            readOnly={false}
            onApplyOps={apply}
            onStraighten={() => routeEdge(selectedEdgeData.id, [])}
            onClose={() => selectEdge(null)}
          />
        ) : historyOpen ? (
          <HistoryPanel
            planId={planId}
            vocabulary={words.vocabulary}
            onClose={() => setHistoryOpen(false)}
          />
        ) : null}
      </div>

      <Modal
        open={shareUrl !== null}
        onOpenChange={(open) => !open && setShareUrl(null)}
        title={t.plan.page.shareTitle}
        description={t.plan.page.shareDescription}
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
              {t.plan.page.stopSharing}
            </Button>
            <Button
              variant="primary"
              onClick={() => void navigator.clipboard.writeText(shareUrl ?? '')}
            >
              {t.plan.page.copyLink}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
