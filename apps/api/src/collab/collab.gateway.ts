import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

import { CollabService } from './collab.service.js';

export const COLLAB_PATH = '/collab';

/**
 * Hocuspocus does not read from the socket itself — `WebSocketLike` is only
 * `send`, `close` and `readyState`. Whoever owns the socket has to pump frames
 * into the connection it returns, which is what `attach` below does.
 */
function toUint8Array(data: RawData): Uint8Array {
  if (Buffer.isBuffer(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return toUint8Array(Buffer.concat(data));
  return new Uint8Array(data);
}

/** Hocuspocus works in web standards; the node upgrade handler does not. */
function toFetchRequest(request: IncomingMessage): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else if (value !== undefined) headers.set(name, value);
  }
  const host = request.headers.host ?? 'localhost';
  return new Request(`http://${host}${request.url ?? '/'}`, { headers });
}

/**
 * Attaches the Yjs socket to the HTTP server Nest already listens on, so the API
 * and collaboration share a port, a certificate and a reverse proxy entry.
 */
@Injectable()
export class CollabGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CollabGateway.name);
  private wss: WebSocketServer | undefined;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly collab: CollabService,
  ) {}

  onApplicationBootstrap(): void {
    const httpServer = this.adapterHost.httpAdapter?.getHttpServer() as HttpServer | undefined;
    if (httpServer === undefined) {
      this.logger.error('no HTTP server to attach the collaboration socket to');
      return;
    }

    this.wss = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url ?? '/', 'http://placeholder');
      if (url.pathname !== COLLAB_PATH && !url.pathname.startsWith(`${COLLAB_PATH}/`)) return;

      const planId = url.pathname.slice(COLLAB_PATH.length + 1);
      if (planId === '') {
        socket.destroy();
        return;
      }

      // Hocuspocus reads the document name from the request path, so the mount
      // prefix is stripped before handing the request over.
      request.url = `/${planId}${url.search}`;

      this.wss?.handleUpgrade(request, socket, head, (client: WebSocket) => {
        const connection = this.collab.hocuspocus.handleConnection(
          client,
          toFetchRequest(request),
        );

        client.on('message', (data: RawData) => connection.handleMessage(toUint8Array(data)));
        client.on('close', (code: number, reason: Buffer) => {
          connection.handleClose({ code, reason: reason.toString() } as CloseEvent);
        });
        client.on('error', (error: Error) => {
          this.logger.warn(`collaboration socket error: ${error.message}`);
        });
      });
    });

    this.logger.log(`collaboration socket listening on ${COLLAB_PATH}/:planId`);
  }

  onModuleDestroy(): void {
    this.wss?.close();
  }
}
