import { HocuspocusProvider } from '@hocuspocus/provider';
import { presenceColor, type Presence, type Reading } from '@schematic/ydoc';
import type { Position } from '@schematic/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

import { auth, currentAccessToken } from '@/lib/api';
import { config } from '@/lib/config';
import { createPlanStore, type PlanStore } from './plan-store';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/** After the server could not be asked to renew the socket's token, ask again this much later. */
const SOCKET_RENEWAL_RETRY_MS = 10_000;

export interface PlanConnection {
  doc: Y.Doc;
  bound: PlanStore;
  publishDrag: (positions: Record<string, Position> | null) => void;
  /** Where this person's pointer is, in plan coordinates. Null when it has left. */
  publishCursor: (at: Position | null) => void;
}

export interface PlanDocumentHandle {
  connection: PlanConnection | null;
  status: ConnectionStatus;
  /** True once the first sync has arrived; before that the canvas is empty, not blank. */
  synced: boolean;
  /**
   * The server would not open this document.
   *
   * Refused and not-there are one answer here, as they are on every other route:
   * the access check says "not found" for a plan that is somebody else's,
   * because saying "forbidden" would confirm it exists. Without this the canvas
   * sat at "connecting" over an empty document and drew a plan called "Untitled
   * plan" — a drawing of something that is not there.
   */
  denied: boolean;
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
  const [denied, setDenied] = useState(false);
  const [connection, setConnection] = useState<PlanConnection | null>(null);
  const frame = useRef<number | null>(null);
  const cursorFrame = useRef<number | null>(null);

  const identity = useMemo(
    () => ({ id: me?.id ?? 'anonymous', name: me?.name ?? 'Someone' }),
    [me?.id, me?.name],
  );

  useEffect(() => {
    setSynced(false);
    setStatus('connecting');
    setDenied(false);

    /*
     * One retry with a fresh token, and then the answer is believed.
     *
     * An access token lasts fifteen minutes. A plan left open makes no requests
     * of its own, so nothing renewed it, and the moment the socket reconnected
     * it presented an expired one — which the server refuses exactly as it
     * refuses a plan belonging to somebody else. The page could not tell the
     * two apart and drew "there is no plan here" over a plan the person owns,
     * after quarter of an hour of doing nothing. Reported as #6.
     *
     * So the first refusal is treated as a stale token: renew, reconnect, and
     * find out. A second one is the server saying the same thing about a
     * credential it has just seen afresh, which is an answer that will not
     * change however many times it is asked.
     */
    let retried = false;
    let gone = false;

    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      // The plan id is in the path because the server binds one document per
      // socket from the request URL.
      url: `${config.collabUrl}/${planId}`,
      name: planId,
      document: doc,
      // Asked for on every attempt, so the retry below carries the new one
      // without anything having to hand it over.
      token: () => currentAccessToken() ?? '',
      onStatus: ({ status: next }) => {
        setStatus(next === 'connected' ? 'connected' : 'connecting');
      },
      onSynced: () => {
        setSynced(true);
        // Whatever went wrong before this is over. A socket that drops an hour
        // from now gets its own retry rather than inheriting a spent one.
        retried = false;
      },
      onDisconnect: () => setStatus('disconnected'),
      // The provider retries a dropped socket for ever, which is right for a
      // network that came back and wrong for an answer that will not change.
      onAuthenticationFailed: () => {
        provider.disconnect();
        if (retried) {
          setDenied(true);
          return;
        }
        retried = true;
        setStatus('connecting');
        void auth.refresh().then((renewed) => {
          if (gone) return;
          if (renewed) {
            provider.connect();
            return;
          }
          // No session left: the refresh has already signed the screen out and
          // sign-in will bring the person back here. Being unable to prove who
          // you are is not the same as this plan not being here, so nothing is
          // drawn over that.
          if (currentAccessToken() === null) return;
          // The server could not be asked. Nothing was decided about the plan
          // either, so try again later rather than calling it missing.
          retried = false;
          setTimeout(() => {
            if (!gone) provider.connect();
          }, SOCKET_RENEWAL_RETRY_MS);
        });
      },
    });

    const bound = createPlanStore(doc);
    const awareness = provider.awareness;

    const readPeers = (): void => {
      if (awareness === null) return;
      const peers: Presence[] = [];
      const remoteDrag: Record<string, Position> = {};
      let reading: Reading | null = null;

      let mine: Presence | null = null;

      for (const [clientId, state] of awareness.getStates()) {
        if (clientId === awareness.clientID) {
          mine = (state as { presence?: Presence }).presence ?? null;
          continue;
        }
        // The server publishes a walk on this channel and nothing else, so an
        // entry with no presence is not a missing peer — it is the reading.
        const announced = (state as { reading?: Reading | null }).reading;
        if (announced != null) reading = announced;

        const presence = (state as { presence?: Presence }).presence;
        if (presence === undefined) continue;
        peers.push(presence);
        for (const [slug, position] of Object.entries(presence.dragging ?? {})) {
          remoteDrag[slug] = position;
        }
      }
      bound.store.setState({ peers, self: mine, remoteDrag, reading });
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

    /**
     * A pointer moves far more often than a screen refreshes, so this is
     * coalesced to one update a frame the same way a drag is. It never enters
     * the document: where somebody's pointer was a second ago is not history.
     */
    const publishCursor = (at: Position | null): void => {
      if (awareness === null) return;
      if (cursorFrame.current !== null) cancelAnimationFrame(cursorFrame.current);
      cursorFrame.current = requestAnimationFrame(() => {
        cursorFrame.current = null;
        const current = awareness.getLocalState()?.['presence'] as Presence | undefined;
        if (current === undefined) return;
        awareness.setLocalStateField('presence', { ...current, cursor: at } satisfies Presence);
      });
    };

    setConnection({ doc, bound, publishDrag, publishCursor });

    return () => {
      gone = true;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (cursorFrame.current !== null) cancelAnimationFrame(cursorFrame.current);
      awareness?.off('change', readPeers);
      bound.destroy();
      provider.destroy();
      doc.destroy();
      setConnection(null);
    };
  }, [planId, identity]);

  return { connection, status, synced, denied };
}
