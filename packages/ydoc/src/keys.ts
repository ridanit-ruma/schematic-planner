import type * as Y from 'yjs';

export const META_KEY = 'meta';
export const NODES_KEY = 'nodes';
export const EDGES_KEY = 'edges';

export type YNode = Y.Map<unknown>;
export type YEdge = Y.Map<unknown>;

/**
 * Transaction origins. Yjs hands the origin to every observer, which is how a
 * client tells its own writes apart from ones arriving over the socket.
 */
export const ORIGIN_LOCAL = 'local';
export const ORIGIN_REMOTE = 'remote';
export const ORIGIN_AGENT = 'agent';
export const ORIGIN_LAYOUT = 'layout';
