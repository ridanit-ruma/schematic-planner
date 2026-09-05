import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Hocuspocus, type Document } from '@hocuspocus/server';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { PlanDocumentsService } from '../plans/plan-documents.service.js';
import { AccessService } from '../workspaces/access.service.js';

export interface CollabContext {
  readonly userId: string;
  readonly role: string;
}

/**
 * The Yjs sync backend, embedded in this process rather than run as its own
 * service: it then shares the application's authentication and permissions
 * instead of reimplementing them, and a self-hosted deployment stays one
 * container. Splitting it out is a scaling decision for when load shows it.
 */
@Injectable()
export class CollabService implements OnModuleDestroy {
  private readonly logger = new Logger(CollabService.name);
  readonly hocuspocus: Hocuspocus<CollabContext>;

  constructor(
    private readonly documents: PlanDocumentsService,
    private readonly access: AccessService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.hocuspocus = new Hocuspocus<CollabContext>({
      name: 'schematic-planner',
      // Store once the document has been quiet, and unconditionally after
      // maxDebounce so a continuously edited plan still reaches the database.
      debounce: config.collab.debounceMs,
      maxDebounce: config.collab.maxWaitMs,

      onAuthenticate: async ({ token, documentName, connectionConfig }) => {
        let payload: AccessTokenPayload;
        try {
          payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
        } catch {
          throw new Error('Invalid access token');
        }

        const plan = await this.access.requirePlan(payload.sub, documentName, 'VIEWER');
        // A viewer may watch the document but not write to it. Enforced here
        // rather than in the UI, which is only a hint.
        connectionConfig.readOnly = plan.role === 'VIEWER';

        return { userId: payload.sub, role: plan.role };
      },

      onLoadDocument: async ({ documentName, document }) => {
        await this.documents.hydrate(document, documentName);
        return document;
      },

      onStoreDocument: async ({ documentName, document }) => {
        await this.documents.persist(documentName, document);
      },
    });
  }

  /** The live document if this instance has it in memory. */
  loaded(planId: string): Document | undefined {
    return this.hocuspocus.documents.get(planId);
  }

  /**
   * Server-side write path. Going through Hocuspocus rather than the database
   * means an agent's change reaches every open canvas at once, instead of being
   * silently overwritten the next time a browser saves.
   */
  async withDocument<T>(planId: string, mutate: (document: Document) => T): Promise<T> {
    const connection = await this.hocuspocus.openDirectConnection(planId);
    let result: T | undefined;
    let failure: unknown;

    try {
      await connection.transact((document) => {
        try {
          result = mutate(document);
        } catch (error) {
          failure = error;
        }
      });
      if (failure !== undefined) throw failure;
      if (connection.document !== null) {
        await this.documents.persist(planId, connection.document);
      }
      return result as T;
    } finally {
      await connection.disconnect();
    }
  }

  onModuleDestroy(): void {
    // Written before the process exits: without this, everything since the last
    // debounce window is lost on a restart or a rolling deploy.
    this.logger.log('flushing collaborative documents');
    this.hocuspocus.flushPendingStores();
    this.hocuspocus.closeConnections();
  }
}
