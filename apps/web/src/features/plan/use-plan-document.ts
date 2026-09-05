import { HocuspocusProvider } from '@hocuspocus/provider';
import { presenceColor, type Presence } from '@schematic/ydoc';
import type { Position } from '@schematic/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

import { currentAccessToken } from '@/lib/api';
import { config } from '@/lib/config';
import { createPlanStore, type PlanStore } from './plan-store';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface PlanConnection {
  doc: Y.Doc;
  bound: PlanStore;
  publishDrag: (positions: Record<string, Position> | null) => void;
}

export interface PlanDocumentHandle {
  connection: PlanConnection | null;
  status: ConnectionStatus;
  /** True once the first sync has arrived; before that the canvas is empty, not blank. */
  synced: boolean;
}

/**
 * Opens the collaborative document for one plan and keeps it open for as long
 * as the page shows it.
 */
export function usePlanDocument(
  planId: string,
  me: { id: string; name: string } | null,
): PlanDocumentHandle {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [synced, setSynced] = useState(false);
  const [connection, setConnection] = useState<PlanConnection | null>(null);
  const frame = useRef<number | null>(null);

  const identity = useMemo(
    () => ({ id: me?.id ?? 'anonymous', name: me?.name ?? 'Someone' }),
    [me?.id, me?.name],
  );

  useEffect(() => {
    setSynced(false);
    setStatus('connecting');

    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      // The plan id is in the path because the server binds one document per
      // socket from the request URL.
      url: `${config.collabUrl}/${planId}`,
      name: planId,
      document: doc,
      token: () => currentAccessToken() ?? '',
      onStatus: ({ status: next }) => {
        setStatus(next === 'connected' ? 'connected' : 'connecting');
      },
      onSynced: () => setSynced(true),
      onDisconnect: () => setStatus('disconnected'),
    });

    const bound = createPlanStore(doc);
    const awareness = provider.awareness;

    const readPeers = (): void => {
      if (awareness === null) return;
      const peers: Presence[] = [];
      const remoteDrag: Record<string, Position> = {};

      for (const [clientId, state] of awareness.getStates()) {
        if (clientId === awareness.clientID) continue;
        const presence = (state as { presence?: Presence }).presence;
        if (presence === undefined) continue;
        peers.push(presence);
        for (const [slug, position] of Object.entries(presence.dragging ?? {})) {
          remoteDrag[slug] = position;
        }
      }
      bound.store.setState({ peers, remoteDrag });
    };

    awareness?.setLocalStateField('presence', {
      userId: identity.id,
      name: identity.name,
      color: presenceColor(identity.id),
    } satisfies Presence);
    awareness?.on('change', readPeers);
    readPeers();

    const publishDrag = (positions: Record<string, Position> | null): void => {
      if (awareness === null) return;
      // Coalesced to one update per frame: a drag fires far more often than a
      // screen refreshes, and none of those extra messages can be seen.
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const current = awareness.getLocalState()?.['presence'] as Presence | undefined;
        if (current === undefined) return;
        awareness.setLocalStateField('presence', {
          ...current,
          ...(positions === null ? { dragging: {} } : { dragging: positions }),
        } satisfies Presence);
      });
    };

    setConnection({ doc, bound, publishDrag });

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      awareness?.off('change', readPeers);
      bound.destroy();
      provider.destroy();
      doc.destroy();
      setConnection(null);
    };
  }, [planId, identity]);

  return { connection, status, synced };
}
